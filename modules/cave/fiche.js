// Fiche d'un produit : photo avec drapeau/note/compteur, sections dépliables au style de la carte MyOeno.
import { produitEnrichi, sortirBouteille, ajouterBouteilles, nomComplet, aGrille, emplacementsLibres } from '../../core/inventaire.js';
import { drapeau, pastille, note } from '../../core/ui/badges.js';
import { urlPhoto } from '../../core/photos.js';

const ouverts = new Set(['stock', 'profil', 'apogee']); // sections ouvertes par défaut, mémorisées le temps de la session

function section(core, id, titre, resume, ...contenu) {
  const { h } = core;
  const d = h('details', { class: 'section', 'data-section': id, open: ouverts.has(id) },
    h('summary', {}, h('span', { class: 'section-titre' }, titre), resume ? h('span', { class: 'section-resume' }, resume) : null),
    h('div', { class: 'section-corps' }, ...contenu));
  d.addEventListener('toggle', () => (d.open ? ouverts.add(id) : ouverts.delete(id)));
  return d;
}

export async function ecranFiche(core, el, { id }) {
  const { h } = core;
  const p = await produitEnrichi(core.store, id);
  if (!p) {
    el.append(h('section', { class: 'carte' }, h('h2', {}, 'Introuvable'), h('p', {}, 'Ce produit n’existe plus.'), h('a', { href: '#/cave' }, 'Retour à la cave')));
    return;
  }
  core.titre(p.profil === 'vin' ? 'Fiche vin' : 'Fiche spiritueux');
  const rangements = new Map((await core.store.list('rangements')).map((r) => [r.id, r]));
  const message = h('p', { class: 'message', role: 'status' });
  const style = p.styleInfo;

  // En-tête photo
  const photo = h('div', { class: 'fiche-photo', style: style ? { background: style.fond, color: style.texte } : null },
    h('span', { class: 'etiquette-generee grande' }, h('span', { class: 'nom-court' }, p.nom), p.millesime ? h('span', { class: 'annee' }, p.millesime) : null),
    h('span', { class: 'fiche-haut' },
      style ? pastille(style) : null,
      h('a', { href: `#/produit/${p.id}/modifier`, class: 'bouton-rond clair', 'aria-label': 'Modifier la fiche' }, core.icone('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>', 19))),
    h('span', { class: 'fiche-bas' }, drapeau(p.pays, 30), note(p.note), h('span', { class: 'fois' }, `×${p.stock}`)));
  urlPhoto(core.store, p.id).then((url) => { if (url) photo.prepend(h('img', { src: url, alt: `Étiquette ${p.nom}` })); });

  // Stock & rangement
  const lignesBouteilles = p.bouteilles.map((b) => {
    const r = rangements.get(b.rangement_id);
    const lieu = [r?.nom, b.emplacement].filter(Boolean).join(' · ') || 'Sans rangement';
    return h('li', { class: 'bouteille' },
      h('span', { class: 'numero' }, `#${b.numero}`),
      h('span', { class: 'lieu' }, lieu, b.etat === 'ouverte' ? h('span', { class: 'discret' }, ` · ouverte, reste ${b.niveau ?? 100} %`) : null),
      r && aGrille(r) ? h('a', { href: `#/rangement/${r.id}?b=${b.numero}`, class: 'lien-localiser', 'aria-label': `Localiser la bouteille ${b.numero}` }, core.icone('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>', 20)) : null);
  });

  const choixRangement = h('select', { 'aria-label': 'Rangement' },
    h('option', { value: '' }, 'Sans rangement'),
    [...rangements.values()].map((r) => h('option', { value: r.id }, r.nom)));
  const quantite = h('input', { type: 'number', min: '1', max: '48', value: '1', 'aria-label': 'Nombre de bouteilles', class: 'quantite' });

  const ajouter = async () => {
    const r = rangements.get(choixRangement.value);
    const n = Math.max(1, Math.min(48, Number(quantite.value) || 1));
    const emplacements = r && aGrille(r) ? (await emplacementsLibres(core.store, r)).slice(0, n) : [];
    if (r && aGrille(r) && emplacements.length < n) { message.textContent = `Plus que ${emplacements.length} emplacement(s) libre(s) dans ${r.nom}.`; return; }
    await ajouterBouteilles(core.store, p.id, n, { rangement_id: r?.id || null, emplacements });
    core.aller(`/fiche/${p.id}`);
  };

  const enStock = p.bouteilles.filter((b) => b.etat === 'stock');
  const ouverte = p.bouteilles.find((b) => b.etat === 'ouverte');
  const actionPrincipale = p.profil === 'spiritueux'
    ? (ouverte
      ? h('button', { type: 'button', class: 'bouton principal', onclick: async () => { await sortirBouteille(core.store, ouverte, 'bue'); core.aller(`/fiche/${p.id}`); } }, 'Bouteille terminée')
      : enStock.length ? h('button', { type: 'button', class: 'bouton principal', onclick: async () => { await sortirBouteille(core.store, enStock[0], 'ouverte'); core.aller(`/fiche/${p.id}`); } }, 'Ouvrir une bouteille') : null)
    : enStock.length ? h('button', { type: 'button', class: 'bouton principal', onclick: async () => { await sortirBouteille(core.store, enStock[0], 'bue'); core.aller(`/fiche/${p.id}`); } }, 'Ouvrir une bouteille') : null;

  const niveau = ouverte && p.profil === 'spiritueux'
    ? h('label', { class: 'niveau' }, 'Niveau restant',
      h('input', {
        type: 'range', min: '0', max: '100', step: '5', value: String(ouverte.niveau ?? 100),
        onchange: async (e) => { await core.store.put('bouteilles', { ...ouverte, niveau: Number(e.target.value) }); core.aller(`/fiche/${p.id}`); }
      }))
    : null;

  const sections = [
    section(core, 'stock', 'Stock & rangement', `${p.stock} bouteille${p.stock > 1 ? 's' : ''}`,
      p.bouteilles.length ? h('ul', { class: 'liste-bouteilles' }, lignesBouteilles) : h('p', { class: 'discret' }, 'Aucune bouteille en stock : la fiche reste dans votre cave.'),
      niveau,
      h('div', { class: 'boutons' }, actionPrincipale),
      h('div', { class: 'ajout-stock' }, quantite, choixRangement, h('button', { type: 'button', class: 'bouton', onclick: ajouter }, '+ Ajouter')),
      message),
    section(core, 'profil', 'Profil MyOeno', p.mesure ? 'mesuré' : 'à mesurer',
      p.mesure
        ? h('p', {}, `Puissance ${p.mesure.puissance ?? '–'} · Tanins ${p.mesure.tanins ?? '–'} · Vivacité ${p.mesure.vivacite ?? '–'}`)
        : h('p', { class: 'discret' }, 'Pas encore de mesure. Le profil vaudra pour toutes les bouteilles de ce vin.'),
      h('a', { href: `#/degustations?produit=${p.id}`, class: 'bouton' }, 'Scanner avec MyOeno')),
    p.profil === 'vin' ? section(core, 'apogee', 'Apogée', p.apogee_debut ? `${p.apogee_debut}–${p.apogee_fin ?? '?'}` : 'non renseignée',
      p.apogee_debut
        ? h('p', {}, `Fenêtre d'apogée : ${p.apogee_debut} → ${p.apogee_fin ?? '?'}.`)
        : h('p', { class: 'discret' }, 'Renseignez les années dans la fiche ; le calcul automatique arrive avec la story S4.'),
      p.extra?.apogee_source ? h('p', { class: 'discret' }, `Source : ${p.extra.apogee_source}`) : null) : null,
    section(core, 'notes', 'Notes', p.commentaire ? '' : 'vide',
      h('p', {}, p.commentaire || 'Aucune note.'))
  ];

  el.append(
    photo,
    h('div', { class: 'fiche-corps' },
      h('div', { class: 'fiche-titre' },
        h('span', { class: 'surtitre' }, [style?.titre, p.region, p.appellation].filter(Boolean).join(' · ')),
        h('h2', {}, nomComplet(p)),
        p.producteur || p.cuvee ? h('span', { class: 'sous-titre' }, [p.producteur, p.cuvee].filter(Boolean).join(' · ')) : null),
      sections)
  );
}
