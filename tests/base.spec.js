// S7 : fonctions de base — quantité, bouteille par bouteille, rangement des spiritueux, annulation, profils distincts.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  await page.goto('./#/cave');
  await page.evaluate(async () => {
    const { creerStore } = await import('/core/store.js');
    const { ajouterBouteilles } = await import('/core/inventaire.js');
    const s = creerStore('cave');
    window.ids = {};
    window.ids.etagere = (await s.put('rangements', { nom: 'Étagère bar', type: 'etagere' })).id;
    window.ids.casier = (await s.put('rangements', { nom: 'Petit casier', type: 'casier', lignes: 2, colonnes: 2 })).id;
    window.ids.bar = (await s.put('rangements', { nom: 'Bar test', type: 'bar', lignes: 2, colonnes: 3 })).id;
    const w = await s.put('produits', { profil: 'spiritueux', nom: 'Whisky Test', style: 'malt', pays: 'SC' });
    await ajouterBouteilles(s, w.id, 2);
    window.ids.whisky = w.id;
    const v = await s.put('produits', { profil: 'vin', nom: 'Vin Test', style: 'rouge' });
    await ajouterBouteilles(s, v.id, 3, { rangement_id: window.ids.etagere });
    window.ids.vin = v.id;
  });
});

const id = (page, k) => page.evaluate((x) => window.ids[x], k);
const enCave = (page) => page.locator('.liste-bouteilles.en-cave > li');

test('S7-01 quantité : + ajoute dans le même rangement, − demande la raison, annulation', async ({ page }) => {
  await page.goto(`./#/fiche/${await id(page, 'vin')}`);
  await expect(page.locator('.compteur-stock')).toContainText('3 bouteilles');
  await page.getByRole('button', { name: 'Ajouter une bouteille' }).click();
  await expect(page.locator('.compteur-stock')).toContainText('4 bouteilles');
  await expect(enCave(page).last()).toContainText('Étagère bar');
  await page.getByRole('button', { name: 'Retirer une bouteille' }).click();
  await page.getByRole('button', { name: 'Offerte' }).click();
  await expect(page.locator('.compteur-stock')).toContainText('3 bouteilles');
  await expect(page.locator('.sorties summary')).toHaveText('1 bouteille(s) sortie(s)');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('.compteur-stock')).toContainText('4 bouteilles');
  await page.getByRole('button', { name: 'Retirer une bouteille' }).click();
  await page.getByRole('button', { name: 'Erreur de saisie' }).click();
  await expect(page.locator('.compteur-stock')).toContainText('3 bouteilles');
  await expect(page.locator('.sorties')).toHaveCount(0);
});

test('S7-02 whisky rangé dans un rangement existant (groupé puis bouteille par bouteille)', async ({ page }) => {
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await page.goto(`./#/fiche/${await id(page, 'whisky')}`);
  await expect(enCave(page).first()).toContainText('Sans rangement');
  await page.getByLabel('Ranger les bouteilles sans rangement dans').selectOption({ label: 'Étagère bar' });
  await page.getByRole('button', { name: 'Ranger les 2' }).click();
  await expect(enCave(page)).toHaveText([/Étagère bar/, /Étagère bar/]);
  // Déplacer la 2e bouteille dans le casier, à un emplacement précis
  await page.getByRole('button', { name: /^Modifier la bouteille/ }).nth(1).click();
  const options = await page.locator('.editeur-bouteille').getByLabel(/^Rangement de la bouteille/).locator('option').allTextContents();
  expect(options).not.toContain('Petit casier'); // casier à vin non proposé pour un whisky
  await page.locator('.editeur-bouteille').getByLabel(/^Rangement de la bouteille/).selectOption({ label: 'Bar test' });
  await page.locator('.editeur-bouteille select[aria-label="Emplacement"]').selectOption({ label: 'Étagère 1 · place 2' });
  await page.locator('.editeur-bouteille').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(enCave(page).nth(1)).toContainText('Bar test · Étagère 1 · place 2');
  await page.goto(`./#/rangement/${await id(page, 'etagere')}`);
  await expect(page.locator('#vue')).toContainText('Whisky Test');
});

test('S7-03 bouteille par bouteille : état ouverte puis remise en stock depuis l’historique', async ({ page }) => {
  await page.goto(`./#/fiche/${await id(page, 'vin')}`);
  await page.getByRole('button', { name: /^Modifier la bouteille/ }).first().click();
  await page.locator('.editeur-bouteille').getByLabel('État').selectOption('bue');
  await page.locator('.editeur-bouteille').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(enCave(page)).toHaveCount(2);
  await page.locator('.sorties summary').click();
  await page.getByRole('button', { name: 'Remettre en stock' }).click();
  await expect(enCave(page)).toHaveCount(3);
});

test('S7-04 le défilement est conservé après une action sur la fiche', async ({ page }) => {
  await page.goto(`./#/fiche/${await id(page, 'vin')}`);
  await page.getByRole('button', { name: 'Ajouter une bouteille' }).scrollIntoViewIfNeeded();
  const avant = await page.evaluate(() => scrollY);
  await page.getByRole('button', { name: 'Ajouter une bouteille' }).click();
  await expect(page.locator('.compteur-stock')).toContainText('4 bouteilles');
  expect(Math.abs((await page.evaluate(() => scrollY)) - avant)).toBeLessThan(40);
});

test('S7-05 profils distincts : sélecteur, onglet, couleurs, contenus séparés', async ({ page }) => {
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Vins', exact: true })).toBeVisible();
  await expect(page.locator('.tuile')).toHaveCount(1);
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await expect(page.locator('#titre')).toHaveText('Spiritueux');
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Spiritueux', exact: true })).toBeVisible();
  await expect(page.locator('.entete')).toHaveCSS('background-color', 'rgb(122, 69, 18)');
  await expect(page.locator('.tuile')).toHaveCount(1);
  await expect(page.locator('.tuile-nom')).toHaveText('Whisky Test');
  await expect(page.locator('[data-profil-choix="spiritueux"]')).toHaveAttribute('aria-checked', 'true');
});

test('S7-06 rangement : y ranger des bouteilles sans rangement, le renommer, suppression bloquée s’il n’est pas vide', async ({ page }) => {
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await page.goto(`./#/rangement/${await id(page, 'casier')}`);
  await page.locator('[data-carte="ranger-ici"] summary').click();
  await page.getByLabel(/Whisky Test/).check();
  await page.getByRole('button', { name: 'Ranger ici' }).click();
  await expect(page.locator('.case')).toHaveCount(2);
  await expect(page.locator('.emplacement.libre')).toHaveCount(2);
  await page.locator('[data-carte="modifier-rangement"] summary').click();
  await page.locator('[data-carte="modifier-rangement"] input[name="nom"]').fill('Casier whisky');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('#titre')).toHaveText('Casier whisky');
  await page.locator('[data-carte="modifier-rangement"] summary').click();
  await page.getByRole('button', { name: 'Supprimer ce rangement' }).click();
  await expect(page.locator('[data-carte="modifier-rangement"] .message')).toContainText('Videz d’abord le rangement (2 bouteille(s))');
});

test('S7-07 création d’un doublon : la fiche existante est proposée', async ({ page }) => {
  await page.goto('./#/produit/nouveau');
  await page.getByLabel('Nom *').fill('vin test');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('link', { name: 'ouvrir sa fiche pour ajouter des bouteilles' })).toBeVisible();
  await page.getByRole('link', { name: 'ouvrir sa fiche pour ajouter des bouteilles' }).click();
  await expect(page.locator('.compteur-stock')).toContainText('3 bouteilles');
});

test('S8-01 bar : étagères, silhouettes, liquide au niveau, comptoir, halo de recherche', async ({ page }) => {
  await page.evaluate(async () => {
    const { creerStore } = await import('/core/store.js');
    const s = creerStore('cave');
    const bt = (await s.list('bouteilles')).filter((b) => b.produit_id === window.ids.whisky);
    await s.put('bouteilles', { ...bt[0], rangement_id: window.ids.bar, emplacement: 'R2-E1', etat: 'ouverte', niveau: 25 });
    await s.put('bouteilles', { ...bt[1], rangement_id: window.ids.bar, emplacement: null });
  });
  await page.goto('./#/rangements');
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await expect(page.getByText('Bar test')).toBeVisible();
  await expect(page.getByText('Petit casier')).toHaveCount(0); // rangement de la collection Vins
  await page.getByText('Bar test').click();
  await expect(page.locator('.bar-rangee .bar-titre')).toHaveText(['Étagère 1', 'Étagère 2', 'Sur le comptoir · à placer']);
  await expect(page.getByRole('button', { name: /Bouteille \d+, Whisky Test, Étagère 1 · place 1, reste 25 %/ })).toBeVisible();
  await page.getByLabel('Chercher un vin dans ce rangement').fill('whisky');
  await expect(page.locator('.bar-halo')).toHaveCount(2);
  await page.getByRole('button', { name: /reste 25 %/ }).click();
  await expect(page.locator('.bar-halo')).toHaveCount(1);
  await expect(page.locator('.bouteille-choisie')).toContainText('Étagère 1 · place 1');
});

test('S8-02 création d\u2019un rangement : types et collection selon le profil', async ({ page }) => {
  await page.goto('./#/rangements');
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await expect(page.locator('select[name="type"]')).toHaveValue('bar');
  const types = await page.locator('select[name="type"] option').allTextContents();
  expect(types).toContain('Bar (étagères à bouteilles)');
  expect(types).not.toContain('Casier Montrouge (connecté)');
  await expect(page.locator('select[name="profil"]')).toHaveValue('spiritueux');
  await expect(page.locator('input[name="lignes"]')).toHaveValue('3');
  await expect(page.getByText('Bouteilles par étagère')).toBeVisible();
  await page.getByLabel('Nom').fill('Vitrine salon');
  await page.locator('select[name="type"]').selectOption('vitrine');
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page.getByText('Vitrine salon')).toBeVisible();
  await page.locator('[data-profil-choix="vin"]').click();
  await expect(page.getByText('Vitrine salon')).toHaveCount(0);
});
