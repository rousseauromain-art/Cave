// Scanner : photo d'étiquette → identification → vin de la cave reconnu, ou nouvelle fiche préremplie.
import { remplacer } from '../../core/ui/dom.js';
import { ICONES } from '../../core/ui/icones.js';
import { identifier, rapprocher, deposerBrouillon, lireTexte, completerAvecVerso, differences, fusionnerLecture, extraLecture, appellations } from '../../core/identification.js';
import { lirePage, analyserPage, imagePage } from '../../core/web.js';
import { compresser, urlPhoto, oublierPhoto } from '../../core/photos.js';
import { cles, enregistrerCles, reprendreClesV9, masquer } from '../../core/cles.js';
import { inventaire } from '../../core/inventaire.js';
import { tuile } from '../cave/tuile.js';

// Lecture en cours, conservée quand l'app change de profil (vin reconnu en mode spiritueux, etc.).
let enCours = null;
const STYLE_TITRE = { rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', champagne: 'Effervescent', liquoreux: 'Liquoreux' };

async function ecran(core, el) {
  const { h } = core;
  const profil = core.profilCourant();
  const statut = h('p', { class: 'statut-scan', role: 'status' });
  const resultat = h('div', { class: 'resultat-scan' });
  const apercu = h('div', { class: 'apercu-scan' });
  const journal = (t) => core.store.journaliser('info', t);
  let etat = null; // { trouve, photo, verso, bascule }

  // Deux entrées par face : appareil photo, ou photo déjà prise (galerie, fichiers).
  const entrees = (id, surPhoto) => [
    h('input', { type: 'file', accept: 'image/*', capture: 'environment', id, class: 'masque', onchange: surPhoto }),
    h('input', { type: 'file', accept: 'image/*', id: `${id}-galerie`, class: 'masque', onchange: surPhoto })
  ];

  const entree = entrees('photo-scan', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const photo = await compresser(f);
    remplacer(apercu);
    remplacer(resultat);
    try {
      const trouve = await identifier(photo, profil, { statut: (t) => { statut.textContent = t; }, journal });
      statut.textContent = `Lu par ${trouve.source}.`;
      etat = { trouve, photo, verso: null, bascule: null };
      if (trouve.profil !== profil) {
        // L'étiquette dit l'inverse du profil affiché : on change de profil et l'écran se redessine avec la lecture.
        enCours = { ...etat, bascule: profil };
        core.basculerProfil();
        return;
      }
      await afficher();
    } catch (err) {
      statut.textContent = `Identification impossible : ${err.message}`;
      core.store.journaliser('erreur', `Identification : ${err.message}`);
    }
  });

  // Verso (contre-étiquette) : texte ajouté à la lecture, champs manquants complétés.
  const entreeVerso = entrees('photo-verso', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !etat) return;
    const photo = await compresser(f);
    try {
      const { lignes, source } = await lireTexte(photo, { statut: (t) => { statut.textContent = t; }, journal });
      etat.trouve = await completerAvecVerso(etat.trouve, lignes);
      etat.verso = photo;
      statut.textContent = `Verso lu par ${source}.`;
      await afficher();
    } catch (err) {
      statut.textContent = `Lecture du verso impossible : ${err.message}`;
    }
  });

  // Lien vers une page (caviste, domaine) : même résultat qu'une photo d'étiquette.
  async function lireLien(url, texteColle = null) {
    remplacer(apercu);
    remplacer(resultat);
    try {
      statut.textContent = texteColle ? 'Analyse du texte collé…' : 'Lecture de la page…';
      const page = texteColle ? { titre: texteColle.split('\n')[0], texte: texteColle } : await lirePage(url, { journal });
      const trouve = analyserPage(page, url || null, await appellations());
      const photo = await imagePage(page.image);
      statut.textContent = texteColle ? 'Texte analysé.' : 'Page lue.';
      etat = { trouve, photo, verso: null, bascule: null, cible };
      if (trouve.profil !== core.profilCourant()) { enCours = { ...etat, bascule: core.profilCourant(), cible }; core.basculerProfil(); return; }
      await afficher();
    } catch (err) {
      statut.textContent = `Lecture impossible : ${err.message}. Copiez le texte de la page et collez-le ci-dessous.`;
      colle.open = true;
    }
  }
  const cible = core.requete().produit || null;
  const champLien = h('input', { type: 'url', inputmode: 'url', placeholder: 'https://… (fiche du vin chez un caviste, un domaine)', 'aria-label': 'Adresse de la page', value: core.requete().lien || '' });
  const zoneColle = h('textarea', { rows: '4', 'aria-label': 'Texte de la page', placeholder: 'Sur la page : menu ⋮ → Tout sélectionner → Copier, puis collez ici.' });
  const colle = h('details', { class: 'colle-page' }, h('summary', {}, 'Le site refuse ? Coller le texte de la page'), zoneColle,
    h('button', { type: 'button', class: 'bouton', onclick: () => zoneColle.value.trim() && lireLien(champLien.value.trim(), zoneColle.value) }, 'Analyser le texte'));
  const blocLien = h('section', { class: 'carte lien-scan' },
    h('h2', {}, 'Depuis un lien'),
    h('div', { class: 'ligne-lien' }, champLien, h('button', { type: 'button', class: 'bouton principal', onclick: () => champLien.value.trim() && lireLien(champLien.value.trim()) }, 'Lire')),
    h('p', { class: 'discret' }, 'La page est lue directement, ou par le service de lecture r.jina.ai (seule l’adresse lui est transmise).'),
    colle);

  async function afficher() {
    const { trouve, photo, verso, bascule } = etat;
    const vin = trouve.profil === 'vin';
    const tous = await inventaire(core.store, trouve.profil);
    const choisi = etat.cible ? tous.find((x) => x.id === etat.cible) : null;
    const candidats = choisi ? [choisi, ...rapprocher(trouve, tous).filter((x) => x.id !== choisi.id)] : rapprocher(trouve, tous);
    const champs = [
      ['Nom', trouve.nom], [vin ? 'Domaine' : 'Distillerie', trouve.producteur], ['Appellation', trouve.appellation],
      ['Région', trouve.region], ['Millésime', trouve.millesime], ['Âge', trouve.age_ans && `${trouve.age_ans} ans`],
      ['Couleur', vin && trouve.style && [STYLE_TITRE[trouve.style] || trouve.style, trouve.styleDeduit ? h('span', { class: 'discret' }, ' (déduit des cépages)') : null]],
      ['Degré', trouve.degre && `${trouve.degre} %`], ['Contenance', trouve.volume_cl && `${trouve.volume_cl} cl`],
      ['Apogée', trouve.apogee_fin && `${trouve.apogee_debut ? `${trouve.apogee_debut}–` : 'jusqu’en '}${trouve.apogee_fin}`],
      ['Service', trouve.temperature && `${trouve.temperature[0]}–${trouve.temperature[1]} °C`]
    ].filter(([, v]) => v);
    const cepages = trouve.cepages ? trouve.cepages.split(', ') : [];
    const texte = [trouve.notes, trouve.texte, trouve.texte_verso && `— Verso —\n${trouve.texte_verso}`].filter(Boolean).join('\n\n');
    const nouveau = () => {
      const { source, texte: recto, texte_verso: versoTexte, styleDeduit, volume_cl, commentaire, notes, lien, image, temperature, ...lus } = trouve;
      deposerBrouillon({
        ...lus, photo, source,
        commentaire: [commentaire, notes, versoTexte].filter(Boolean).join('\n\n') || null,
        extra: extraLecture(trouve)
      });
      enCours = null;
      core.aller('/produit/nouveau');
    };
    // Mise à jour d'une fiche existante : on coche ce qu'on reporte (photo comprise).
    const zoneMaj = h('div', { class: 'zone-maj' });
    async function mettreAJour(cible, bouton) {
      const brut = await core.store.get('produits', cible.id);
      const diffs = differences(brut, trouve);
      const aPhoto = !!(await urlPhoto(core.store, cible.id));
      const cases = diffs.map((d) => h('label', { class: 'case-maj' }, h('input', { type: 'checkbox', name: d.cle, checked: d.coche }),
        h('span', {}, h('strong', {}, d.libelle), ' : ', String(d.apres), d.avant !== null ? h('span', { class: 'discret' }, ` (actuel : ${d.avant})`) : null)));
      const casePhoto = !photo ? null : h('label', { class: 'case-maj' }, h('input', { type: 'checkbox', name: '__photo', checked: !aPhoto }),
        h('span', {}, h('strong', {}, aPhoto ? 'Remplacer la photo' : 'Ajouter la photo'), verso ? h('span', { class: 'discret' }, ' (recto)') : null));
      remplacer(zoneMaj, h('form', {
        class: 'carte-maj', onsubmit: async (e) => {
          e.preventDefault();
          const choix = new FormData(e.target);
          await core.store.put('produits', fusionnerLecture(brut, trouve, diffs.map((d) => d.cle).filter((k) => choix.has(k))));
          if (choix.has('__photo')) { await core.store.enregistrerPhoto(cible.id, photo); oublierPhoto(cible.id); }
          enCours = null;
          core.aller(`/fiche/${cible.id}`);
        }
      },
        h('h3', {}, `Mettre à jour « ${cible.nom} »`),
        cases, casePhoto,
        h('p', { class: 'discret' }, web ? 'Le lien et le texte de la page sont conservés ; dégustation et accords rejoignent les notes.' : 'Le texte lu est conservé dans la fiche ; le verso rejoint les notes.'),
        h('div', { class: 'boutons' }, h('button', { type: 'submit', class: 'bouton principal' }, 'Enregistrer'), h('button', { type: 'button', class: 'bouton', onclick: () => remplacer(zoneMaj) }, 'Annuler'))));
      zoneMaj.scrollIntoView({ block: 'nearest' });
      bouton.blur();
    }

    const web = trouve.source === 'Page web';
    remplacer(apercu,
      photo ? h('figure', { class: 'face-scan' }, h('img', { src: URL.createObjectURL(photo), alt: web ? 'Photo de la page' : 'Recto de l’étiquette' }), h('figcaption', {}, web ? 'Photo de la page' : 'Recto · lu'))
        : h('figure', { class: 'face-scan' }, h('span', { class: 'vignette-vide' }), h('figcaption', {}, web ? 'Page sans photo récupérable' : '')),
      verso ? h('figure', { class: 'face-scan' }, h('img', { src: URL.createObjectURL(verso), alt: 'Verso de l’étiquette' }), h('figcaption', {}, 'Verso · lu'))
        : h('figure', { class: 'face-scan' }, h('label', { for: 'photo-verso', class: 'ajout-verso' }, h('span', { 'aria-hidden': 'true' }, '+'), 'Ajouter le verso'),
          h('label', { for: 'photo-verso-galerie', class: 'lien-galerie' }, 'ou depuis la galerie'), h('figcaption', {}, 'Contre-étiquette : description, accords')));
    remplacer(resultat,
      bascule ? h('p', { class: 'bandeau-info', role: 'status' }, `C’est ${vin ? 'un vin' : 'un spiritueux'} : vous étiez en ${bascule === 'vin' ? 'Vins' : 'Spiritueux'}, l’app est passée en `, h('strong', {}, vin ? 'Vins' : 'Spiritueux'), '.') : null,
      h('section', { class: 'carte' },
        h('h2', {}, 'Lu sur l’étiquette'),
        champs.length ? h('dl', { class: 'champs-lus' }, champs.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, typeof v === 'object' ? v : String(v))])) : h('p', { class: 'discret' }, 'Rien de lisible : essayez plus près, sans reflet.'),
        cepages.length ? h('div', { class: 'cepages-lus' }, h('span', { class: 'discret' }, 'Cépages'), h('div', { class: 'puces-mots lecture' }, cepages.map((c) => h('span', { class: 'puce-mot' }, c)))) : null,
        texte ? h('details', { class: 'texte-lu' }, h('summary', {}, web ? 'Notes et texte de la page (conservés dans la fiche)' : 'Texte lu (conservé dans la fiche)'), h('pre', {}, texte)) : null,
        h('div', { class: 'boutons' }, h('button', { type: 'button', class: 'bouton principal', onclick: nouveau }, vin ? 'Créer la fiche de ce vin' : 'Créer la fiche'))),
      candidats.length ? h('section', { class: 'carte' },
        h('h2', {}, candidats.length > 1 ? 'Dans votre cave ?' : 'Déjà dans votre cave ?'),
        h('div', { class: 'matrice' }, candidats.map((p) => h('div', { class: 'candidat' }, tuile(core, p),
          h('button', { type: 'button', class: 'bouton petit', onclick: (e) => mettreAJour(p, e.currentTarget) }, 'Mettre à jour')))),
        zoneMaj,
        h('p', { class: 'discret' }, 'Touchez la bouteille pour ouvrir sa fiche, ou « Mettre à jour » pour y reporter la photo et ce qui a été lu.'))
        : h('p', { class: 'carte discret' }, vin ? 'Aucun vin ressemblant dans votre cave.' : 'Aucun spiritueux ressemblant dans votre collection.'));
    if (choisi) await mettreAJour(choisi, document.createElement('button'));
  }

  el.append(
    h('section', { class: 'carte scan' },
      h('h2', {}, profil === 'vin' ? 'Photographier une étiquette' : 'Photographier une bouteille'),
      h('p', { class: 'discret' }, 'Un verre offert ou une bouteille de la cave : l’app la reconnaît si elle y est déjà, sinon prépare sa fiche.'),
      apercu,
      h('div', { class: 'boutons-scan' },
        h('label', { for: 'photo-scan', class: 'bouton principal grand' }, core.icone(ICONES.scanner, 22), 'Prendre la photo'),
        h('label', { for: 'photo-scan-galerie', class: 'bouton grand' }, core.icone(ICONES.photo || '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 8"/>', 22), 'Choisir une photo')),
      entree, entreeVerso,
      statut),
    blocLien,
    resultat);

  // Reprise d'une lecture après changement de profil.
  if (!enCours && core.requete().lien) { await lireLien(core.requete().lien); return; }
  if (enCours && enCours.trouve.profil === profil) {
    etat = enCours;
    enCours = null;
    statut.textContent = `Lu par ${etat.trouve.source}.`;
    await afficher();
  }
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
