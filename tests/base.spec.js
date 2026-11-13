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
  // Déplacer la 2e bouteille dans le bar (pas d'emplacement précis : le bar est une vue de l'inventaire)
  await page.getByRole('button', { name: /^Modifier la bouteille/ }).nth(1).click();
  const options = await page.locator('.editeur-bouteille').getByLabel(/^Rangement de la bouteille/).locator('option').allTextContents();
  expect(options).not.toContain('Petit casier'); // casier à vin non proposé pour un whisky
  await page.locator('.editeur-bouteille').getByLabel(/^Rangement de la bouteille/).selectOption({ label: 'Bar test' });
  await expect(page.locator('.editeur-bouteille select[aria-label="Emplacement"]')).toHaveCount(0);
  await page.locator('.editeur-bouteille').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(enCave(page).nth(1)).toContainText('Bar test');
  await expect(page.getByRole('link', { name: /Localiser la bouteille/ })).toHaveCount(2); // étagère et bar s'affichent en étagères côté spiritueux
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

test('S9-01 bar en lecture seule : étagères par pays, 6 par planche, nom et niveau, halo, autres regroupements', async ({ page }) => {
  await page.evaluate(async () => {
    const { creerStore } = await import('/core/store.js');
    const { ajouterBouteilles } = await import('/core/inventaire.js');
    const s = creerStore('cave');
    const bt = (await s.list('bouteilles')).filter((b) => b.produit_id === window.ids.whisky);
    await s.put('bouteilles', { ...bt[0], rangement_id: window.ids.bar, emplacement: 'R2-E1', etat: 'ouverte', niveau: 25 });
    await s.put('bouteilles', { ...bt[1], rangement_id: window.ids.bar });
    const j = await s.put('produits', { profil: 'spiritueux', nom: 'Nikka Test', style: 'blend', pays: 'JP', extra: { forme: 'ronde' } });
    await ajouterBouteilles(s, j.id, 1, { rangement_id: window.ids.bar });
    const b = await s.put('produits', { profil: 'spiritueux', nom: 'Breton Test', style: 'tourbe', pays: 'BZH' });
    await ajouterBouteilles(s, b.id, 7, { rangement_id: window.ids.bar });
  });
  await page.goto('./#/rangements');
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await expect(page.getByText('Petit casier')).toHaveCount(0); // rangement de la collection Vins
  await page.getByText('Bar test').click();
  // Pays : le plus fourni d'abord ; 7 bouteilles bretonnes = 2 planches de 6
  await expect(page.locator('.bar-entete strong')).toHaveText(['Bretagne', 'Écosse', 'Japon']);
  await expect(page.locator('.bar-groupe').first().locator('.bar-planche-rang')).toHaveCount(2);
  await expect(page.locator('.bar-planche-rang').first().locator('.bar-place')).toHaveCount(6);
  await expect(page.getByRole('button', { name: /Whisky Test, reste ¼/ })).toBeVisible();
  await expect(page.locator('.bar-groupe').nth(1).locator('.bar-nom')).toHaveText(['Whisky Test', 'Whisky Test']);
  await expect(page.locator('.bar-groupe').nth(1).locator('.bar-niveau')).toHaveText(['¼', 'Pleine']);
  // La forme choisie dans la fiche est dessinée
  const formeNikka = await page.evaluate(async () => (await import('/core/ui/etagere.js')).FORMES.ronde.contour);
  await expect(page.locator(`.bar-groupe:nth-child(3) path[d="${formeNikka}"]`).first()).toBeAttached();
  // Recherche et sélection
  await page.getByLabel('Chercher un vin dans ce rangement').fill('whisky');
  await expect(page.locator('.bar-halo')).toHaveCount(2);
  await page.getByRole('button', { name: /reste ¼/ }).click();
  await expect(page.locator('.bar-halo')).toHaveCount(1);
  await expect(page.locator('.bouteille-choisie')).toContainText('Écosse · reste ¼ · ≈ 4 verres');
  // Autres regroupements
  await page.getByRole('button', { name: 'Niveau', exact: true }).click();
  await expect(page.locator('.bar-entete strong')).toHaveText(['Entamées', 'Pleines']);
  await page.getByRole('button', { name: 'Catégorie', exact: true }).click();
  await expect(page.locator('.bar-entete strong')).toHaveCount(3);
});

test('S9-06 placard côté spiritueux : étagères par défaut (spiritueux seuls), bascule vers la liste', async ({ page }) => {
  await page.evaluate(async () => {
    const { creerStore } = await import('/core/store.js');
    const s = creerStore('cave');
    for (const b of (await s.list('bouteilles')).filter((x) => x.produit_id === window.ids.whisky)) await s.put('bouteilles', { ...b, rangement_id: window.ids.etagere });
  });
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await page.goto(`./#/rangement/${await id(page, 'etagere')}`);
  await expect(page.locator('.bar-entete strong')).toHaveText(['Écosse']);
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(page.locator('.liste-simple')).toContainText('Whisky Test');
  await page.getByRole('button', { name: 'Étagères', exact: true }).click();
  await expect(page.locator('.bar')).toBeVisible();
  await expect(page.getByText('+ 3 bouteilles de vin ici (voir la liste).')).toBeVisible();
});

test('S9-02 forme de la bouteille choisie dans la fiche (création et modification)', async ({ page }) => {
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await page.goto(`./#/produit/${await id(page, 'whisky')}/modifier`);
  await expect(page.locator('.formes button[aria-pressed="true"]')).toHaveText('Haute');
  await page.locator('.formes button[data-forme="carafe"]').click();
  await expect(page.locator('.formes button[aria-pressed="true"]')).toHaveText('Carafe');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/#\/fiche\//);
  const forme = await page.evaluate(async (x) => (await (await import('/core/store.js')).creerStore('cave').get('produits', x)).extra.forme, await id(page, 'whisky'));
  expect(forme).toBe('carafe');
  await page.goto('./#/produit/nouveau');
  await expect(page.locator('.formes button')).toHaveCount(6);
});

test('S8-02 création d\u2019un rangement : types et collection selon le profil', async ({ page }) => {
  await page.goto('./#/rangements');
  await page.locator('[data-profil-choix="spiritueux"]').click();
  await expect(page.locator('select[name="type"]')).toHaveValue('bar');
  const types = await page.locator('select[name="type"] option').allTextContents();
  expect(types).toContain('Bar');
  expect(types).not.toContain('Casier Montrouge (connecté)');
  await expect(page.locator('select[name="profil"]')).toHaveValue('spiritueux');
  await expect(page.locator('input[name="lignes"]')).toBeHidden(); // le bar n'a pas de grille
  await page.getByLabel('Nom').fill('Vitrine salon');
  await page.locator('select[name="type"]').selectOption('vitrine');
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page.getByText('Vitrine salon')).toBeVisible();
  await page.locator('[data-profil-choix="vin"]').click();
  await expect(page.getByText('Vitrine salon')).toHaveCount(0);
});
