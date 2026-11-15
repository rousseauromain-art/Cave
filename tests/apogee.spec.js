// S4 : apogée (table et saisie), phases, aération Aveine, écran Ce soir, service, diagnostic.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

test('S4-01 phases et estimation par la table', async () => {
  const { phase, estimer } = await import(pathToFileURL(path.join(__dirname, '../core/apogee.js')).href);
  expect(phase(2021, 2024, 2020)).toBe('jeunesse');
  expect(phase(2021, 2024, 2024)).toBe('apogee');
  expect(phase(2021, 2024, 2026)).toBe('declin');
  expect(phase(null, null, 2026)).toBeNull();
  const table = { 'France > Rhône > Côtes du Rhône Villages': { Rouge: [2, 5], Blanc: [1, 3] }, 'France > Bourgogne > Meursault': { Blanc: [3, 10] } };
  expect(estimer({ millesime: 2018, appellation: 'Côtes du Rhône Villages', style: 'rouge' }, table)).toMatchObject({ debut: 2020, fin: 2023 });
  expect(estimer({ millesime: 2019, appellation: 'meursault', style: 'blanc' }, table)).toMatchObject({ debut: 2022, fin: 2029 });
  expect(estimer({ appellation: 'Meursault', style: 'blanc' }, table)).toBeNull(); // sans millésime, rien
});

test('S11-01 apogée : appellation approchée, région, fenêtre générique, entrées vides ignorées', async () => {
  const { estimer, prerequis } = await import(pathToFileURL(path.join(__dirname, '../core/apogee.js')).href);
  const table = {
    'France > Rhône > Ventoux': { Rouge: [2, 5] }, 'France > Rhône > Gigondas': { Rouge: [5, 15] }, 'France > Rhône > Vacqueyras': { Rouge: [4, 10] },
    'Italie > Abruzzo > Ortona': { Rouge: [null, null] }
  };
  expect(estimer({ millesime: 2019, appellation: 'AOP Ventoux', style: 'rouge' }, table)).toMatchObject({ debut: 2021, fin: 2024, precision: 'appellation' });
  expect(estimer({ millesime: 2019, appellation: 'Ventoux rouge', style: 'rouge' }, table)).toMatchObject({ debut: 2021, precision: 'appellation' });
  expect(estimer({ millesime: 2019, region: 'Rhône', style: 'rouge' }, table)).toMatchObject({ debut: 2023, fin: 2029, precision: 'region' });
  expect(estimer({ millesime: 2019, appellation: 'Ortona', style: 'rouge' }, table)).toMatchObject({ debut: 2022, fin: 2027, precision: 'generique' });
  expect(estimer({ millesime: 2019, style: 'blanc' }, table)).toMatchObject({ debut: 2020, fin: 2023, precision: 'generique' });
  const l = prerequis({ millesime: null, style: 'rouge', styleInfo: { titre: 'Rouge' } }, 'apogee');
  expect(l[0]).toMatchObject({ libelle: 'Millésime', ok: false, requis: true });
  expect(prerequis({}, 'aeration')[0]).toMatchObject({ libelle: 'Couleur', ok: false, requis: true });
});

test('S4-02 aération : règle, bornes, effervescents, plafond Essentiel', async () => {
  const { aeration } = await import(pathToFileURL(path.join(__dirname, '../core/apogee.js')).href);
  expect(aeration({ style: 'rouge', phase: 'jeunesse', tanins: 70 })).toBe(12);   // 6 × 1,5 × 1,3
  expect(aeration({ style: 'rouge', phase: 'apogee', tanins: 50 })).toBe(7);      // 6 × 1 × 1,1 = 6,6
  expect(aeration({ style: 'rouge', phase: 'declin', tanins: 73 })).toBe(2);      // 6 × 0,25 × 1,33 = 2
  expect(aeration({ style: 'blanc', phase: 'declin', tanins: 20 })).toBe(1);      // minimum 1 h
  expect(aeration({ style: 'champagne', phase: 'apogee' })).toBe(0);
  expect(aeration({ style: 'rouge', phase: 'jeunesse', tanins: 95, preference: 1.3, hmax: 12 })).toBe(12);
});

test.describe('écrans', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
    await page.goto('./#/cave');
    await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      const { ajouterBouteilles } = await import('/core/inventaire.js');
      const s = creerStore('cave');
      const an = new Date().getFullYear();
      const vin = async (o, n = 1) => { const p = await s.put('produits', { profil: 'vin', style: 'rouge', ...o }); await ajouterBouteilles(s, p.id, n); return p; };
      window.ids = {
        vieux: (await vin({ nom: 'Vieux Rouge', millesime: an - 12, apogee_debut: an - 8, apogee_fin: an - 3 })).id,
        pret: (await vin({ nom: 'Rouge Prêt', millesime: an - 5, apogee_debut: an - 2, apogee_fin: an + 3 })).id,
        jeune: (await vin({ nom: 'Jeune Rouge', millesime: an - 1, apogee_debut: an + 3, apogee_fin: an + 10 })).id,
        table: (await vin({ nom: 'Par la Table', millesime: 2018, appellation: 'Côtes du Rhône Villages' })).id,
        bulles: (await vin({ nom: 'Bulles', style: 'champagne' })).id
      };
      await s.put('produits', { profil: 'vin', nom: 'Sans Stock', style: 'rouge', millesime: an - 20, apogee_debut: an - 15, apogee_fin: an - 10 });
    });
  });

  test('S4-03 Ce soir : déclin d’abord, puis apogée, inconnue, jeunes ; sans stock exclu', async ({ page }) => {
    await page.goto('./#/ce-soir');
    const titres = await page.locator('.groupe-ce-soir h2').allTextContents();
    expect(titres.map((t) => t.split(' ·')[0])).toEqual(['À boire sans attendre', 'À leur apogée', 'Apogée inconnue', 'Encore jeunes']);
    const declin = page.locator('.groupe-ce-soir').first();
    await expect(declin).toContainText('Vieux Rouge');
    await expect(declin).toContainText('Par la Table'); // 2018 + table CDR Villages [2, 6] → déclin en 2026
    await expect(page.locator('#vue')).not.toContainText('Sans Stock');
  });

  test('S4-04 fiche : courbe, statut, estimation retenue, aération et service', async ({ page }) => {
    const id = await page.evaluate(() => window.ids.table);
    await page.goto(`./#/fiche/${id}`);
    const apogee = page.locator('[data-section="apogee"]');
    await expect(apogee.locator('svg.courbe')).toBeVisible();
    await expect(apogee.locator('.section-resume')).toHaveText('Déclin');
    await expect(apogee).toContainText("Estimation — Table d'apogée Caveasy : France > Rhône > Côtes du Rhône Villages");
    await apogee.getByRole('button', { name: /^Retenir 20\d\d–20\d\d$/ }).click();
    await expect(page.locator('[data-section="apogee"]')).toContainText('Retenue — Table');
    await page.locator('[data-section="aeration"] summary').click();
    await expect(page.locator('[data-section="aeration"] .section-resume')).toHaveText('2 h');
    await page.getByRole('link', { name: 'Préparer le service' }).click();
    await page.getByLabel('Heure de service').fill('21:30');
    await expect(page.locator('.service')).toContainText('Lancer l’Aveine à');
    await expect(page.locator('.service')).toContainText('19:30');
    await expect(page.locator('.service')).toContainText('16–18 °C');
  });

  test('S4-05 effervescent : pas d’aération ; réglage Essentiel et préférence', async ({ page }) => {
    const bulles = await page.evaluate(() => window.ids.bulles);
    await page.goto(`./#/fiche/${bulles}`);
    await page.locator('[data-section="aeration"] summary').click();
    await expect(page.locator('[data-section="aeration"]')).toContainText('Pas d’aération');
    await page.goto('./#/reglages');
    await page.locator('[data-carte="service"] select[name="modele"]').selectOption('essentiel');
    await page.locator('[data-carte="service"] select[name="preference"]').selectOption('1.3');
    const jeune = await page.evaluate(() => window.ids.jeune);
    await page.goto(`./#/servir/${jeune}`);
    await expect(page.locator('.service')).toContainText('12 h'); // 6 × 1,5 × 1,1 × 1,3 = 12,9 → plafonné à 12 h (Essentiel)
    await expect(page.locator('.service')).toContainText('Aveine Essentiel');
  });

  test('S4-06 diagnostic : environnement et journal dans les Réglages', async ({ page }) => {
    await page.goto('./#/reglages');
    await page.locator('[data-carte="diagnostic"] summary').click();
    await expect(page.locator('[data-carte="diagnostic"]')).toContainText('Version');
    await expect(page.getByRole('button', { name: 'Exporter le journal' })).toBeVisible();
  });

  test('S11-02 fiche : informations requises affichées, calcul dès qu’elles sont saisies, Recalculer', async ({ page }) => {
    const pid = await page.evaluate(async () => (await (await import('/core/store.js')).creerStore('cave').put('produits', { profil: 'vin', nom: 'La Rabassière' })).id);
    await page.goto(`./#/fiche/${pid}`);
    const apogee = page.locator('[data-section="apogee"]');
    await expect(apogee.locator('.section-resume')).toHaveText('à compléter');
    await expect(apogee.locator('.prerequis li.requis')).toContainText('Millésime : obligatoire');
    await expect(page.locator('[data-section="aeration"] .section-resume')).toHaveText('à compléter');
    await page.locator('[data-section="aeration"]').evaluate((d) => { d.open = true; });
    await expect(page.locator('[data-section="aeration"] .prerequis li.requis')).toContainText('Couleur : obligatoire');
    // Compléter la fiche : millésime, couleur, appellation libellée « AOP Ventoux »
    await apogee.getByRole('link', { name: 'Compléter la fiche' }).click();
    await page.getByLabel('Millésime').fill('2019');
    await page.locator('select[name="style"]').selectOption('rouge');
    await page.getByLabel('Appellation').fill('AOP Ventoux');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/#\/fiche\//);
    await expect(apogee).toContainText('France > Rhône > Ventoux');
    await expect(apogee.locator('.prerequis li.ok')).toHaveCount(3);
    await expect(page.locator('[data-section="aeration"] .section-resume')).toHaveText(/\d+ h/);
    // Années enregistrées à la main → Recalculer revient au calcul
    await page.evaluate(async (x) => { const s = (await import('/core/store.js')).creerStore('cave'); const p = await s.get('produits', x); await s.put('produits', { ...p, apogee_debut: 2030, apogee_fin: 2040 }); }, pid);
    await page.reload();
    await expect(apogee).toContainText('Années saisies dans la fiche.');
    await apogee.getByRole('button', { name: /^Recalculer \(20\d\d–20\d\d\)$/ }).click();
    await expect(apogee).toContainText('Estimation — Table');
  });
});
