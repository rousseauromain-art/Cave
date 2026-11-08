// S5 : profil spiritueux et reprise de la collection whisky (page legacy du dépôt).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

test('S5-01 conversion : origine, catégorie, âge, degré, millésime, lien', async () => {
  const { produitDepuisExpression } = await import(pathToFileURL(path.join(__dirname, '../core/import-whisky.js')).href);
  const islay = { id: 'x', name: 'Distillerie X', region: 'Islay', type: 'scotch', bzh: false, lat: 55.6, lon: -6.1 };
  expect(produitDepuisExpression(islay, { n: 'X 10 Ans', age: '10 ans', abv: '46,2%', notes: 'fumée', badges: ['peat'], link: 'https://exemple.fr' }))
    .toMatchObject({ profil: 'spiritueux', nom: 'X 10 Ans', producteur: 'Distillerie X', pays: 'SC', style: 'tourbe', age_ans: 10, degre: 46.2, extra: { lien: 'https://exemple.fr', ancien_id: 'x:X 10 Ans' } });
  expect(produitDepuisExpression(islay, { n: 'X Oloroso', age: 'NAS', abv: '~46%', notes: 'Oloroso cask' })).toMatchObject({ style: 'sherry', age_ans: null, degre: 46 });
  const breton = { id: 'b', name: 'Distillerie B', region: 'Lannion (22)', type: 'france', bzh: true };
  expect(produitDepuisExpression(breton, { n: 'Fine Bretagne Étoile', age: 'NAS', abv: '40%' })).toMatchObject({ pays: 'BZH', style: 'cognac' });
  expect(produitDepuisExpression({ id: 'f', name: 'F', region: 'France', type: 'france' }, { n: 'Eau de Vie Poire Williams 1975', age: '', abv: '45%' }))
    .toMatchObject({ pays: 'FR', style: 'edv', millesime: 1975 });
  expect(produitDepuisExpression({ id: 'r', name: 'R', region: 'Martinique', type: 'rhum' }, { n: 'Rhum R', abv: '42%' })).toMatchObject({ style: 'rhum', pays: 'FR' });
});

test.describe('écrans spiritueux', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  });

  test('S5-02 reprise de la collection : tous les flacons, drapeaux, catégories, sans doublon', async ({ page }) => {
    await page.goto('./#/reglages');
    const carte = page.locator('[data-carte="reprise-whisky"]');
    await expect(carte).toContainText('56 flacon(s) de 38 distillerie(s)');
    await carte.getByRole('button', { name: 'Reprendre les spiritueux' }).click();
    await expect(carte.locator('.message')).toContainText('56 flacon(s) repris');
    await carte.getByRole('button', { name: 'Reprendre les spiritueux' }).click();
    await expect(carte.locator('.message')).toContainText('0 flacon(s) repris, 56 déjà présent(s)');
    await carte.getByRole('link', { name: 'Voir les spiritueux' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-profil', 'spiritueux');
    await expect(page.locator('.tuile')).toHaveCount(56);
    await expect(page.locator('.resume')).toContainText('56 bouteilles · 56 flacons');
    await expect(page.locator('.tuile').getByRole('img', { name: 'Bretagne' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Tourbés' }).click();
    expect(await page.locator('.tuile').count()).toBeGreaterThan(15);
    await page.getByRole('button', { name: 'Rhums' }).click();
    await expect(page.locator('.tuile')).toHaveCount(4);
    // Le profil vin reste séparé
    await page.locator('[data-test="bascule-profil"]').click();
    await expect(page.locator('.tuile')).toHaveCount(0);
  });

  test('S5-03 Ce soir spiritueux : entamées d’abord, la plus basse en tête', async ({ page }) => {
    await page.goto('./#/cave');
    await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      const { ajouterBouteilles, sortirBouteille } = await import('/core/inventaire.js');
      const s = creerStore('cave');
      for (const [nom, niveau] of [['Haut', 80], ['Bas', 15], ['Fermé', null]]) {
        const p = await s.put('produits', { profil: 'spiritueux', nom, style: 'malt' });
        const [b] = await ajouterBouteilles(s, p.id, 1);
        if (niveau !== null) await s.put('bouteilles', { ...(await sortirBouteille(s, b, 'ouverte')), niveau });
      }
    });
    await page.locator('[data-test="bascule-profil"]').click();
    await page.goto('./#/ce-soir');
    const entamees = page.locator('.groupe-ce-soir').first();
    await expect(entamees.locator('h2')).toContainText('Bouteilles entamées');
    await expect(entamees.locator('.tuile-nom')).toHaveText(['Bas', 'Haut']);
    await expect(page.locator('.groupe-ce-soir').nth(1)).toContainText('Fermé');
  });
});
