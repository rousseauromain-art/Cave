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
  await expect(page.getByRole('button', { name: 'Faire clignoter la clayette' })).toBeDisabled();
});
