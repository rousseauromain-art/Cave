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
  flasque: { titre: 'Flasque', contour: 'M21 4h6v34c0 4 7 8 7 16v54a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V54c0-8 7-12 7-16z', corps: [14, 52, 20, 64], haut: 4 },
  // Vins
  // Vins : bouteilles de profil au trait (case 60 × 150, fond à y = 146), piqûre d'après les fiches Saverglass
  // (Bordeaux 35–58 mm, Bourgogne ≈ 29 mm, Champagne ≈ 35 mm sur fond épais ; Rhône comme Bourgogne, écusson sur l'épaule).
  bordelaise: { titre: 'Bordeaux', profil: 'vin', trait: true, contour: 'M25 6 h10 v42 c0 6 11 8 11 16 v78 a4 4 0 0 1 -4 4 h-24 a4 4 0 0 1 -4 -4 v-78 c0 -8 11 -10 11 -16 z', x: [14, 46], plein: 58, piqure: [13, 22], etiquette: [84, 112] },
  bourguignonne: { titre: 'Bourgogne', profil: 'vin', trait: true, contour: 'M25 6 h10 v30 c0 18 13 26 13 44 v62 a4 4 0 0 1 -4 4 h-28 a4 4 0 0 1 -4 -4 v-62 c0 -18 13 -26 13 -44 z', x: [12, 48], plein: 50, piqure: [14, 14], etiquette: [92, 122] },
  rhodanienne: { titre: 'Côtes du Rhône', profil: 'vin', trait: true, contour: 'M25 6 h10 v32 c0 16 12 24 12 42 v62 a4 4 0 0 1 -4 4 h-26 a4 4 0 0 1 -4 -4 v-62 c0 -18 12 -26 12 -42 z', x: [13, 47], plein: 52, piqure: [14, 15], etiquette: [92, 122], ecusson: true },
  champenoise: { titre: 'Champagne', profil: 'vin', trait: true, contour: 'M24 4 h12 v36 c0 18 15 26 15 44 v58 a5 5 0 0 1 -5 5 h-32 a5 5 0 0 1 -5 -5 v-58 c0 -18 15 -26 15 -44 z', x: [9, 51], plein: 56, piqure: [16, 17], etiquette: [96, 122], muselet: true, fondEpais: true }
};
for (const f of Object.values(FORMES)) f.profil ??= 'spiritueux';

// Formes proposées pour un profil (choix dans la fiche).
export const formesPour = (profil) => Object.entries(FORMES).filter(([, f]) => f.profil === profil);

// Couleur du liquide (robe réelle) ; la catégorie est portée par le bouchon (couleur de la pastille).
const ROBES = { tourbe: '#D2A04A', malt: '#D9A441', sherry: '#9A4420', blend: '#DDB04E', bourbon: '#B8642C', rhum: '#9A5426', cognac: '#B86A22', edv: '#F3EEDF' };

// Forme choisie dans la fiche ; à défaut, une valeur par catégorie (simple point de départ).
// Vins : forme de la région (Bordeaux, Bourgogne, Côtes du Rhône, Champagne), lue dans la région, l'appellation
// ou la table d'apogée (« France > Rhône > … ») ; effervescents en champenoise ; bordelaise à défaut.
const PAR_DEFAUT = { cognac: 'carafe', rhum: 'carafe', edv: 'flasque', bourbon: 'carree', champagne: 'champenoise', champRose: 'champenoise', prosecco: 'champenoise' };
const REGIONS_VIN = [
  [/champagne|cremant/, 'champenoise'],
  [/rhone|chateauneuf|gigondas|vacqueyras|ventoux|grignan|tricastin|lirac|tavel|cairanne|rasteau|hermitage|cornas|condrieu|saint joseph|vinsobres|luberon|costieres/, 'rhodanienne'],
  [/bourgogne|beaujolais|chablis|macon|pommard|volnay|meursault|nuits|beaune|gevrey|chambolle|vosne|pouilly fuisse|santenay|givry|mercurey|rully/, 'bourguignonne'],
  [/bordeaux|medoc|graves|pessac|saint emilion|pomerol|sauternes|margaux|pauillac|saint julien|saint estephe|fronsac|entre deux mers|bergerac/, 'bordelaise']
];
const sansAccent = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ');
export function formeDe(p) {
  const profil = p?.profil || 'spiritueux';
  if (FORMES[p?.extra?.forme]?.profil === profil) return p.extra.forme;
  if (PAR_DEFAUT[p?.style] && FORMES[PAR_DEFAUT[p.style]].profil === profil) return PAR_DEFAUT[p.style];
  if (profil !== 'vin') return 'haute';
  const lieu = sansAccent(`${p?.region || ''} ${p?.appellation || ''} ${p?.apogee?.source || ''}`);
  return REGIONS_VIN.find(([motif]) => motif.test(lieu))?.[1] || 'bordelaise';
}

let compteur = 0;

// Bouteille de vin au trait : contour, vin à sa couleur, piqûre, étiquette numérotée, capsule ou muselet, écusson.
function bouteilleTrait(f, { produit, bouteille, trouve }) {
  const svg = svgEl('svg', { viewBox: '-4 0 68 152', class: 'bar-svg trait', 'aria-hidden': 'true' });
  const id = `bar-clip-${++compteur}`;
  const base = 146, cx = 30, [x1, x2] = f.x, [pl, pp] = f.piqure, [e1, e2] = f.etiquette;
  const arche = `M${cx - pl} ${base + 1} C${cx - pl * 0.6} ${base - pp} ${cx + pl * 0.6} ${base - pp} ${cx + pl} ${base + 1}`;
  const clip = svgEl('clipPath', { id });
  clip.append(svgEl('path', { d: f.contour }));
  const dansBouteille = { 'clip-path': `url(#${id})` };
  if (trouve) svg.append(svgEl('ellipse', { cx: 30, cy: 80, rx: 34, ry: 76, class: 'bar-halo' }));
  svg.append(clip, svgEl('path', { d: f.contour, class: 'trait-fond' }));
  if (bouteille) {
    const niveau = bouteille.etat === 'ouverte' ? Math.max(0, Math.min(100, bouteille.niveau ?? 100)) : 100;
    const haut = f.plein + (base - f.plein) * (1 - niveau / 100);
    svg.append(svgEl('rect', { x: 0, y: haut, width: 60, height: base - haut + 4, fill: produit?.styleInfo?.pastille || '#7A1530', class: 'bar-liquide', ...dansBouteille }));
  }
  svg.append(svgEl('path', { d: `${arche} Z`, class: 'trait-fond', ...dansBouteille }), svgEl('path', { d: arche, class: 'trait', ...dansBouteille }));
  if (f.fondEpais) svg.append(svgEl('path', { d: `M${cx - pl - 6} ${base - 1} C${cx - pl * 0.7} ${base - pp - 8} ${cx + pl * 0.7} ${base - pp - 8} ${cx + pl + 6} ${base - 1}`, class: 'trait fin', ...dansBouteille }));
  svg.append(svgEl('rect', { x: x1, y: e1, width: x2 - x1, height: e2 - e1, class: 'trait-etiquette', ...dansBouteille }), svgEl('path', { d: `M${x1} ${e1} H${x2} M${x1} ${e2} H${x2}`, class: 'trait' }));
  if (bouteille) svg.append(svgEl('text', { x: 30, y: (e1 + e2) / 2 + 5, 'text-anchor': 'middle', class: 'bar-numero trait-numero' }, String(bouteille.numero ?? '')));
  if (f.muselet) svg.append(svgEl('path', { d: 'M22 10 h16 M22 16 h16 M24 30 h12', class: 'trait fin' }));
  else svg.append(svgEl('rect', { x: 23.5, y: 10, width: 13, height: 7, rx: 1.5, class: 'trait-vide' }), svgEl('path', { d: 'M25 22 h10', class: 'trait' }));
  if (f.ecusson) svg.append(svgEl('path', { d: 'M38 60 l5 2 v4 q0 5 -5 7 q-5 -2 -5 -7 v-4z', class: 'trait-vide fin' }));
  svg.append(svgEl('path', { d: f.contour, class: 'trait-vide' }), svgEl('path', { d: `M${x1 + 6} 70 q-1 8 -1 16`, class: 'trait fin reflet' }));
  return svg;
}

// Silhouette seule (formulaire) ou bouteille complète (liquide, bouchon, numéro, halo).
export function silhouette(forme, { produit = null, bouteille = null, trouve = false, taille = null } = {}) {
  const f = FORMES[forme] || FORMES.haute;
  if (f.trait) return bouteilleTrait(f, { produit, bouteille, trouve });
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
    svgEl('rect', { x: cx, y: cy + ch - hLiquide, width: cw, height: hLiquide + 8, fill: ROBES[produit?.style] || produit?.styleInfo?.pastille || '#D9A441', 'clip-path': `url(#${id})`, class: 'bar-liquide' }),
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
        nom.textContent = [p?.nom || 'Inconnue', p?.millesime].filter(Boolean).join(' ');
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
