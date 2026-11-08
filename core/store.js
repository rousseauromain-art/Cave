// Stockage local IndexedDB : source de vérité de l'app, utilisable hors ligne.
// Chaque écriture locale horodate la ligne (modifie_le) et la marque « à envoyer » (_sale = 1).
import { ORDRE } from './schema.js';
import { choisir } from './fusion.js';

const VERSION_BASE = 1;

function promesse(req) {
  return new Promise((ok, ko) => { req.onsuccess = () => ok(req.result); req.onerror = () => ko(req.error); });
}

function ouvrir(nom) {
  return new Promise((ok, ko) => {
    const req = indexedDB.open(nom, VERSION_BASE);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const t of ORDRE) {
        if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' }).createIndex('_sale', '_sale');
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' }).createIndex('_sale', '_sale');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'cle' });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

export function creerStore(nom = 'cave', { notifier = () => {} } = {}) {
  const base = ouvrir(nom);

  async function magasin(table, mode = 'readonly') {
    return (await base).transaction(table, mode).objectStore(table);
  }
  const brut = {
    get: async (table, id) => promesse((await magasin(table)).get(id)),
    put: async (table, ligne) => promesse((await magasin(table, 'readwrite')).put(ligne)),
    tout: async (table) => promesse((await magasin(table)).getAll()),
    sales: async (table) => promesse((await magasin(table)).index('_sale').getAll(1))
  };

  const api = {
    nom,

    get: (table, id) => brut.get(table, id),

    async list(table, { tous = false } = {}) {
      const lignes = (await brut.tout(table)).map(sansMarque);
      return tous ? lignes : lignes.filter((l) => !l.supprime);
    },

    async put(table, objet) {
      const ligne = {
        ...objet,
        id: objet.id || crypto.randomUUID(),
        modifie_le: new Date().toISOString(),
        supprime: objet.supprime ?? false,
        _sale: 1
      };
      await brut.put(table, ligne);
      notifier({ table, id: ligne.id });
      return sansMarque(ligne);
    },

    async remove(table, id) {
      const actuelle = await brut.get(table, id);
      if (actuelle) await api.put(table, { ...actuelle, supprime: true });
    },

    sales: (table) => brut.sales(table),

    // Après envoi : ne marque propre que si la ligne n'a pas été modifiée entre-temps.
    async marquerPropres(table, envoyees) {
      for (const e of envoyees) {
        const actuelle = await brut.get(table, e.id);
        if (actuelle && actuelle.modifie_le === e.modifie_le) await brut.put(table, { ...actuelle, _sale: 0 });
      }
    },

    // Lignes reçues du serveur : appliquées si plus récentes que la copie locale.
    async appliquerDistant(table, lignes) {
      let appliquees = 0;
      for (const d of lignes) {
        if (choisir(await brut.get(table, d.id), d) === 'distant') {
          await brut.put(table, { ...d, _sale: 0 });
          appliquees++;
        }
      }
      if (appliquees) notifier({ table, distant: true });
      return appliquees;
    },

    async meta(cle, valeur) {
      if (valeur === undefined) return (await promesse((await magasin('meta')).get(cle)))?.valeur;
      await promesse((await magasin('meta', 'readwrite')).put({ cle, valeur }));
      return valeur;
    },

    async journaliser(niveau, message) {
      const journal = (await api.meta('journal')) || [];
      journal.unshift({ quand: new Date().toISOString(), niveau, message: String(message).slice(0, 500) });
      await api.meta('journal', journal.slice(0, 50));
    },

    // Photos d'étiquettes (Blob), synchronisées à part dans le bucket privé.
    photo: async (id) => (await promesse((await magasin('photos')).get(id)))?.blob ?? null,
    async enregistrerPhoto(id, blob, { distante = false } = {}) {
      await promesse((await magasin('photos', 'readwrite')).put({ id, blob, _sale: distante ? 0 : 1 }));
      if (!distante) notifier({ table: 'photos', id });
    },
    photosSales: async () => promesse((await magasin('photos')).index('_sale').getAll(1)),
    async photoPropre(id) {
      const p = await promesse((await magasin('photos')).get(id));
      if (p) await promesse((await magasin('photos', 'readwrite')).put({ ...p, _sale: 0 }));
    },

    // Sauvegarde manuelle : toutes les lignes, suppressions comprises (sans les photos).
    async exporter() {
      const tables = {};
      for (const t of ORDRE) tables[t] = await api.list(t, { tous: true });
      return { format: 'cave-export', version: 1, exporte_le: new Date().toISOString(), tables };
    },

    // Import : même règle que la synchro ; les lignes retenues sont marquées à envoyer.
    async importer(donnees) {
      if (donnees?.format !== 'cave-export') throw new Error('Fichier non reconnu (format cave-export attendu).');
      let n = 0;
      for (const t of ORDRE) {
        for (const l of donnees.tables?.[t] || []) {
          if (choisir(await brut.get(t, l.id), l) === 'distant') { await brut.put(t, { ...l, _sale: 1 }); n++; }
        }
      }
      if (n) notifier({ table: '*', distant: false });
      return n;
    },

    async fermer() { (await base).close(); }
  };
  return api;
}

function sansMarque(ligne) {
  if (!ligne) return ligne;
  const { _sale, ...reste } = ligne;
  return reste;
}
