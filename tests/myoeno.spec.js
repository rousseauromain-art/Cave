// S3 : algorithme MyOeno (identique à la v9.3), trames, scanner Bluetooth simulé, enregistrement, reprise de l'historique.
const { test, expect } = require('@playwright/test');
const { choisirProfil } = require('./outils/profil.js');
// Bascule vers l'autre profil via le sélecteur.
const basculer = async (page) => choisirProfil(page, (await page.locator('html').getAttribute('data-profil')) === 'spiritueux' ? 'vin' : 'spiritueux');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const legacy = fs.readFileSync(path.join(__dirname, '../legacy/cave-revival-v9.3.html'), 'utf8');
const ancienCalcul = new Function(`${legacy.match(/function myoenoCompute\(d\)\{[\s\S]*?\n\}/)[0]}; return myoenoCompute;`)();

test('S3-01 le calcul porté donne exactement les mêmes valeurs que la v9.3', async () => {
  const { calculer } = await import(pathToFileURL(path.join(__dirname, '../modules/degustations/calcul.js')).href);
  let graine = 7;
  const alea = () => { graine = (graine * 16807) % 2147483647; return graine; };
  for (let i = 0; i < 500; i++) {
    const d = [0, 1, 2, 3, 4, 5].map((k) => 200 + (alea() % (k < 3 ? 60000 : 30000)));
    const v = calculer(d);
    expect([v.puissance, v.tanins, v.vivacite, v.garde, v.evolution], JSON.stringify(d)).toEqual(ancienCalcul(d));
  }
});

test('S3-02 trames : états 1 à 4, résultat, trame trop courte ; mots-clés suggérés', async () => {
  const { lireTrame, motsCles } = await import(pathToFileURL(path.join(__dirname, '../modules/degustations/calcul.js')).href);
  const trame = (octets) => new DataView(Uint8Array.from(octets).buffer);
  expect(lireTrame(trame([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]))).toEqual({ etat: 1 });
  expect(lireTrame(trame([0, 0, 0]))).toBeNull();
  const r = lireTrame(trame([0x9c, 0x40, 0x9c, 0x40, 0x9c, 0x40, 0x10, 0x00, 0x05, 0x00, 0x05, 0x10]));
  expect(r.brut).toEqual([40000, 40000, 40000, 4096, 1280, 1296]);
  expect(Object.keys(r.valeurs)).toEqual(['puissance', 'tanins', 'vivacite', 'garde', 'evolution']);
  expect(motsCles({ puissance: 70, tanins: 72, vivacite: 50, evolution: 30 }, 'rouge')).toEqual(expect.arrayContaining(['Tanins fermes', 'À carafer', 'Chaleureux', 'Jeune', 'Fruits noirs']));
  expect(motsCles(null, 'tourbe', 'spiritueux')).toEqual(expect.arrayContaining(['Tourbé', 'Iodé']));
});

// Faux scanner Bluetooth injecté avant le chargement de l'app.
const fauxBluetooth = () => {
  const trame = (o) => new DataView(Uint8Array.from(o).buffer);
  const ecouteurs = [];
  const ch = {
    addEventListener: (_, f) => ecouteurs.push(f),
    startNotifications: async () => {
      const envoyer = (o, ms) => setTimeout(() => ecouteurs.forEach((f) => f({ target: { value: trame(o) } })), ms);
      envoyer([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 50);
      envoyer([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], 150);
      envoyer([0x9c, 0x40, 0x9c, 0x40, 0x9c, 0x40, 0x10, 0x00, 0x05, 0x00, 0x05, 0x10], 300);
    },
    readValue: async () => trame([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  };
  const bat = { readValue: async () => trame([87]) };
  const appareil = {
    name: 'MyOeno', addEventListener() {},
    gatt: { connected: false, async connect() { this.connected = true; return { getPrimaryService: async (u) => ({ getCharacteristic: async () => (u === 0x180f ? bat : ch) }) }; }, disconnect() { this.connected = false; } }
  };
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => appareil }, configurable: true });
};

test.describe('écran Dégustation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
    await page.addInitScript(fauxBluetooth);
  });

  test('S3-03 mesure Bluetooth → triangle, mots-clés, note → profil sur la fiche du vin', async ({ page }) => {
    await page.goto('./#/cave');
    const id = await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      return (await creerStore('cave').put('produits', { profil: 'vin', nom: 'Vin Mesuré', style: 'rouge', millesime: 2019 })).id;
    });
    await page.goto(`./#/fiche/${id}`);
    await page.getByRole('link', { name: 'Scanner avec MyOeno' }).click();
    await expect(page).toHaveURL(/#\/mesure\?produit=/);
    await expect(page.locator('.vin-mesure strong')).toHaveText('Vin Mesuré 2019');
    await page.getByRole('button', { name: 'Connecter le scanner' }).click();
    await expect(page.getByText('MyOeno 87 %')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connecter le scanner' })).toBeHidden();
    await expect(page.getByText('Mesure terminée.')).toBeVisible();
    await expect(page.locator('.resultat-mesure svg.radar')).toBeVisible();
    await expect(page.locator('.etapes li[aria-current]')).toHaveText('Résultat');
    await page.getByRole('button', { name: 'Fruits noirs' }).click();
    await page.getByLabel('Ajouter un mot-clé').fill('Poivre');
    await page.getByLabel('Ajouter un mot-clé').press('Enter');
    await page.getByRole('radio', { name: '4 sur 5' }).click();
    await page.getByRole('button', { name: 'Enregistrer la dégustation' }).click();
    await expect(page).toHaveURL(new RegExp(`#/fiche/${id}`));
    await expect(page.locator('[data-section="profil"] .profil-fiche svg.radar')).toBeVisible();
    await expect(page.locator('[data-section="profil"] .section-resume')).toHaveText('1 mesure');
    await expect(page.locator('[data-section="profil"] .profil-fiche').getByText('Poivre')).toBeVisible();
    await expect(page.getByLabel('Note 4 sur 5')).toBeVisible();
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Dégustations', exact: true }).click();
    await expect(page.locator('.ligne-historique')).toHaveCount(1);
    await expect(page.locator('.ligne-historique')).toContainText('Vin Mesuré 2019');
  });

  test('S3-04 sans Bluetooth : message clair et dégustation notée quand même', async ({ page, browserName }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'bluetooth', { value: undefined }));
    await page.goto('./#/mesure');
    await expect(page.getByText('Bluetooth indisponible sur ce navigateur')).toBeVisible();
    await page.getByRole('radio', { name: '3 sur 5' }).click();
    await page.getByRole('button', { name: 'Enregistrer la dégustation' }).click();
    await expect(page).toHaveURL(/#\/degustations$/);
    await expect(page.locator('.ligne-historique')).toContainText('Verre non rattaché');
  });

  test('S3-05 reprise de l’historique MyOeno v9 : vins retrouvés ou créés sans stock, sans doublon', async ({ page }) => {
    await page.goto('./#/cave');
    await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      await creerStore('cave').put('produits', { profil: 'vin', nom: 'La Grise', millesime: 2018 });
      localStorage.setItem('myoeno_hist', JSON.stringify([
        { date: '2026-11-05T20:00:00.000Z', raw: [1, 2, 3, 4, 5, 6], puissance: 60, tanins: 64, vivacite: 52, garde: 4, evolution: 41, nom: 'la grise', millesime: '2018', note: '4', aromes: 'fruits noirs, épices' },
        { date: '2026-11-06T20:00:00.000Z', raw: [1, 2, 3, 4, 5, 6], puissance: 50, tanins: 40, vivacite: 60, garde: 2, evolution: 30, nom: 'Verre chez Paul', millesime: '', note: '3' },
        { date: '2026-11-07T20:00:00.000Z', raw: [1, 2, 3, 4, 5, 6], puissance: 55, tanins: 50, vivacite: 55, garde: 3, evolution: 35, nom: '' }
      ]));
    });
    await page.goto('./#/reglages');
    await page.getByRole('button', { name: 'Reprendre les mesures' }).click();
    await expect(page.locator('[data-carte="reprise-myoeno"] .message')).toContainText('3 mesure(s) reprise(s), 1 vin(s) créé(s)');
    await page.getByRole('button', { name: 'Reprendre les mesures' }).click();
    await expect(page.locator('[data-carte="reprise-myoeno"] .message')).toContainText('0 mesure(s) reprise(s), 0 vin(s) créé(s) sans stock, 3 déjà');
    await page.goto('./#/degustations');
    await expect(page.locator('.ligne-historique')).toHaveCount(3);
    await expect(page.locator('.ligne-historique').filter({ hasText: 'La Grise 2018' })).toContainText('fruits noirs, épices');
  });

  test('S3-06 spiritueux : mesure masquée sauf module expérimental activé', async ({ page }) => {
    await page.goto('./#/mesure');
    await basculer(page);
    await expect(page.getByRole('button', { name: 'Connecter le scanner' })).toHaveCount(0);
    await expect(page.getByText('Tourbé')).toBeVisible();
    await page.goto('./#/reglages');
    await page.locator('[data-module="myoeno-spiritueux"]').check();
    await page.goto('./#/mesure');
    await expect(page.getByRole('button', { name: 'Connecter le scanner' })).toBeVisible();
  });
});
