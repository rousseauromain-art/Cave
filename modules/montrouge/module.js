// Casier Montrouge connecté : présence des bouteilles en direct, rapprochement avec l'inventaire, rangement assisté.
import { remplacer } from '../../core/ui/dom.js';
import { emplacement as rond } from '../../core/ui/badges.js';
import { inventaire, prochainNumero, EN_CAVE } from '../../core/inventaire.js';
import { creerCasier } from './ble.js';
import { differences, emplacement } from './protocole.js';

const INCONNU = { titre: 'Non identifiée', fond: 'var(--c-bord-fort)', texte: 'var(--c-texte)' };
const rappels = {};
let casier = null;
const masques = {}; // rangée → masque reçu du casier (survit à la navigation)
const enAttente = new Map(); // retraits en attente (effleurement < 3 s ignoré)

function obtenirCasier() {
  return casier || (casier = creerCasier({
    surRangee: (...a) => rappels.surRangee?.(...a), surStatut: (...a) => rappels.surStatut?.(...a), journal: (...a) => rappels.journal?.(...a)
  }));
}

async function ecran(core, el, { id }) {
  const { h } = core;
  const r = await core.store.get('rangements', id);
  if (!r) { el.append(h('p', {}, 'Casier introuvable.')); return; }
  core.titre(r.nom);
  let produits = new Map();
  let bouteilles = [];
  let aRanger = '';
  let ranges = 0;
  let selection = null;

  const statut = h('span', { class: 'etat-ble' });
  const message = h('p', { class: 'message-ble', role: 'status' });
  const grille = h('div', { class: 'carte grille-casier' });
  const panneau = h('div', { class: 'panneau-casier' });
  const mouvements = h('ol', { class: 'journal mouvements' });
  const bouton = h('button', { type: 'button', class: 'bouton principal' }, 'Connecter le casier');

  async function charger() {
    const tous = [...(await inventaire(core.store, 'vin')), ...(await inventaire(core.store, 'spiritueux'))];
    produits = new Map(tous.map((p) => [p.id, p]));
    bouteilles = (await core.store.list('bouteilles')).filter((b) => b.rangement_id === r.id && EN_CAVE.includes(b.etat));
  }

  const parEmplacement = () => new Map(bouteilles.filter((b) => b.emplacement).map((b) => [b.emplacement, b]));
  const present = (ligne, e) => masques[ligne] !== undefined ? !!(masques[ligne] & (1 << (e - 1))) : null;

  function dessiner() {
    const occupes = parEmplacement();
    const rangs = [];
    let ecarts = 0;
    for (let ligne = r.lignes; ligne >= 1; ligne--) {
      const cases = [];
      for (let e = 1; e <= r.colonnes; e++) {
        const cle = `R${ligne}-E${e}`, b = occupes.get(cle), capteur = present(ligne, e);
        let etat = b ? 'ok' : 'libre';
        if (capteur === true && !b) etat = 'inconnue';
        if (capteur === false && b) etat = 'retiree';
        if (etat === 'inconnue' || etat === 'retiree') ecarts++;
        const style = b ? produits.get(b.produit_id)?.styleInfo || INCONNU : INCONNU;
        const contenu = etat === 'libre' ? h('span', { class: 'emplacement libre' }) : etat === 'inconnue' ? h('span', { class: 'emplacement inconnue' }, '?') : rond(b.numero, style, { trouve: selection === cle });
        cases.push(h('button', {
          type: 'button', class: `case etat-${etat}`, 'data-emplacement': cle,
          'aria-label': `${cle} : ${{ ok: produits.get(b?.produit_id)?.nom, libre: 'libre', inconnue: 'bouteille posée non identifiée', retiree: `${produits.get(b?.produit_id)?.nom} absente du casier` }[etat]}`,
          onclick: () => { selection = cle; dessiner(); ouvrirPanneau(cle, etat, b); }
        }, contenu));
      }
      rangs.push(h('div', { class: 'rangee' }, h('span', { class: 'rangee-nom' }, `R${ligne}`), cases));
    }
    const connu = Object.keys(masques).length > 0;
    remplacer(grille,
      h('div', { class: 'grille-titre' }, h('strong', {}, 'Vue de face'),
        h('span', { class: 'discret' }, connu ? (ecarts ? `${ecarts} écart(s) entre le casier et l’app` : 'Casier et app en accord') : 'Connectez le casier pour voir les capteurs')),
      rangs,
      h('div', { class: 'legende-casier' },
        h('span', {}, h('span', { class: 'emplacement inconnue mini' }, '?'), ' posée, à identifier'),
        h('span', {}, h('span', { class: 'emplacement mini retiree-exemple' }), ' absente du casier')));
  }

  function ouvrirPanneau(cle, etat, b) {
    const p = b ? produits.get(b.produit_id) : null;
    const choix = h('select', { 'aria-label': 'Vin posé à cet emplacement' }, h('option', { value: '' }, 'Choisir le vin…'),
      [...produits.values()].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')).map((x) => h('option', { value: x.id }, [x.nom, x.millesime].filter(Boolean).join(' '))));
    const actions = {
      ok: [h('a', { href: `#/fiche/${p?.id}`, class: 'bouton' }, 'Voir la fiche')],
      libre: [h('p', { class: 'discret' }, 'Emplacement libre.')],
      inconnue: [choix, h('button', {
        type: 'button', class: 'bouton principal', onclick: async () => {
          if (!choix.value) return;
          await core.store.put('bouteilles', { produit_id: choix.value, rangement_id: r.id, emplacement: cle, numero: await prochainNumero(core.store), etat: 'stock', entree_le: new Date().toISOString().slice(0, 10) });
          await rafraichir();
        }
      }, 'C’est ce vin')],
      retiree: [
        h('button', { type: 'button', class: 'bouton principal', onclick: async () => { await core.store.put('bouteilles', { ...b, etat: 'bue', sortie_le: new Date().toISOString().slice(0, 10), emplacement: null }); await rafraichir(); } }, 'Bouteille bue'),
        h('button', { type: 'button', class: 'bouton', onclick: async () => { await core.store.put('bouteilles', { ...b, emplacement: null }); await rafraichir(); } }, 'Sortie du casier, encore en stock')]
    }[etat];
    remplacer(panneau, h('div', { class: 'carte' },
      h('strong', {}, `${cle} · ${p ? [p.nom, p.millesime].filter(Boolean).join(' ') : etat === 'inconnue' ? 'bouteille posée' : 'libre'}`),
      h('div', { class: 'boutons' }, actions)));
  }

  async function rafraichir() { await charger(); dessiner(); }

  function noter(texte) {
    remplacer(mouvements, h('li', {}, `${new Date().toLocaleTimeString('fr-FR')} · ${texte}`), ...[...mouvements.children].slice(0, 30));
  }

  Object.assign(rappels, {
    surStatut: (s) => {
      statut.textContent = { recherche: 'Recherche…', connexion: 'Connexion…', connecte: 'Connecté', deconnecte: 'Déconnecté' }[s];
      bouton.hidden = s === 'connecte' || s === 'connexion';
    },
    journal: (t) => core.store.journaliser('info', `Montrouge : ${t}`),
    surRangee: async (ligne, masque) => {
      if (ligne < 1 || ligne > r.lignes) return;
      const { poses, retires } = differences(masques[ligne] ?? masque, masque);
      const premier = masques[ligne] === undefined;
      masques[ligne] = masque;
      if (!premier) {
        for (const i of poses) {
          const cle = emplacement(ligne, i);
          if (enAttente.has(cle)) { clearTimeout(enAttente.get(cle)); enAttente.delete(cle); noter(`${cle} : bouteille reposée`); continue; }
          if (aRanger) {
            await core.store.put('bouteilles', { produit_id: aRanger, rangement_id: r.id, emplacement: cle, numero: await prochainNumero(core.store), etat: 'stock', entree_le: new Date().toISOString().slice(0, 10) });
            ranges++;
            noter(`${cle} : ${produits.get(aRanger)?.nom} rangée`);
            majSession();
          } else noter(`${cle} : bouteille posée, à identifier`);
        }
        for (const i of retires) {
          const cle = emplacement(ligne, i);
          noter(`${cle} : bouteille retirée`);
          // Un retrait de moins de 3 s est un simple effleurement.
          enAttente.set(cle, setTimeout(() => { enAttente.delete(cle); }, 3000));
        }
      }
      await rafraichir();
    }
  });

  const sc = obtenirCasier();
  bouton.hidden = sc.connecte();
  if (sc.connecte()) statut.textContent = 'Connecté';
  bouton.addEventListener('click', async () => {
    try { const nom = await sc.connecter(false); message.textContent = `${nom} connecté : posez ou retirez une bouteille, la grille suit.`; } catch (e) { message.textContent = e.name === 'NotFoundError' ? 'Aucun casier choisi.' : `Connexion impossible : ${e.message}`; }
  });

  const session = h('p', { class: 'discret' });
  const majSession = () => { session.textContent = aRanger ? `${ranges} bouteille(s) de ${produits.get(aRanger)?.nom} rangée(s) : posez-les dans le casier.` : ''; };
  const choixRangement = h('select', {
    'aria-label': 'Vin à ranger', onchange: (e) => { aRanger = e.target.value; ranges = 0; majSession(); }
  });

  await charger();
  core.ajouter(choixRangement, [h('option', { value: '' }, 'Ranger des bouteilles : choisir le vin…'),
    [...produits.values()].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')).map((x) => h('option', { value: x.id }, [x.nom, x.millesime].filter(Boolean).join(' ')))]);

  el.append(
    h('div', { class: 'ligne-ble' }, bouton, statut),
    message,
    h('div', { class: 'carte rangement-assiste' }, choixRangement, session),
    grille, panneau,
    h('details', { class: 'section' }, h('summary', {}, h('span', { class: 'section-titre' }, 'Mouvements')), h('div', { class: 'section-corps' }, mouvements)),
    h('div', { class: 'carte experimental' },
      h('strong', {}, 'Expérimental'),
      h('p', { class: 'discret' }, 'Faire clignoter une clayette, température et humidité : commandes du casier pas encore décodées (journal Bluetooth complet nécessaire).'),
      h('button', { type: 'button', class: 'bouton', disabled: true }, 'Faire clignoter la clayette')));
  dessiner();
}

export default {
  id: 'montrouge',
  titre: 'Casier Montrouge connecté',
  flag: { defaut: true, experimental: false },
  profils: ['vin'],
  ecrans: [{ route: '/montrouge/:id', titre: 'Casier connecté', onglet: '/rangements', rendu: ecran }],
  tables: ['bouteilles']
};
