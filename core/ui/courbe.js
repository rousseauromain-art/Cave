// Courbe de garde (repris de la maquette) : bande verte = apogée, point = aujourd'hui.
import { courbe } from '../apogee.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, texte) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (texte) e.textContent = texte;
  return e;
};

export function dessinerCourbe(millesime, debut, fin, maintenant = new Date().getFullYear() + new Date().getMonth() / 12) {
  const W = 318, H = 128, L = 8, R = 8, T = 14, B = 26;
  const c = courbe(millesime, debut, fin);
  const X = (y) => L + ((y - c.de) / (c.a - c.de)) * (W - L - R);
  const Y = (v) => T + (1 - v) * (H - T - B);
  const ici = Math.min(c.a, Math.max(c.de, maintenant));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'courbe', role: 'img', 'aria-label': `Courbe de garde : apogée de ${debut} à ${fin}` });
  svg.append(
    el('rect', { x: X(debut).toFixed(1), y: T, width: (X(fin) - X(debut)).toFixed(1), height: H - T - B, class: 'courbe-bande' }),
    el('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'courbe-axe' }),
    el('path', { d: c.points.map(([y, v], i) => `${i ? 'L' : 'M'}${X(y).toFixed(1)} ${Y(v).toFixed(1)}`).join(''), class: 'courbe-trait' }),
    el('line', { x1: X(ici).toFixed(1), x2: X(ici).toFixed(1), y1: 8, y2: H - B, class: 'courbe-maintenant' }),
    el('circle', { cx: X(ici).toFixed(1), cy: Y(c.q(ici)).toFixed(1), r: 5.5, class: 'courbe-point' }),
    el('text', { x: ((X(c.de) + X(debut)) / 2 + 6).toFixed(1), y: H - 10, 'text-anchor': 'middle', class: 'courbe-texte' }, 'Jeunesse'),
    el('text', { x: ((X(debut) + X(fin)) / 2).toFixed(1), y: H - 10, 'text-anchor': 'middle', class: 'courbe-texte fort' }, `Apogée ${debut}–${fin}`),
    el('text', { x: Math.min(W - 24, (X(fin) + X(c.a)) / 2 + 8).toFixed(1), y: H - 10, 'text-anchor': 'middle', class: 'courbe-texte' }, 'Déclin')
  );
  return svg;
}
