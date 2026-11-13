// Sauvegarde : branche le stockage local sur Supabase, affiche l'état et la carte « Sauvegarde » des Réglages.
import { remplacer } from './ui/dom.js';
import { creerStore } from './store.js';
import { creerSynchro } from './sync.js';
import { adaptateurSupabase, sessionMemorisee } from './supabase.js';
import { emettre, sur } from './evenements.js';
import { h, vider, icone } from './ui/dom.js';
import { etatAncienneApp, estFormatV9, importerV9 } from './import-v9.js';
import { estFormatPhotos, importerPhotos } from './import-photos.js';

const LIBELLES = {
  ok: 'Sauvegardé',
  attente: 'En attente d’envoi',
  'en-cours': 'Synchronisation…',
  'hors-ligne': 'Hors ligne',
  erreur: 'Erreur de sauvegarde',
  deconnecte: 'Sauvegarde désactivée'
};

function bilanV9(b) {
  return `${b.vins} vin(s) repris, ${b.photos} photo(s), ${b.bouteilles} bouteille(s) placée(s) dans le casier${b.deja ? `, ${b.deja} déjà présent(s)` : ''}.`;
}

const NUAGE = '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5z"/>';

export function initialiserSauvegarde({ adaptateur = adaptateurSupabase } = {}) {
  const store = creerStore('cave', { notifier: (d) => emettre('donnees', d) });
  const synchro = creerSynchro({ store, adaptateur, notifier: (e) => emettre('sync', e) });

  sur('donnees', (d) => { if (!d.distant) synchro.planifier(); });
  addEventListener('online', () => synchro.planifier(0));
  addEventListener('offline', () => emettre('sync', { ...synchro.etat(), etat: 'hors-ligne', detail: 'Pas de réseau.' }));
  sur('sync', majIndicateurs);

  async function demarrer() {
    const retourLien = /access_token=|error_description=/.test(location.hash);
    if (!retourLien && !sessionMemorisee()) return;
    try {
      await adaptateur.utilisateur(); // consomme le jeton du lien magique s'il est dans l'URL
      adaptateur.surChangementSession?.((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') synchro.synchroniser(); });
    } catch (e) {
      emettre('sync', { etat: 'hors-ligne', detail: e.message });
    }
    if (retourLien) history.replaceState(null, '', location.pathname + '#/reglages');
    synchro.synchroniser();
  }

  function indicateur() {
    const e = synchro.etat();
    const lien = h('a', {
      href: '#/reglages', class: 'bouton-rond indicateur-sync', 'data-sync-etat': e.etat,
      'aria-label': `Sauvegarde : ${LIBELLES[e.etat]}`
    });
    lien.append(icone(NUAGE, 20), h('span', { class: 'point' }));
    return lien;
  }

  function majIndicateurs(e) {
    document.querySelectorAll('[data-sync-etat]').forEach((el) => {
      el.dataset.syncEtat = e.etat;
      if (el.classList.contains('indicateur-sync')) el.setAttribute('aria-label', `Sauvegarde : ${LIBELLES[e.etat]}`);
    });
    const statut = document.getElementById('statut-sync');
    if (statut) remplirStatut(statut, e);
  }

  function remplirStatut(el, e) {
    vider(el).append(
      h('span', { class: 'point', 'data-sync-etat': e.etat }),
      h('span', {}, h('strong', {}, LIBELLES[e.etat]), e.detail ? h('span', { class: 'discret' }, ' · ' + e.detail) : null)
    );
    if (e.derniere) el.append(h('span', { class: 'discret bloc' }, `Dernière synchro : ${new Date(e.derniere).toLocaleString('fr-FR')}`));
  }

  function carte(el) {
    const statut = h('p', { id: 'statut-sync', class: 'statut-sync', role: 'status' });
    const zoneCompte = h('div', { class: 'compte' });
    const message = h('p', { class: 'message', role: 'alert' });
    remplirStatut(statut, synchro.etat());

    const afficherConnexion = () => {
      const champ = h('input', { type: 'email', id: 'email-sync', required: true, autocomplete: 'email', placeholder: 'vous@exemple.fr' });
      const form = h('form', {
        class: 'connexion',
        onsubmit: async (ev) => {
          ev.preventDefault();
          message.textContent = 'Envoi du lien…';
          try {
            await adaptateur.connecter(champ.value.trim());
            message.textContent = `Lien envoyé à ${champ.value.trim()}. Ouvrez-le sur cet appareil.`;
          } catch (e) {
            message.textContent = `Connexion impossible : ${e.message}`;
          }
        }
      },
      h('label', { for: 'email-sync' }, 'Adresse e-mail'),
      champ,
      h('button', { type: 'submit', class: 'bouton principal' }, 'Recevoir le lien de connexion'));
      vider(zoneCompte).append(form);
    };

    const afficherConnecte = (u) => {
      vider(zoneCompte).append(
        h('p', {}, 'Connecté : ', h('strong', {}, u.email || u.id)),
        h('div', { class: 'boutons' },
          h('button', { type: 'button', class: 'bouton principal', onclick: () => synchro.synchroniser() }, 'Synchroniser maintenant'),
          h('button', {
            type: 'button', class: 'bouton', onclick: async () => {
              try { await adaptateur.deconnecter(); afficherConnexion(); } catch (e) { message.textContent = e.message; }
            }
          }, 'Se déconnecter')));
    };

    if (sessionMemorisee()) {
      zoneCompte.append(h('p', { class: 'discret' }, 'Vérification du compte…'));
      adaptateur.utilisateur().then((u) => (u ? afficherConnecte(u) : afficherConnexion())).catch(() => afficherConnexion());
    } else {
      afficherConnexion();
    }

    const fichier = h('input', {
      type: 'file', accept: 'application/json,.json', id: 'import-json', class: 'masque',
      onchange: async (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        try {
          const donnees = JSON.parse(await f.text());
          if (estFormatPhotos(donnees)) {
            const b = await importerPhotos(store, donnees);
            message.replaceChildren(`${b.associees} photo(s) associée(s)${b.introuvables.length ? ` ; sans fiche correspondante : ${b.introuvables.join(', ')}` : ''}. `, h('a', { href: '#/cave' }, 'Voir la cave'));
          } else if (estFormatV9(donnees)) {
            const b = await importerV9(store, donnees);
            remplacer(message, bilanV9(b), ' ', h('a', { href: '#/cave' }, 'Voir ma cave'));
          } else {
            const n = await store.importer(donnees);
            message.textContent = `${n} ligne(s) importée(s).`;
          }
          synchro.planifier(0);
        } catch (e) {
          message.textContent = `Import impossible : ${e.message}`;
        }
        ev.target.value = '';
      }
    });

    el.append(h('section', { class: 'carte' },
      h('h2', {}, 'Sauvegarde'),
      statut,
      zoneCompte,
      h('div', { class: 'boutons' },
        h('button', {
          type: 'button', class: 'bouton', onclick: async () => {
            const donnees = await store.exporter();
            const url = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 1)], { type: 'application/json' }));
            const a = h('a', { href: url, download: `cave-${donnees.exporte_le.slice(0, 10)}.export.json` });
            document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        }, 'Exporter (JSON)'),
        h('label', { for: 'import-json', class: 'bouton' }, 'Importer'),
        fichier),
      message));

    const ancien = etatAncienneApp();
    if (ancien) {
      const msg = h('p', { class: 'message', role: 'status' });
      el.append(h('section', { class: 'carte', 'data-carte': 'reprise' },
        h('h2', {}, 'Reprendre l\u2019ancienne app'),
        h('p', {}, `Cave Revival v9 a laissé ${Object.keys(ancien.wines).length} vin(s) et ${Object.keys(ancien.slots || {}).length} bouteille(s) en casier dans ce navigateur.`),
        h('button', {
          type: 'button', class: 'bouton principal', onclick: async () => {
            msg.textContent = 'Reprise en cours…';
            try {
              remplacer(msg, bilanV9(await importerV9(store, ancien)), ' ', h('a', { href: '#/cave' }, 'Voir ma cave'));
            } catch (e) { msg.textContent = `Reprise impossible : ${e.message}`; }
          }
        }, 'Reprendre vins, photos et casier'),
        h('p', { class: 'discret' }, 'Relançable sans doublon. Vos clés OCR/IA restent dans l\u2019ancienne page jusqu\u2019à la story S2.'),
        msg));
    }
  }

  return { store, synchro, demarrer, indicateur, carte };
}
