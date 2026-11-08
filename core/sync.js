// Moteur de synchronisation, indépendant de Supabase : il parle à un « adaptateur »
// { utilisateur(), pousser(table, lignes), tirer(table, depuis, max), envoyerPhoto(chemin, blob), telechargerPhoto(chemin) }.
// Ordre : envoi des lignes locales modifiées, puis réception des lignes serveur plus récentes que le curseur.
import { ORDRE, versServeur } from './schema.js';

const PAQUET = 500;
const DEBUT = '1970-01-01T00:00:00Z';

export function creerSynchro({ store, adaptateur, notifier = () => {}, delai = 5000 }) {
  let etat = { etat: 'deconnecte', detail: '', derniere: null };
  let enCours = null;
  let relancer = false;
  let minuterie = null;

  function changer(nouveau) {
    etat = { ...etat, ...nouveau };
    notifier(etat);
  }

  async function executer() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      changer({ etat: 'hors-ligne', detail: 'Pas de réseau : les modifications partiront au retour du réseau.' });
      return etat;
    }
    let utilisateur;
    try {
      utilisateur = await adaptateur.utilisateur();
    } catch (e) {
      return echec(e);
    }
    if (!utilisateur) {
      changer({ etat: 'deconnecte', detail: 'Connectez-vous pour activer la sauvegarde.' });
      return etat;
    }
    changer({ etat: 'en-cours', detail: 'Synchronisation…' });
    try {
      let envoyees = 0, recues = 0;
      for (const t of ORDRE) {
        const sales = await store.sales(t);
        for (let i = 0; i < sales.length; i += PAQUET) {
          const lot = sales.slice(i, i + PAQUET);
          await adaptateur.pousser(t, lot.map((l) => ({ ...versServeur(t, l), user_id: utilisateur.id })));
          await store.marquerPropres(t, lot);
          envoyees += lot.length;
        }
      }
      for (const p of await store.photosSales()) {
        await adaptateur.envoyerPhoto(cheminPhoto(utilisateur.id, p.id), p.blob);
        await store.photoPropre(p.id);
      }
      for (const t of ORDRE) {
        let curseur = (await store.meta(`curseur.${t}`)) || DEBUT;
        for (;;) {
          const lignes = await adaptateur.tirer(t, curseur, PAQUET);
          if (!lignes.length) break;
          recues += await store.appliquerDistant(t, lignes);
          curseur = lignes[lignes.length - 1].sync_at;
          await store.meta(`curseur.${t}`, curseur);
          if (lignes.length < PAQUET) break;
        }
      }
      await recupererPhotos(utilisateur.id);
      const derniere = new Date().toISOString();
      await store.meta('derniere_synchro', derniere);
      changer({ etat: 'ok', detail: `${envoyees} envoyée(s), ${recues} reçue(s)`, derniere });
      return etat;
    } catch (e) {
      return echec(e);
    }
  }

  async function recupererPhotos(uid) {
    for (const p of await store.list('produits')) {
      if (!p.photo_path || (await store.photo(p.id))) continue;
      const blob = await adaptateur.telechargerPhoto(p.photo_path || cheminPhoto(uid, p.id));
      if (blob) await store.enregistrerPhoto(p.id, blob, { distante: true });
    }
  }

  async function echec(e) {
    const message = e?.message || String(e);
    await store.journaliser('erreur', `Synchro : ${message}`).catch(() => {});
    const horsLigne = /fetch|network|réseau|Failed to/i.test(message);
    changer({ etat: horsLigne ? 'hors-ligne' : 'erreur', detail: message });
    return etat;
  }

  const api = {
    etat: () => etat,

    // Une seule synchro à la fois ; une demande pendant l'exécution relance un tour à la fin.
    async synchroniser() {
      if (enCours) { relancer = true; return enCours; }
      enCours = (async () => {
        let r;
        do { relancer = false; r = await executer(); } while (relancer);
        return r;
      })();
      try { return await enCours; } finally { enCours = null; }
    },

    planifier(ms = delai) {
      clearTimeout(minuterie);
      if (etat.etat !== 'deconnecte' && etat.etat !== 'en-cours') changer({ etat: 'attente', detail: 'Modifications en attente d’envoi' });
      minuterie = setTimeout(() => api.synchroniser(), ms);
    }
  };
  return api;
}

export function cheminPhoto(uid, produitId) {
  return `${uid}/${produitId}.jpg`;
}
