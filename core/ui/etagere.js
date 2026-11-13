// Bar des spiritueux : vue de l'inventaire en étagères (une par pays, catégorie ou niveau), 6 bouteilles par
// planche, nom et niveau sous chaque bouteille. Lecture seule : toucher une bouteille la sélectionne.
import { libelleNiveau } from '../inventaire.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, texte) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  if (texte !== undefined) e.textContent = texte;
  return e;
};
const div = (classe, ...enfants) => {
  const e = document.createElement('div');
  e.className = classe;
  e.append(...enfants.filter((x) => x !== null && x !== undefined));
  return e;
};

// Silhouettes dans une case de 48 × 120 (base à y = 116). corps = zone remplissable [x, y, l, h] ; haut = goulot.
export const FORMES = {
  haute: { titre: 'Haute', contour: 'M20 6h8v20c0 6 10 10 10 20v62a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V46c0-10 10-14 10-20z', corps: [10, 44, 28, 72], haut: 6 },
  trapue: { titre: 'Trapue', contour: 'M20 20h8v18c0 4 14 6 14 14v56a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V52c0-8 14-10 14-14z', corps: [6, 54, 36, 62], haut: 20 },
  carree: { titre: 'Carrée', contour: 'M19 14h10v18l8 8v68a8 8 0 0 1-8 8H19a8 8 0 0 1-8-8V40l8-8z', corps: [11, 42, 26, 74], haut: 14 },
  ronde: { titre: 'Ronde', contour: 'M20 30h8v12c10 4 16 16 16 30v30a14 14 0 0 1-14 14H18A14 14 0 0 1 4 102V72c0-14 6-26 16-30z', corps: [4, 54, 40, 62], haut: 30 },
  carafe: { titre: 'Carafe', contour: 'M19 18h10v18c0 4 16 10 16 30v38a12 12 0 0 1-12 12H15A12 12 0 0 1 3 104V66c0-20 16-26 16-30z', corps: [3, 52, 42, 64], haut: 18 },
  flasque: { titre: 'Flasque', contour: 'M21 4h6v34c0 4 7 8 7 16v54a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V54c0-8 7-12 7-16z', corps: [14, 52, 20, 64], haut: 4 }
};

// Couleur du liquide (robe réelle) ; la catégorie est portée par le bouchon (couleur de la pastille).
const ROBES = { tourbe: '#D2A04A', malt: '#D9A441', sherry: '#9A4420', blend: '#DDB04E', bourbon: '#B8642C', rhum: '#9A5426', cognac: '#B86A22', edv: '#F3EEDF' };

// Forme choisie dans la fiche ; à défaut, une valeur par catégorie (simple point de départ).
const PAR_DEFAUT = { cognac: 'carafe', rhum: 'carafe', edv: 'flasque', bourbon: 'carree' };
export function formeDe(p) {
  return FORMES[p?.extra?.forme] ? p.extra.forme : PAR_DEFAUT[p?.style] || 'haute';
}

let compteur = 0;

// Silhouette seule (formulaire) ou bouteille complète (liquide, bouchon, numéro, halo).
export function silhouette(forme, { produit = null, bouteille = null, trouve = false, taille = null } = {}) {
  const f = FORMES[forme] || FORMES.haute;
  const svg = svgEl('svg', { viewBox: '-6 -2 60 122', class: 'bar-svg', 'aria-hidden': 'true', ...(taille ? { width: taille * 0.5, height: taille } : {}) });
  if (!bouteille) {
    svg.append(svgEl('path', { d: f.contour, class: 'bar-forme' }));
    return svg;
  }
  const id = `bar-clip-${++compteur}`;
  const niveau = bouteille.etat === 'ouverte' ? Math.max(0, Math.min(100, bouteille.niveau ?? 100)) : 100;
  const [cx, cy, cw, ch] = f.corps;
  const hLiquide = (ch * niveau) / 100;
  const clip = svgEl('clipPath', { id });
  clip.append(svgEl('path', { d: f.contour }));
  if (trouve) svg.append(svgEl('ellipse', { cx: 24, cy: 70, rx: 29, ry: 56, class: 'bar-halo' }));
  svg.append(
    clip,
    svgEl('path', { d: f.contour, class: 'bar-verre' }),
    svgEl('rect', { x: cx, y: cy + ch - hLiquide, width: cw, height: hLiquide + 8, fill: ROBES[produit?.style] || '#D9A441', 'clip-path': `url(#${id})`, class: 'bar-liquide' }),
    svgEl('path', { d: f.contour, class: 'bar-contour' }),
    svgEl('rect', { x: 18, y: f.haut - 5, width: 12, height: 9, rx: 2, fill: produit?.styleInfo?.pastille || '#5C5045', class: 'bar-bouchon' }),
    svgEl('rect', { x: 12, y: 78, width: 24, height: 18, rx: 3, class: 'bar-etiquette' }),
    svgEl('text', { x: 24, y: 91, 'text-anchor': 'middle', class: 'bar-numero' }, String(bouteille.numero ?? ''))
  );
  return svg;
}

// groupes : [{ titre, entete (élément facultatif, ex. drapeau), resume, places: [{ bouteille, produit, trouve }] }]
export function dessinerBar(groupes, { surChoix = () => {}, parPlanche = 6 } = {}) {
  const racine = div('bar');
  for (const g of groupes) {
    const titre = document.createElement('strong');
    titre.textContent = g.titre;
    const resume = document.createElement('span');
    resume.className = 'discret';
    resume.textContent = g.resume || '';
    const bloc = div('bar-groupe', div('bar-entete', g.entete || null, titre, resume));
    bloc.setAttribute('role', 'group');
    bloc.setAttribute('aria-label', g.titre);
    for (let i = 0; i < g.places.length; i += parPlanche) {
      const planche = div('bar-planche-rang');
      planche.style.setProperty('--par-planche', parPlanche);
      const lot = g.places.slice(i, i + parPlanche);
      for (const pl of lot) {
        const { bouteille: b, produit: p } = pl;
        const niveau = b.etat === 'ouverte' ? libelleNiveau(b.niveau ?? 100) : 'Pleine';
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = `bar-place${pl.trouve ? ' trouve' : ''}`;
        bouton.dataset.numero = b.numero;
        bouton.setAttribute('aria-label', `Bouteille ${b.numero}, ${p?.nom || 'inconnue'}, ${b.etat === 'ouverte' ? `reste ${niveau}` : 'pleine'}`);
        const nom = document.createElement('span');
        nom.className = 'bar-nom';
        nom.textContent = p?.nom || 'Inconnue';
        const niv = document.createElement('span');
        niv.className = 'bar-niveau';
        niv.textContent = niveau === 'Plein' ? 'Pleine' : niveau;
        bouton.append(div('bar-bouteille', silhouette(formeDe(p), { produit: p, bouteille: b, trouve: pl.trouve })), div('bar-bois'), nom, niv);
        bouton.addEventListener('click', () => surChoix(pl));
        planche.append(bouton);
      }
      for (let k = lot.length; k < parPlanche; k++) planche.append(div('bar-place vide', div('bar-bouteille'), div('bar-bois')));
      bloc.append(planche);
    }
    racine.append(bloc);
  }
  return racine;
}
