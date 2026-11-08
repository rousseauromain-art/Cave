// Vignette d'un produit dans la matrice : photo ou étiquette générée, compteur, pastille, drapeau, note, jauge.
import { drapeau, pastille, note, jauge } from '../../core/ui/badges.js';
import { infoCourte } from '../../core/inventaire.js';
import { urlPhoto } from '../../core/photos.js';

export function tuile(core, p) {
  const { h } = core;
  const style = p.styleInfo;
  const visuel = h('span', {
    class: `visuel${p.stock === 0 ? ' sans-stock' : ''}`,
    style: style ? { background: style.fond, color: style.texte } : null
  });
  if (p.photo_path || p.id) {
    urlPhoto(core.store, p.id).then((url) => {
      if (url) visuel.prepend(h('img', { src: url, alt: `Étiquette ${p.nom}`, loading: 'lazy' }));
    });
  }
  visuel.append(
    h('span', { class: 'etiquette-generee' },
      h('span', { class: 'nom-court' }, p.nom),
      p.millesime || p.age_ans ? h('span', { class: 'annee' }, p.millesime || `${p.age_ans} ans`) : null),
    h('span', { class: 'compteur', 'aria-label': `${p.stock} bouteille${p.stock > 1 ? 's' : ''}` }, String(p.stock)),
    style ? h('span', { class: 'coin-pastille' }, pastille(style)) : null,
    h('span', { class: 'coin-bas' }, drapeau(p.pays), note(p.note))
  );
  const ouverte = p.bouteilles.find((b) => b.etat === 'ouverte');
  return h('a', { href: `#/fiche/${p.id}`, class: 'tuile', 'data-produit': p.id },
    visuel,
    p.profil === 'spiritueux' && ouverte ? jauge(ouverte.niveau ?? 100) : null,
    h('span', { class: 'tuile-nom' }, p.nom),
    h('span', { class: 'tuile-info' }, infoCourte(p) || ' '));
}
