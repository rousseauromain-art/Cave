// S1 : inventaire, fiche, ajout sans stock, bouteilles, rangements avec halo, reprise de l'ancienne app.
const { test, expect } = require('@playwright/test');
const { choisirProfil } = require('./outils/profil.js');
// Bascule vers l'autre profil via le sélecteur.
const basculer = async (page) => choisirProfil(page, (await page.locator('html').getAttribute('data-profil')) === 'spiritueux' ? 'vin' : 'spiritueux');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const exempleV9 = fs.readFileSync(path.join(__dirname, 'outils/v9-exemple.json'), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  await page.goto('./');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((ok) => { const r = indexedDB.deleteDatabase('cave'); r.onsuccess = r.onerror = r.onblocked = ok; });
  });
  await page.goto('./#/cave');
});

// L'onglet de la cave s'appelle « Vins » ou « Spiritueux » selon le profil.
const onglet = async (page, nom) => {
  if (nom === 'Cave') nom = (await page.locator('html').getAttribute('data-profil')) === 'spiritueux' ? 'Spiritueux' : 'Vins';
  return page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: nom, exact: true }).click();
};

async function ajouterVin(page, { nom, style, pays, quantite, rangement, profil }) {
  await onglet(page, 'Cave');
  await page.getByRole('link', { name: profil === 'spiritueux' ? 'Ajouter un spiritueux' : 'Ajouter un vin' }).click();
  await page.getByLabel('Nom *').fill(nom);
  if (style) await page.locator('select[name="style"]').selectOption(style);
  if (pays) await page.locator('select[name="pays"]').selectOption(pays);
  if (quantite !== undefined) await page.getByLabel('Bouteilles').fill(String(quantite));
  if (rangement) await page.locator('select[name="rangement"]').selectOption({ label: rangement });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/#\/fiche\//);
}

test('S1-01 la cave vide invite à ajouter ou reprendre', async ({ page }) => {
  await expect(page.getByText('Votre cave est vide')).toBeVisible();
});

test('S1-02 un vin sans stock ni mesure peut être ajouté', async ({ page }) => {
  await ajouterVin(page, { nom: 'Envie de goûter', style: 'blanc', pays: 'IT', quantite: 0 });
  await expect(page.getByRole('heading', { name: 'Envie de goûter' })).toBeVisible();
  await expect(page.getByText('Aucune bouteille en stock')).toBeVisible();
  await onglet(page, 'Cave');
  await expect(page.locator('.tuile')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sans stock' }).click();
  await expect(page.locator('.tuile')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rouges' }).click();
  await expect(page.locator('.tuile')).toHaveCount(0);
  await page.getByRole('button', { name: 'À mesurer' }).click();
  await expect(page.locator('.tuile')).toHaveCount(1);
});

test('S1-03 vignette : compteur, pastille, drapeau, note ; recherche', async ({ page }) => {
  await ajouterVin(page, { nom: 'Grand Test', style: 'rouge', pays: 'ES', quantite: 3 });
  await page.getByRole('link', { name: 'Modifier la fiche' }).click();
  await page.getByLabel('Note (0 à 5)').fill('4.5');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await onglet(page, 'Cave');
  const t = page.locator('.tuile').first();
  await expect(t.getByLabel('3 bouteilles')).toBeVisible();
  await expect(t.getByRole('img', { name: 'Rouge' })).toBeVisible();
  await expect(t.getByRole('img', { name: 'Espagne' })).toBeVisible();
  await expect(t.getByLabel('Note 4,5 sur 5')).toBeVisible();
  await ajouterVin(page, { nom: 'Autre Vin', quantite: 1 });
  await onglet(page, 'Cave');
  await page.getByRole('searchbox').fill('grand');
  await expect(page.locator('.tuile')).toHaveCount(1);
});

test('S1-04 ouvrir une bouteille diminue le stock ; ajouter en remet', async ({ page }) => {
  await ajouterVin(page, { nom: 'Stock Test', style: 'rouge', quantite: 2 });
  await expect(page.locator('.liste-bouteilles.en-cave li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ouvrir une bouteille' }).click();
  await expect(page.locator('.liste-bouteilles.en-cave li')).toHaveCount(1);
  await page.getByLabel('Nombre de bouteilles').fill('3');
  await page.getByRole('button', { name: '+ Ajouter' }).click();
  await expect(page.locator('.liste-bouteilles.en-cave li')).toHaveCount(4);
});

test('S1-05 casier : bouteilles placées, recherche et halo jaune, localiser depuis la fiche', async ({ page }) => {
  await onglet(page, 'Rangements');
  await page.getByLabel('Nom').fill('Casier test');
  await page.locator('select[name="type"]').selectOption('casier');
  await page.getByLabel('Rangées').fill('3');
  await page.getByLabel('Emplacements par rangée').fill('4');
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page.getByText('Casier test')).toBeVisible();
  await ajouterVin(page, { nom: 'Bouteille Cherchée', style: 'rouge', quantite: 2, rangement: 'Casier test' });
  await expect(page.getByText('Casier test · R3-E1')).toBeVisible();
  await page.getByRole('link', { name: /Localiser la bouteille/ }).first().click();
  await expect(page).toHaveURL(/#\/rangement\/.+\?b=1/);
  await expect(page.locator('.emplacement.halo')).toHaveCount(1);
  await expect(page.locator('.emplacement.libre')).toHaveCount(10);
  await page.getByLabel('Chercher un vin dans ce rangement').fill('cherch');
  await expect(page.locator('.emplacement.halo')).toHaveCount(2);
  await page.getByLabel('Chercher un vin dans ce rangement').fill('rien');
  await expect(page.locator('.emplacement.halo')).toHaveCount(0);
  await page.getByRole('button', { name: /Bouteille 2,/ }).click();
  await expect(page.locator('.emplacement.halo')).toHaveCount(1);
  await expect(page.locator('.bouteille-choisie')).toContainText('Bouteille Cherchée');
  await expect(page.locator('#vue')).not.toContainText('null');
});

test('S1-06 modifier puis supprimer (confirmation en deux temps)', async ({ page }) => {
  await ajouterVin(page, { nom: 'À supprimer', quantite: 1 });
  await page.getByRole('link', { name: 'Modifier la fiche' }).click();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page).toHaveURL(/modifier$/);
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click();
  await expect(page).toHaveURL(/#\/cave$/);
  await expect(page.locator('.tuile')).toHaveCount(0);
});

test('S1-07 spiritueux : ouvrir une bouteille, niveau restant et jauge', async ({ page }) => {
  await basculer(page);
  await onglet(page, 'Cave');
  await ajouterVin(page, { nom: 'Malt Fictif', style: 'tourbe', pays: 'SC', quantite: 1, profil: 'spiritueux' });
  await page.getByRole('button', { name: 'Ouvrir une bouteille' }).click();
  await expect(page.getByText('ouverte, reste Plein')).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Niveau restant' }).getByRole('radio', { name: '½' }).click();
  await expect(page.getByText('ouverte, reste ½')).toBeVisible();
  await expect(page.getByText('≈ 8 verre(s) de 4 cl')).toBeVisible();
  await page.getByRole('button', { name: 'Je me suis servi un verre (4 cl)' }).click();
  await expect(page.getByText('≈ 7 verre(s) de 4 cl')).toBeVisible();
  await page.getByRole('radio', { name: '¾' }).click();
  await page.getByRole('radio', { name: '½' }).click();
  await onglet(page, 'Cave');
  await expect(page.getByRole('img', { name: 'Reste 50 %' })).toBeVisible();
  await page.getByRole('button', { name: 'Entamées' }).click();
  await expect(page.locator('.tuile')).toHaveCount(1);
});

test('S1-08 reprise de l’ancienne app : vins, photo, casier, inconnus, sans doublon', async ({ page }) => {
  await page.evaluate((e) => localStorage.setItem('caveasy_state', e), exempleV9);
  await page.goto('./#/reglages');
  await page.getByRole('button', { name: 'Reprendre vins, photos et casier' }).click();
  await expect(page.locator('[data-carte="reprise"] .message')).toContainText('3 vin(s) repris, 1 photo(s), 4 bouteille(s)');
  await page.getByRole('button', { name: 'Reprendre vins, photos et casier' }).click();
  await expect(page.locator('[data-carte="reprise"] .message')).toContainText('0 vin(s) repris');
  await onglet(page, 'Cave');
  await expect(page.locator('.tuile')).toHaveCount(4); // 3 vins + « À identifier »
  await expect(page.locator('.tuile img')).toHaveCount(1);
  await onglet(page, 'Rangements');
  await expect(page.getByText('Casier Montrouge', { exact: true })).toBeVisible();
  await page.getByText('Casier Montrouge', { exact: true }).click();
  await expect(page.locator('.rangee')).toHaveCount(8);
  await expect(page.getByRole('button', { name: /R8-E1$/ })).toBeVisible();
});

test('S1-09 conversion pure des fiches de l’ancienne app', async () => {
  const { produitDepuisV9, emplacementDepuisV9 } = await import(pathToFileURL(path.join(__dirname, '../core/import-v9.js')).href).catch(() => ({}));
  test.skip(!produitDepuisV9, 'module navigateur (localStorage) : conversion testée via S1-08');
  expect(emplacementDepuisV9('5-0')).toBe('R5-E1');
  const p = produitDepuisV9('cv1', JSON.parse(exempleV9).wines.cv1);
  expect(p).toMatchObject({ profil: 'vin', nom: 'Domaine Fictif', producteur: 'Maison Test', millesime: 2018, style: 'rouge', pays: 'FR', region: 'Rhône', apogee_debut: 2020, apogee_fin: 2023 });
});
