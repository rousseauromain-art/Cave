// Scanner : photo d'étiquette → identification → vin de la cave reconnu, ou nouvelle fiche préremplie.
import { ICONES } from '../../core/ui/icones.js';
import { compresser } from '../../core/photos.js';
import { identifier, rapprocher, deposerBrouillon } from '../../core/identification.js';
import { cles, enregistrerCles, reprendreClesV9, masquer } from '../../core/cles.js';
import { inventaire } from '../../core/inventaire.js';
import { tuile } from '../cave/tuile.js';

async function ecran(core, el) {
  const { h } = core;
  const profil = core.profilCourant();
  const statut = h('p', { class: 'statut-scan', role: 'status' });
  const resultat = h('div', { class: 'resultat-scan' });
  const apercu = h('div', { class: 'apercu-scan' });

  const entree = h('input', {
    type: 'file', accept: 'image/*', capture: 'environment', id: 'photo-scan', class: 'masque',
    onchange: async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const photo = await compresser(f);
      apercu.replaceChildren(h('img', { src: URL.createObjectURL(photo), alt: 'Photo de l’étiquette' }));
      resultat.replaceChildren();
      try {
        const trouve = await identifier(photo, profil, {
          statut: (t) => { statut.textContent = t; },
          journal: (t) => core.store.journaliser('info', t)
        });
        statut.textContent = `Lu par ${trouve.source}.`;
        await afficher(trouve, photo);
      } catch (err) {
        statut.textContent = `Identification impossible : ${err.message}`;
        core.store.journaliser('erreur', `Identification : ${err.message}`);
      }
    }
  });

  async function afficher(trouve, photo) {
    const candidats = rapprocher(trouve, await inventaire(core.store, profil));
    const champs = [
      ['Nom', trouve.nom], [profil === 'vin' ? 'Domaine' : 'Distillerie', trouve.producteur], ['Appellation', trouve.appellation],
      ['Région', trouve.region], ['Millésime', trouve.millesime], ['Âge', trouve.age_ans && `${trouve.age_ans} ans`], ['Degré', trouve.degre && `${trouve.degre} %`]
    ].filter(([, v]) => v);
    const nouveau = () => { deposerBrouillon({ ...trouve, photo }); core.aller('/produit/nouveau'); };
    resultat.replaceChildren(
      h('section', { class: 'carte' },
        h('h2', {}, 'Lu sur l’étiquette'),
        champs.length ? h('dl', { class: 'champs-lus' }, champs.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))])) : h('p', { class: 'discret' }, 'Rien de lisible : essayez plus près, sans reflet.'),
        h('div', { class: 'boutons' }, h('button', { type: 'button', class: 'bouton principal', onclick: nouveau }, profil === 'vin' ? 'Créer la fiche de ce vin' : 'Créer la fiche'))),
      candidats.length ? h('section', { class: 'carte' },
        h('h2', {}, candidats.length > 1 ? 'Dans votre cave ?' : 'Déjà dans votre cave ?'),
        h('div', { class: 'matrice' }, candidats.map((p) => tuile(core, p))),
        h('p', { class: 'discret' }, 'Touchez la bonne bouteille pour ouvrir sa fiche (et la déguster ou la mesurer).')) : null
    );
    core.ajouter(resultat, []);
  }

  el.append(
    h('section', { class: 'carte scan' },
      h('h2', {}, profil === 'vin' ? 'Photographier une étiquette' : 'Photographier une bouteille'),
      h('p', { class: 'discret' }, 'Un verre offert ou une bouteille de la cave : l’app la reconnaît si elle y est déjà, sinon prépare sa fiche.'),
      apercu,
      h('label', { for: 'photo-scan', class: 'bouton principal grand' }, core.icone(ICONES.scanner, 22), 'Prendre la photo'),
      entree,
      statut),
    resultat);
}

function reglages(core, el) {
  const { h } = core;
  reprendreClesV9();
  const k = cles();
  const message = h('p', { class: 'message', role: 'status' });
  const champ = (nom, libelle, type = 'password') => h('label', { class: 'champ' }, h('span', { class: 'libelle' }, libelle),
    h('input', { name: nom, type, value: k[nom] || '', autocomplete: 'off', spellcheck: 'false' }));
  const form = h('form', { class: 'formulaire', 'data-carte': 'identification' },
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Service'),
      h('select', { name: 'fournisseur' },
        [['auto', 'Automatique (IA si clé, puis OCR.space, puis lecture locale)'], ['gemini', 'Gemini'], ['claude', 'Claude'], ['ocrspace', 'OCR.space (gratuit, 25 000/mois)'], ['local', 'Lecture locale (gratuite, sans clé)']]
          .map(([v, t]) => h('option', { value: v, selected: k.fournisseur === v }, t)))),
    champ('ocrKey', 'Clé OCR.space'),
    champ('geminiKey', 'Clé Gemini'),
    champ('geminiModel', 'Modèle Gemini', 'text'),
    champ('claudeKey', 'Clé Claude (Anthropic)'),
    champ('claudeModel', 'Modèle Claude', 'text'),
    h('p', { class: 'discret' }, `Clés enregistrées sur cet appareil uniquement, jamais sauvegardées ni exportées. OCR.space ${masquer(k.ocrKey)} · Gemini ${masquer(k.geminiKey)} · Claude ${masquer(k.claudeKey)}`),
    message,
    h('button', { type: 'submit', class: 'bouton principal' }, 'Enregistrer les clés'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    enregistrerCles(Object.fromEntries(Object.entries(d).map(([a, b]) => [a, String(b).trim()])));
    message.textContent = 'Enregistré sur cet appareil.';
  });
  el.append(h('section', { class: 'carte' }, h('h2', {}, 'Identification des étiquettes'), form));
}

export default {
  id: 'scanner',
  titre: 'Scanner',
  flag: { defaut: true, experimental: false },
  ecrans: [{ route: '/scanner', titre: 'Scanner', icone: ICONES.scanner, place: 'centre', ordre: 30, rendu: ecran }],
  reglages,
  tables: ['produits']
};
