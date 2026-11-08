// Éléments visuels réutilisés partout : drapeau rond, pastille de style, note, halo, jauge.
import { h } from './dom.js';
import { DRAPEAUX } from '../../data/drapeaux.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function drapeau(code, taille = 22) {
  const d = DRAPEAUX[code];
  if (!d) return null;
  const svg = svgEl('svg', { width: taille, height: taille, viewBox: '0 0 24 24', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  for (const [x, y, w, hh, f] of d.r || []) svg.append(svgEl('rect', { x, y, width: w, height: hh, fill: f }));
  for (const [points, f] of d.p || []) svg.append(svgEl('polygon', { points, fill: f }));
  const el = h('span', { class: 'drapeau', role: 'img', 'aria-label': d.nom, style: { width: `${taille}px`, height: `${taille}px` } });
  el.append(svg);
  return el;
}

export function pastille(style) {
  const el = h('span', { class: 'pastille', role: 'img', 'aria-label': style.titre, style: { background: style.pastille } });
  if (style.bulles) {
    const svg = svgEl('svg', { width: 18, height: 18, viewBox: '0 0 20 20', 'aria-hidden': 'true' });
    for (const [cx, cy, r] of [[7, 12.5, 1.7], [12.5, 9, 1.4], [9, 6, 1.1]]) svg.append(svgEl('circle', { cx, cy, r, fill: '#FFFFFF' }));
    el.append(svg);
  }
  return el;
}

export function note(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const texte = String(valeur).replace('.', ',');
  const svg = svgEl('svg', { width: 11, height: 11, viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'etoile' });
  svg.append(svgEl('path', { d: 'M12 3.8l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8z' }));
  const el = h('span', { class: 'note', 'aria-label': `Note ${texte} sur 5` });
  el.append(svg, texte);
  return el;
}

export function jauge(pourcent) {
  const el = h('span', { class: 'jauge', role: 'img', 'aria-label': pourcent >= 100 ? 'Bouteille pleine' : `Reste ${pourcent} %` });
  el.append(h('span', { style: { width: `${Math.max(0, Math.min(100, pourcent))}%` } }));
  return el;
}

export function emplacement(numero, style, { trouve = false } = {}) {
  return h('span', {
    class: `emplacement${trouve ? ' halo' : ''}`, role: 'img',
    'aria-label': `Bouteille ${numero}${trouve ? ', trouvée' : ''}`,
    style: { background: style.fond, color: style.texte }
  }, String(numero));
}
