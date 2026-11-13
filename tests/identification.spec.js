// S2 : identification d'étiquette (OCR.space simulé), rapprochement avec la cave, clés locales, reprise des clés v9.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const fichier = (n) => pathToFileURL(path.join(__dirname, '..', n)).href;

test.describe('analyse sans navigateur', () => {
  test('S2-01 texte OCR → nom, domaine, appellation, millésime, couleur', async () => {
    const { analyserTexte } = await import(fichier('core/identification.js'));
    const index = [{ k: 'France > Rhône > Côtes du Rhône Villages', dernier: 'cotes du rhone villages' }, { k: 'France > Bourgogne > Meursault', dernier: 'meursault' }];
    const r = analyserTexte([
      { texte: 'DOMAINE DE PEYRE BRUNE', hauteur: 30 },
      { texte: 'Les Cades', hauteur: 60 },
      { texte: 'CÔTES DU RHÔNE VILLAGES', hauteur: 22 },
      { texte: 'Appellation contrôlée', hauteur: 12 },
      { texte: '2019 Vin rouge', hauteur: 18 },
      { texte: '14,5 % vol', hauteur: 10 }
    ], index, 2026);
    expect(r).toMatchObject({ nom: 'Les Cades', producteur: 'DOMAINE DE PEYRE BRUNE', appellation: 'Côtes du Rhône Villages', millesime: 2019, style: 'rouge', degre: 14.5 });
  });

  test('S2-02 réponse IA → fiche vin et fiche spiritueux', async () => {
    const { versProduit } = await import(fichier('core/identification.js'));
    expect(versProduit({ nom: 'Les Cades', domaine: 'Peyre Brune', pays: 'France', millesime: '2019', couleur: 'rosé', cepages: ['grenache', 'syrah'], garde_de: 2021, garde_a: '2024' }, 'vin', 'Gemini'))
      .toMatchObject({ nom: 'Les Cades', producteur: 'Peyre Brune', pays: 'FR', millesime: 2019, style: 'rose', cepages: 'grenache, syrah', apogee_debut: 2021, apogee_fin: 2024 });
    expect(versProduit({ nom: 'Armorik Classic', distillerie: 'Warenghem', pays: 'Bretagne', categorie: 'malt', age: '', degre: '46' }, 'spiritueux', 'Claude'))
      .toMatchObject({ nom: 'Armorik Classic', producteur: 'Warenghem', pays: 'BZH', style: 'malt', degre: 46, age_ans: null });
  });

  test('S2-03 rapprochement avec la cave', async () => {
    const { rapprocher } = await import(fichier('core/identification.js'));
    const cave = [{ id: 'a', nom: 'La Grise', appellation: 'Côtes du Rhône Villages', millesime: 2018 }, { id: 'b', nom: 'Meursault Perrières', millesime: 2019 }, { id: 'c', nom: 'Grise de Provence' }];
    expect(rapprocher({ nom: 'LA GRISE', texte: 'la grise cotes du rhone villages 2018', millesime: 2018 }, cave).map((p) => p.id)).toEqual(['a', 'c']);
    expect(rapprocher({ nom: 'Inconnu total', texte: '' }, cave)).toEqual([]);
  });

  test('S9-03 Minervois : cépages, domaine « Famille de », contenance, couleur déduite, profil vin', async () => {
    const { analyserTexte, profilProbable, trouverCepages } = await import(fichier('core/identification.js'));
    const r = analyserTexte([
      { texte: 'SYRAH · GRENACHE', hauteur: 14 }, { texte: 'MINERVOIS', hauteur: 40 }, { texte: 'APPELLATION D’ORIGINE PROTÉGÉE', hauteur: 10 },
      { texte: 'La Combe des Bories', hauteur: 24 }, { texte: 'Famille de', hauteur: 14 }, { texte: 'Lorgeril', hauteur: 30 }, { texte: '1620', hauteur: 8 }, { texte: '75cl', hauteur: 8 }
    ], [{ k: 'France > Languedoc-Roussillon > Minervois', dernier: 'minervois' }], 2026);
    expect(r).toMatchObject({ nom: 'La Combe des Bories', producteur: 'Famille de Lorgeril', appellation: 'Minervois', cepages: 'Syrah, Grenache', style: 'rouge', styleDeduit: true, volume_cl: 75 });
    expect(r.texte.split('\n')).toHaveLength(8);
    expect(profilProbable(r.texte, { appellation: r.appellation })).toBe('vin');
    expect(profilProbable('Single Malt Scotch Whisky 46 % vol')).toBe('spiritueux');
    expect(profilProbable('Bonjour')).toBeNull();
    expect(trouverCepages('Grenache blanc et grenache noir, Syrah').map((c) => c.nom)).toEqual(['Grenache Blanc', 'Grenache', 'Syrah']);
  });

  test('S9-04 rapprochement : les mots courants (famille, réserve…) ne suffisent pas', async () => {
    const { rapprocher } = await import(fichier('core/identification.js'));
    const cave = [{ id: 'eddu', nom: 'Eddu Sélection Famille Le Lay #2' }, { id: 'jm', nom: 'Rhum J.M Réserve Famille' }];
    expect(rapprocher({ nom: 'La Combe des Bories', producteur: 'Famille de Lorgeril', texte: 'Famille de Lorgeril Réserve' }, cave)).toEqual([]);
  });
});

test.describe('écran Scanner', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
    await page.goto('./');
    await page.evaluate(async () => {
      localStorage.clear();
      await new Promise((ok) => { const r = indexedDB.deleteDatabase('cave'); r.onsuccess = r.onerror = r.onblocked = ok; });
    });
  });

  test('S2-04 photo → OCR.space → vin reconnu dans la cave, ou fiche préremplie avec la photo', async ({ page }) => {
    let requetes = 0;
    await page.route('https://api.ocr.space/**', (route) => {
      requetes++;
      route.fulfill({ json: { ParsedResults: [{ TextOverlay: { Lines: [
        { Words: [{ WordText: 'Domaine', Height: 20 }, { WordText: 'Fictif', Height: 20 }] },
        { Words: [{ WordText: 'Grande', Height: 60 }, { WordText: 'Cuvée', Height: 60 }] },
        { Words: [{ WordText: '2018', Height: 18 }] }
      ] } }] } });
    });
    // Un vin déjà en cave qui doit être reconnu
    await page.goto('./#/cave');
    await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      await creerStore('cave').put('produits', { profil: 'vin', nom: 'Grande Cuvée', producteur: 'Domaine Fictif', millesime: 2018 });
    });
    await page.goto('./#/scanner');
    await page.locator('#photo-scan').setInputFiles(path.join(__dirname, '../icons/icone-192.png'));
    await expect(page.getByRole('status').filter({ hasText: 'Lu par OCR.space' })).toBeVisible();
    expect(requetes).toBe(1);
    await expect(page.getByText('Grande Cuvée', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Déjà dans votre cave ?' })).toBeVisible();
    await page.getByRole('button', { name: 'Créer la fiche de ce vin' }).click();
    await expect(page).toHaveURL(/#\/produit\/nouveau$/);
    await expect(page.getByText('Prérempli par OCR.space')).toBeVisible();
    await expect(page.getByLabel('Nom *')).toHaveValue('Grande Cuvée');
    await expect(page.getByLabel('Millésime')).toHaveValue('2018');
    await expect(page.locator('.apercu-photo img')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    // Le vin existe déjà : la fiche existante est proposée ; un second Enregistrer crée quand même la fiche.
    await expect(page.getByRole('link', { name: 'ouvrir sa fiche pour ajouter des bouteilles' })).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.fiche-photo img')).toBeVisible();
  });

  test('S2-05 clés : reprises de l’ancienne app, enregistrées localement, jamais exportées', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('caveasy_state', JSON.stringify({ ocrKey: 'K8ancienne1234', provider: 'ocrspace', wines: {} })));
    await page.goto('./#/reglages');
    await expect(page.locator('input[name="ocrKey"]')).toHaveValue('K8ancienne1234');
    await expect(page.locator('select[name="fournisseur"]')).toHaveValue('ocrspace');
    await page.locator('input[name="geminiKey"]').fill('AIza-test-5678');
    await page.getByRole('button', { name: 'Enregistrer les clés' }).click();
    await expect(page.getByText('Enregistré sur cet appareil.')).toBeVisible();
    const exporte = await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      return JSON.stringify(await creerStore('cave').exporter());
    });
    expect(exporte).not.toContain('AIza-test-5678');
    expect(exporte).not.toContain('K8ancienne1234');
  });

  test('S2-06 échec de tous les services : message clair, rien ne casse', async ({ page }) => {
    await page.route('https://api.ocr.space/**', (r) => r.abort());
    await page.goto('./#/scanner');
    await page.locator('#photo-scan').setInputFiles(path.join(__dirname, '../icons/icone-192.png'));
    await expect(page.getByRole('status').filter({ hasText: 'Identification impossible' })).toBeVisible();
  });

  test('S9-05 vin scanné en Spiritueux : bascule en Vins, cépages, verso, texte conservé dans la fiche', async ({ page }) => {
    const lignes = (l) => ({ json: { ParsedResults: [{ TextOverlay: { Lines: l.map(([t, hh]) => ({ Words: t.split(' ').map((w) => ({ WordText: w, Height: hh })) })) } }] } });
    let n = 0;
    await page.route('https://api.ocr.space/**', (route) => route.fulfill(++n === 1
      ? lignes([['SYRAH · GRENACHE', 14], ['MINERVOIS', 40], ['La Combe des Bories', 24], ['Famille de', 14], ['Lorgeril', 30], ['75cl', 8]])
      : lignes([['Un vin aux arômes de fruits noirs et d’épices.', 12], ['A servir à 16 °C.', 12], ['13,5 % vol', 10]])));
    await page.goto('./#/cave');
    await page.locator('[data-profil-choix="spiritueux"]').click();
    await page.goto('./#/scanner');
    await page.locator('#photo-scan').setInputFiles(path.join(__dirname, '../icons/icone-192.png'));
    await expect(page.locator('.bandeau-info')).toContainText('C’est un vin');
    await expect(page.locator('html')).toHaveAttribute('data-profil', 'vin');
    await expect(page.locator('.champs-lus')).toContainText('Famille de Lorgeril');
    await expect(page.locator('.champs-lus')).toContainText('(déduit des cépages)');
    await expect(page.locator('.cepages-lus .puce-mot')).toHaveText(['Syrah', 'Grenache']);
    await expect(page.getByText('Aucun vin ressemblant dans votre cave.')).toBeVisible();
    await page.locator('#photo-verso').setInputFiles(path.join(__dirname, '../icons/icone-192.png'));
    await expect(page.getByRole('status').filter({ hasText: 'Verso lu par OCR.space' })).toBeVisible();
    await expect(page.locator('.champs-lus')).toContainText('13.5 %');
    await page.getByRole('button', { name: 'Créer la fiche de ce vin' }).click();
    await expect(page.getByLabel('Cépages')).toHaveValue('Syrah, Grenache');
    await expect(page.getByLabel('Notes')).toHaveValue(/fruits noirs/);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/#\/fiche\//);
    await expect(page.locator('.cepages-fiche .puce-mot')).toHaveText(['Syrah', 'Grenache']);
    await page.locator('[data-section="texte-lu"] summary, details:has-text("Texte de l’étiquette") summary').first().click();
    await expect(page.locator('.texte-etiquette')).toContainText('MINERVOIS');
    await expect(page.locator('.texte-etiquette')).toContainText('— Verso —');
  });
});
