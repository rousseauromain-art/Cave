// S6 : protocole du casier Montrouge, capteurs en direct, écarts avec l'inventaire, rangement assisté.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const proto = () => import(pathToFileURL(path.join(__dirname, '../modules/montrouge/protocole.js')).href);

test('S6-01 décodage : séparateurs, échappement, somme de contrôle, différences', async () => {
  const { creerDecodeur, lireTrame, differences, encoderRangee } = await proto();
  const trames = [];
  const dec = creerDecodeur((f) => trames.push(lireTrame(f)));
  const octets = encoderRangee(3, 0b111111);
  dec(octets.slice(0, 3)); dec(octets.slice(3)); // flux coupé en deux notifications
  expect(trames).toEqual([{ valide: true, adresse: 3, type: 0x45, donnees: [63, 0, 63] }]);
  // Masque nécessitant un échappement : la somme vaut 0xFF
  const special = encoderRangee(2, 0x5c); // 2 + 0x45 + 0x5c + 0 + 0x5c = 0xFF → somme échappée
  expect(special.slice(1, 3)).toEqual([0xfe, 0xff]);
  dec(special);
  expect(trames.at(-1)).toMatchObject({ valide: true, adresse: 2, donnees: [0x5c, 0, 0x5c] });
  dec([0xff, 0x00, 0x03, 0x45, 0x01, 0xff]);
  expect(trames.at(-1)).toEqual({ valide: false });
  expect(differences(0b000101, 0b010100)).toEqual({ poses: [4], retires: [0] });
});

const fauxCasier = () => {
  const ecouteurs = [];
  const ch = { properties: { notify: true }, addEventListener: (_, f) => ecouteurs.push(f), startNotifications: async () => {} };
  window.envoyerCasier = (octets) => ecouteurs.forEach((f) => f({ target: { value: new DataView(Uint8Array.from(octets).buffer) } }));
  const appareil = { name: 'CAVEASY', addEventListener() {}, gatt: { connected: false, async connect() { this.connected = true; return { getPrimaryService: async () => ({ getCharacteristics: async () => [ch] }) }; } } };
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => appareil }, configurable: true });
};

test('S6-02 capteurs en direct : écarts, identification, retrait, rangement assisté', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  await page.addInitScript(fauxCasier);
  await page.goto('./#/rangements');
  const id = await page.evaluate(async () => {
    const { creerStore } = await import('/core/store.js');
    const s = creerStore('cave');
    const r = await s.put('rangements', { nom: 'Casier Montrouge', type: 'montrouge', lignes: 8, colonnes: 6 });
    const a = await s.put('produits', { profil: 'vin', nom: 'Vin A', style: 'rouge' });
    await s.put('produits', { profil: 'vin', nom: 'Vin B', style: 'blanc' });
    await s.put('bouteilles', { produit_id: a.id, rangement_id: r.id, emplacement: 'R8-E1', numero: 1, etat: 'stock' });
    await s.put('bouteilles', { produit_id: a.id, rangement_id: r.id, emplacement: 'R8-E2', numero: 2, etat: 'stock' });
    return r.id;
  });
  await page.goto(`./#/rangement/${id}`);
  await page.getByRole('link', { name: 'Casier connecté : capteurs en direct' }).click();
  await page.getByRole('button', { name: 'Connecter le casier' }).click();
  await expect(page.getByText('CAVEASY connecté')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connecter le casier' })).toBeHidden();
  const { encoderRangee } = await proto();
  // Rangée 8 : E1 et E3 occupés (E2 absente du casier, E3 inconnue de l'app) ; autres rangées vides
  for (let r = 1; r <= 7; r++) await page.evaluate((o) => window.envoyerCasier(o), encoderRangee(r, 0));
  await page.evaluate((o) => window.envoyerCasier(o), encoderRangee(8, 0b000101));
  await expect(page.getByText('2 écart(s) entre le casier et l’app')).toBeVisible();
  await expect(page.locator('[data-emplacement="R8-E2"]')).toHaveClass(/etat-retiree/);
  await expect(page.locator('[data-emplacement="R8-E3"]')).toHaveClass(/etat-inconnue/);
  // Identifier la bouteille posée
  await page.locator('[data-emplacement="R8-E3"]').click();
  await page.getByLabel('Vin posé à cet emplacement').selectOption({ label: 'Vin B' });
  await page.getByRole('button', { name: 'C’est ce vin' }).click();
  await expect(page.locator('[data-emplacement="R8-E3"]')).toHaveClass(/etat-ok/);
  // La bouteille absente a été bue
  await page.locator('[data-emplacement="R8-E2"]').click();
  await page.getByRole('button', { name: 'Bouteille bue' }).click();
  await expect(page.getByText('Casier et app en accord')).toBeVisible();
  // Rangement assisté : choisir le vin puis poser deux bouteilles
  await page.getByLabel('Vin à ranger').selectOption({ label: 'Vin A' });
  await page.evaluate((o) => window.envoyerCasier(o), encoderRangee(8, 0b011101));
  await expect(page.getByText('2 bouteille(s) de Vin A rangée(s)')).toBeVisible();
  await expect(page.locator('[data-emplacement="R8-E4"]')).toHaveClass(/etat-ok/);
  await expect(page.locator('[data-emplacement="R8-E5"]')).toHaveClass(/etat-ok/);
  await expect(page.locator('.mouvements li')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Ouvrir le labo Bluetooth' })).toHaveAttribute('href', '#/montrouge-labo');
});

test('S15-01 labo Bluetooth : GATT, composeur, test « État des rangées », réponses corrélées, journal', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  await page.addInitScript(() => {
    const ecouteurs = [];
    window.ecrits = [];
    const notif = { uuid: '569a2001-b87f-490c-92cb-11ba5ea5167c', properties: { notify: true }, addEventListener: (_, f) => ecouteurs.push(f), startNotifications: async () => {} };
    const envoyer = (o) => ecouteurs.forEach((f) => f({ target: { value: new DataView(Uint8Array.from(o).buffer) } }));
    // Le faux casier répond à une demande d'état (type 0x00) par l'état de la rangée.
    const ecriture = { uuid: '569a2002-b87f-490c-92cb-11ba5ea5167c', properties: { write: true }, async writeValueWithResponse(v) {
      const o = [...v]; window.ecrits.push(o);
      if (o[3] === 0x00) { const a = o[2]; const corps = [a, 0x00, 0x3f]; setTimeout(() => envoyer([0xff, corps.reduce((x, y) => x + y, 0) & 255, ...corps, 0xff]), 20); }
    } };
    const appareil = { name: 'CAVEASY', addEventListener() {}, gatt: { connected: false, async connect() { this.connected = true; return { getPrimaryServices: async () => [{ getCharacteristics: async () => [notif, ecriture] }] }; }, disconnect() { this.connected = false; } } };
    Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => appareil }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true });
  });
  await page.goto('./#/montrouge-labo');
  await page.getByRole('button', { name: 'Connecter le casier' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'dont 1 en écriture' })).toBeVisible();
  // Composeur : somme et échappement calculés
  await page.getByLabel('Adresse (rangée)').fill('2');
  await page.getByLabel('Type (hexa)').fill('45');
  await page.getByLabel('Données (hexa)').fill('5c 00 5c');
  await expect(page.locator('.apercu-trame')).toHaveText('ff fe ff 02 45 5c 00 5c ff');
  // Test guidé
  await page.getByRole('button', { name: 'État des rangées' }).click();
  await expect(page.locator('.labo-tableau tbody tr')).toHaveCount(8, { timeout: 15000 });
  const ecrits = await page.evaluate(() => window.ecrits);
  expect(ecrits[0]).toEqual([0xff, 0x01, 0x01, 0x00, 0xff]);
  await expect(page.locator('.labo-journal')).toContainText('↩');
  await expect(page.locator('.labo-journal')).toContainText('type 0x00 (état de rangée) · 3f');
  await page.getByLabel('Note pour le journal').fill('rangée 3 vide');
  await page.getByRole('button', { name: 'Noter' }).click();
  await expect(page.locator('.labo-journal li').first()).toContainText('### rangée 3 vide');
});

test('S15-02 lecture détaillée des trames observées (capteurs, passerelle, module)', async () => {
  const { detailTrame } = await proto();
  expect(detailTrame({ adresse: 4, type: 0x45, donnees: [0x10, 0x00, 0x10] })).toBe('rangée 4 : posé E5, retiré —, présents E5');
  expect(detailTrame({ adresse: 5, type: 0x45, donnees: [0x00, 0x20, 0x00] })).toBe('rangée 5 : posé —, retiré E6, présents —');
  // Casier réel : retrait de E3 alors que E5 reste en place → posés 00, retirés 04, présents 10
  expect(detailTrame({ adresse: 4, type: 0x45, donnees: [0x00, 0x04, 0x10] })).toBe('rangée 4 : posé —, retiré E3, présents E5');
  const { presentsDe, lireTrame, encoderRangee } = await proto();
  expect(presentsDe({ donnees: [0x00, 0x04, 0x10] })).toBe(0x10);
  expect(lireTrame(encoderRangee(4, 0x10, 0x00, 0x04).slice(1, -1)).donnees).toEqual([0x00, 0x04, 0x10]);
  const id = [0x12, 0x60, 0x8f, 0x51, 0x39, 0x36, 0x50, 0x51, 0x20, 0x20, 0x20, 0x30, 0x35, 0x0f, 0x12];
  const evt = detailTrame({ adresse: 0, type: 0x21, donnees: [...id, 0xff, 0x01, 0x97, 0x9a, 0xf1, 0x75, 0xde, 0x0a, 0x05, 0x20, 0x00, 0x20] });
  expect(evt).toContain('passerelle Q96PQ   05 : événement n° 2782, rangée 5 : posé E6, retiré —, présents selon la passerelle E6');
  expect(evt).toContain('horloge 2026-11-02');
  expect(detailTrame({ adresse: 0, type: 0x21, donnees: [...id, 0xff, 0xff] })).toContain(': fin');
  expect(detailTrame({ adresse: 1, type: 0x40, donnees: [0x02, 0xea, 0x22, 0x01, 0x34, 0x54, 0x35, 0x51, 0x51, 0x20, 0x20, 0x20, 0x41, 0x2c, 0x3f, 0x11] })).toBe('module rangée 1 : « T5QQ   A » id ea 22 01 34');
});
