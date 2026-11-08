// S0-02 : stockage local, règle de fusion, synchronisation et restauration (faux serveur, sans réseau).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

test.describe('règle de fusion (sans navigateur)', () => {
  test('la modification la plus récente gagne, formats ISO mélangés', async () => {
    const { choisir } = await import(pathToFileURL(path.join(__dirname, '../core/fusion.js')).href);
    expect(choisir(null, { modifie_le: '2026-01-01T00:00:00Z' })).toBe('distant');
    expect(choisir({ modifie_le: '2026-01-01T10:00:00.000Z' }, { modifie_le: '2026-01-01T10:00:00.001+00:00' })).toBe('distant');
    expect(choisir({ modifie_le: '2026-01-01T12:00:00Z' }, { modifie_le: '2026-01-01T13:00:00+02:00' })).toBe('local');
    expect(choisir({ modifie_le: '2026-01-01T12:00:00Z' }, { modifie_le: '2026-01-01T12:00:00+00:00' })).toBe('local');
  });
});

test.describe('synchronisation entre appareils', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.evaluate(async () => {
      for (const n of ['test-a', 'test-b', 'test-c']) await new Promise((ok) => { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = ok; });
    });
  });

  test('ajout, modification, suppression, hors ligne puis restauration complète', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      const { creerSynchro } = await import('/core/sync.js');
      const { creerFauxServeur } = await import('/tests/outils/faux-serveur.js');
      const serveur = creerFauxServeur();
      const A = creerStore('test-a'), B = creerStore('test-b');
      const sA = creerSynchro({ store: A, adaptateur: serveur.adaptateur });
      const sB = creerSynchro({ store: B, adaptateur: serveur.adaptateur });
      const res = {};
      const pause = () => new Promise((ok) => setTimeout(ok, 5));

      // 1. Ajout sur A → visible sur B
      const p = await A.put('produits', { profil: 'vin', nom: 'La Grise 2018', style: 'rouge', pays: 'FR', note: 4 });
      await A.put('bouteilles', { produit_id: p.id, etat: 'stock' });
      res.etatA = (await sA.synchroniser()).etat;
      await sB.synchroniser();
      res.produitsB = (await B.list('produits')).map((x) => x.nom);
      res.bouteillesB = (await B.list('bouteilles')).length;
      res.salesA = (await A.sales('produits')).length;

      // 2. Modification sur B (plus récente) → gagne sur A
      await pause();
      const surB = await B.get('produits', p.id);
      await B.put('produits', { ...surB, note: 4.5 });
      await sB.synchroniser(); await sA.synchroniser();
      res.noteA = (await A.get('produits', p.id)).note;

      // 3. Suppression sur A → masquée sur B, conservée en base
      await pause();
      await A.remove('produits', p.id);
      await sA.synchroniser(); await sB.synchroniser();
      res.visiblesB = (await B.list('produits')).length;
      res.tousB = (await B.list('produits', { tous: true })).length;

      // 4. Hors ligne : la modification reste en attente puis part au retour du réseau
      serveur.etat.horsLigne = true;
      await A.put('rangements', { nom: 'Placard Rennes', type: 'placard' });
      res.etatHorsLigne = (await sA.synchroniser()).etat;
      res.attente = (await A.sales('rangements')).length;
      serveur.etat.horsLigne = false;
      await sA.synchroniser();
      res.apresRetour = (await A.sales('rangements')).length;

      // 5. Photo : envoyée par A, récupérée par un appareil neuf
      const blob = new Blob([new Uint8Array([255, 216, 255, 224])], { type: 'image/jpeg' });
      const p2 = await A.put('produits', { profil: 'spiritueux', nom: 'Armorik Classic', style: 'malt', pays: 'BZH', photo_path: 'u-1/x.jpg' });
      await A.put('produits', { ...(await A.get('produits', p2.id)), photo_path: `u-1/${p2.id}.jpg` });
      await A.enregistrerPhoto(p2.id, blob);
      await sA.synchroniser();
      res.photosServeur = serveur.photos.size;

      // 6. Restauration : appareil neuf → tout revient
      const C = creerStore('test-c');
      await creerSynchro({ store: C, adaptateur: serveur.adaptateur }).synchroniser();
      res.restaures = {
        produits: (await C.list('produits', { tous: true })).length,
        bouteilles: (await C.list('bouteilles')).length,
        rangements: (await C.list('rangements')).length,
        photo: !!(await C.photo(p2.id))
      };
      res.serveurUserIds = [...serveur.tables.produits.values()].every((l) => l.user_id === 'u-1');
      return res;
    });

    expect(r.etatA).toBe('ok');
    expect(r.produitsB).toEqual(['La Grise 2018']);
    expect(r.bouteillesB).toBe(1);
    expect(r.salesA).toBe(0);
    expect(r.noteA).toBe(4.5);
    expect(r.visiblesB).toBe(0);
    expect(r.tousB).toBe(1);
    expect(r.etatHorsLigne).toBe('hors-ligne');
    expect(r.attente).toBe(1);
    expect(r.apresRetour).toBe(0);
    expect(r.photosServeur).toBe(1);
    expect(r.restaures).toEqual({ produits: 2, bouteilles: 1, rangements: 1, photo: true });
    expect(r.serveurUserIds).toBe(true);
  });

  test('une modification locale faite pendant l’envoi n’est pas perdue', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      const { creerSynchro } = await import('/core/sync.js');
      const { creerFauxServeur } = await import('/tests/outils/faux-serveur.js');
      const serveur = creerFauxServeur();
      const A = creerStore('test-a');
      const p = await A.put('produits', { profil: 'vin', nom: 'Meursault' });
      const pousser = serveur.adaptateur.pousser;
      serveur.adaptateur.pousser = async (t, l) => { await pousser(t, l); if (t === 'produits') await A.put('produits', { ...(await A.get('produits', p.id)), note: 5 }); };
      await creerSynchro({ store: A, adaptateur: serveur.adaptateur }).synchroniser();
      return { encoreSale: (await A.sales('produits')).length, note: (await A.get('produits', p.id)).note };
    });
    expect(r).toEqual({ encoreSale: 1, note: 5 });
  });

  test('export puis import JSON sur un appareil vide', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { creerStore } = await import('/core/store.js');
      const A = creerStore('test-a'), B = creerStore('test-b');
      const p = await A.put('produits', { profil: 'vin', nom: 'Castillo Ygay 2012', pays: 'ES' });
      await A.put('bouteilles', { produit_id: p.id });
      const json = JSON.parse(JSON.stringify(await A.exporter()));
      const n = await B.importer(json);
      let erreur = null;
      try { await B.importer({ format: 'autre' }); } catch (e) { erreur = e.message; }
      return { n, noms: (await B.list('produits')).map((x) => x.nom), aEnvoyer: (await B.sales('produits')).length, erreur };
    });
    expect(r.n).toBe(2);
    expect(r.noms).toEqual(['Castillo Ygay 2012']);
    expect(r.aEnvoyer).toBe(1);
    expect(r.erreur).toContain('non reconnu');
  });
});

test.describe('écran Sauvegarde', () => {
  test('affiche la connexion et reste utilisable si Supabase est injoignable', async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.goto('./#/reglages');
    await expect(page.getByRole('heading', { name: 'Sauvegarde' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Sauvegarde :/ })).toBeVisible();
    await page.getByLabel('Adresse e-mail').fill('romain@example.fr');
    await page.getByRole('button', { name: 'Recevoir le lien de connexion' }).click();
    await expect(page.getByRole('alert')).toContainText('Connexion impossible');
    await expect(page.getByRole('button', { name: 'Exporter (JSON)' })).toBeVisible();
  });

  test('l’en-tête tient sur un écran de téléphone', async ({ page }) => {
    for (const route of ['#/degustations', '#/rangements', '#/reglages']) {
      await page.goto('./' + route);
      const largeur = await page.evaluate(() => document.querySelector('.entete').scrollWidth - document.querySelector('.entete').clientWidth);
      expect(largeur, route).toBeLessThanOrEqual(0);
    }
  });
});
