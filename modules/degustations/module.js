// Dégustations : mesure MyOeno (Bluetooth), note, mots-clés suggérés, historique, reprise de la v9.3.
import { remplacer } from '../../core/ui/dom.js';
import { ICONES } from '../../core/ui/icones.js';
import { radar } from '../../core/ui/radar.js';
import { inventaire, nomComplet } from '../../core/inventaire.js';
import { urlPhoto } from '../../core/photos.js';
import { creerScanner, bluetoothDisponible } from './ble.js';
import { ETATS, decrire, motsCles } from './calcul.js';
import { historique, moyenneDuStyle, enregistrer, historiqueV9, importerHistoriqueV9 } from './donnees.js';

const ETAPES = ['Prêt', 'Dans le verre', 'Mesure', 'Résultat'];
// Une seule connexion pour toute l'app ; l'écran affiché branche ses rappels dessus.
const rappels = {};
let scanner = null;
function obtenirScanner() {
  return scanner || (scanner = creerScanner({
    surEtat: (...a) => rappels.surEtat?.(...a), surMesure: (...a) => rappels.surMesure?.(...a),
    surBatterie: (...a) => rappels.surBatterie?.(...a), surStatut: (...a) => rappels.surStatut?.(...a), journal: (...a) => rappels.journal?.(...a)
  }));
}

function etoiles(h, valeur, changer) {
  const groupe = h('div', { class: 'etoiles', role: 'radiogroup', 'aria-label': 'Votre note' });
  const dessiner = (v) => remplacer(groupe, ...[1, 2, 3, 4, 5].map((n) => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(n === v), 'aria-label': `${n} sur 5`, class: n <= v ? 'pleine' : '', onclick: () => { changer(n); dessiner(n); } });
    b.append(etoileSvg());
    return b;
  }));
  dessiner(valeur);
  return groupe;
}

function etoileSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '30'); s.setAttribute('height', '30'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M12 3.8l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8z');
  s.append(p);
  return s;
}

async function ecranMesure(core, el) {
  const { h } = core;
  const profil = core.profilCourant();
  const produits = await inventaire(core.store, profil);
  let produit = produits.find((p) => p.id === core.requete().produit) || null;
  let resultat = null, etat = -1, note = 0, batterie = null;
  const choisis = new Set();

  const message = h('p', { class: 'message-ble', role: 'status' });
  const etapes = h('ol', { class: 'etapes', 'aria-label': 'Étapes de la mesure' }, ETAPES.map((t) => h('li', {}, h('span', { class: 'trait' }), t)));
  const zoneResultat = h('div', { class: 'carte resultat-mesure' });
  const zoneMots = h('div', { class: 'puces-mots' });
  const autre = h('input', { type: 'text', placeholder: 'Autre mot-clé…', 'aria-label': 'Ajouter un mot-clé', class: 'mot-libre' });
  const commentaire = h('textarea', { rows: '2', placeholder: 'Commentaire', 'aria-label': 'Commentaire' });
  const etatBle = h('span', { class: 'etat-ble' });
  const boutonConnexion = h('button', { type: 'button', class: 'bouton principal' }, 'Connecter le scanner');

  function majEtapes() {
    const rang = resultat ? 3 : etat === 4 ? 2 : etat === 1 ? 1 : obtenirScanner().connecte() ? 0 : -1;
    etapes.querySelectorAll('li').forEach((li, i) => { li.classList.toggle('fait', i <= rang); li.toggleAttribute('aria-current', i === rang); });
  }

  async function dessinerResultat() {
    const fantome = await moyenneDuStyle(core.store, produit?.style, produit?.id);
    if (!resultat) {
      remplacer(zoneResultat, h('p', { class: 'discret' }, bluetoothDisponible()
        ? 'Connectez le scanner, attendez que sa lumière soit fixe, puis plongez-le dans le verre.'
        : 'Bluetooth indisponible sur ce navigateur : utilisez Chrome sur Android. Vous pouvez quand même noter cette dégustation.'));
    } else {
      const v = resultat.valeurs;
      remplacer(zoneResultat, 
        radar(v, { taille: 230, fantome, legende: fantome ? 'la moyenne de vos vins du même style' : '' }),
        h('div', { class: 'indices' }, h('span', {}, 'Évolution ', h('strong', {}, String(v.evolution))), h('span', {}, 'Garde ', h('strong', {}, String(v.garde))),
          fantome ? h('span', { class: 'discret' }, '- - - vos vins du même style') : null),
        h('p', { class: 'phrase' }, decrire(v)),
        profil === 'spiritueux' ? h('p', { class: 'discret' }, 'Expérimental : indices calculés par l’algorithme du vin, à interpréter avec prudence.') : null);
    }
    const suggestions = motsCles(resultat?.valeurs, produit?.style, profil);
    remplacer(zoneMots, ...[...new Set([...suggestions, ...choisis])].map((mot) => h('button', {
      type: 'button', class: 'puce-mot', 'aria-pressed': String(choisis.has(mot)),
      onclick: (e) => { choisis.has(mot) ? choisis.delete(mot) : choisis.add(mot); e.currentTarget.setAttribute('aria-pressed', String(choisis.has(mot))); }
    }, mot)));
  }

  autre.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !autre.value.trim()) return;
    e.preventDefault();
    choisis.add(autre.value.trim()); autre.value = ''; dessinerResultat();
  });

  const callbacks = {
    surEtat: (st) => { etat = st; if (ETATS[st]) { message.textContent = ETATS[st].texte; message.dataset.niveau = ETATS[st].niveau; } majEtapes(); },
    surMesure: (t) => { resultat = { ...t, batterie, quand: new Date().toISOString() }; message.textContent = 'Mesure terminée.'; message.dataset.niveau = 'ok'; majEtapes(); dessinerResultat(); },
    surBatterie: (b) => { batterie = b; etatBle.textContent = `MyOeno ${b} %`; if (b < 25) message.textContent = 'Batterie faible : rechargez le scanner si la mesure échoue.'; },
    surStatut: (s) => {
      const textes = { recherche: 'Recherche…', connexion: 'Connexion…', connecte: 'Connecté', deconnecte: 'Déconnecté' };
      if (s !== 'connecte' || batterie === null) etatBle.textContent = textes[s];
      boutonConnexion.hidden = s === 'connecte';
      if (s === 'connecte') { message.textContent = 'Scanner connecté. Attendez que sa lumière soit fixe.'; }
      majEtapes();
    },
    journal: (t) => core.store.journaliser('info', `MyOeno : ${t}`)
  };
  Object.assign(rappels, callbacks);
  const sc = obtenirScanner();
  boutonConnexion.hidden = sc.connecte();
  if (sc.connecte()) etatBle.textContent = batterie === null ? 'Connecté' : `MyOeno ${batterie} %`;
  boutonConnexion.addEventListener('click', async () => {
    try { await sc.connecter(false); } catch (e) { message.textContent = e.name === 'NotFoundError' ? 'Aucun scanner choisi.' : `Connexion impossible : ${e.message}`; }
  });

  // Choix du vin
  const choixVin = h('select', { 'aria-label': 'Vin dégusté', onchange: (e) => { produit = produits.find((p) => p.id === e.target.value) || null; entete(); dessinerResultat(); } },
    h('option', { value: '' }, 'Verre non rattaché'),
    produits.map((p) => h('option', { value: p.id, selected: p.id === produit?.id }, nomComplet(p))));
  const carteVin = h('div', { class: 'vin-mesure' });
  async function entete() {
    const img = produit ? await urlPhoto(core.store, produit.id) : null;
    remplacer(carteVin, 
      img ? h('img', { src: img, alt: '' }) : h('span', { class: 'vignette-vide' }),
      h('span', { class: 'vin-mesure-texte' }, h('strong', {}, produit ? nomComplet(produit) : 'Verre non rattaché'),
        h('span', { class: 'discret' }, produit ? 'Le profil rejoint la fiche et vaut pour toutes ses bouteilles.' : 'Choisissez un vin de la cave, ou gardez la mesure seule.')),
      choixVin);
  }

  const enregistrerBouton = h('button', {
    type: 'button', class: 'bouton principal grand', onclick: async () => {
      if (!resultat && !note && !choisis.size && !commentaire.value.trim()) { message.textContent = 'Rien à enregistrer : mesurez, notez ou choisissez des mots-clés.'; return; }
      await enregistrer(core.store, { produitId: produit?.id, mesure: resultat, note: note || null, motsCles: [...choisis], commentaire: commentaire.value.trim() });
      core.aller(produit ? `/fiche/${produit.id}` : '/degustations');
    }
  }, 'Enregistrer la dégustation');

  core.titre('Dégustation');
  // Spiritueux : la mesure n'est proposée que si le module expérimental est activé.
  const mesurable = profil === 'vin' || core.moduleActif('myoeno-spiritueux');
  core.ajouter(el, [
    h('div', { class: 'carte' }, carteVin),
    mesurable ? h('div', { class: 'ligne-ble' }, boutonConnexion, etatBle) : null,
    mesurable ? etapes : null, mesurable ? message : null, mesurable ? zoneResultat : null,
    h('section', { class: 'carte' },
      h('div', { class: 'ligne-note' }, h('span', { class: 'libelle' }, 'Votre note'), etoiles(h, 0, (n) => { note = n; })),
      h('p', { class: 'libelle' }, 'Mots-clés ', h('span', { class: 'discret' }, 'suggérés d’après le profil · touchez pour ajouter')),
      zoneMots, autre, commentaire),
    enregistrerBouton]);
  await entete();
  await dessinerResultat();
  majEtapes();
}

async function ecranHistorique(core, el) {
  const { h } = core;
  const lignes = await historique(core.store);
  el.append(h('a', { href: '#/mesure', class: 'bouton principal grand' }, core.icone(ICONES.etoile, 20), 'Nouvelle dégustation'));
  if (!lignes.length) { el.append(h('p', { class: 'vide' }, 'Aucune dégustation pour l’instant.')); return; }
  el.append(h('ul', { class: 'historique' }, lignes.map(({ mesure, degustation, produit }) => h('li', {},
    h('a', { href: produit ? `#/fiche/${produit.id}` : '#/degustations', class: 'carte ligne-historique' },
      mesure ? radar(mesure, { taille: 56, etiquettes: false }) : h('span', { class: 'vignette-vide petite' }),
      h('span', { class: 'ligne-texte' },
        h('strong', {}, produit ? nomComplet(produit) : 'Verre non rattaché'),
        h('span', { class: 'discret' }, [String((mesure?.mesure_le || degustation?.le || '')).slice(0, 10), mesure ? `P ${mesure.puissance} · T ${mesure.tanins} · V ${mesure.vivacite}` : null].filter(Boolean).join(' · ')),
        degustation?.mots_cles?.length ? h('span', { class: 'discret' }, degustation.mots_cles.join(', ')) : null),
      degustation?.note ? h('span', { class: 'note-historique' }, `★ ${degustation.note}`) : null)))));
}

function reglages(core, el) {
  const { h } = core;
  const hist = historiqueV9();
  if (!hist) return;
  const msg = h('p', { class: 'message', role: 'status' });
  el.append(h('section', { class: 'carte', 'data-carte': 'reprise-myoeno' },
    h('h2', {}, 'Reprendre l’historique MyOeno'),
    h('p', {}, `${hist.length} mesure(s) enregistrée(s) par l’ancienne app dans ce navigateur.`),
    h('button', {
      type: 'button', class: 'bouton principal', onclick: async () => {
        const b = await importerHistoriqueV9(core.store, hist);
        remplacer(msg, `${b.mesures} mesure(s) reprise(s), ${b.vins} vin(s) créé(s) sans stock${b.deja ? `, ${b.deja} déjà présente(s)` : ''}. `, h('a', { href: '#/degustations' }, 'Voir les dégustations'));
      }
    }, 'Reprendre les mesures'),
    msg));
}

export default {
  id: 'degustations',
  titre: 'Dégustations (MyOeno)',
  flag: { defaut: true, experimental: false },
  ecrans: [
    { route: '/degustations', titre: 'Dégustations', icone: ICONES.etoile, place: 'nav', ordre: 40, rendu: ecranHistorique },
    { route: '/mesure', titre: 'Dégustation', onglet: '/degustations', rendu: ecranMesure }
  ],
  reglages,
  tables: ['mesures', 'degustations']
};
