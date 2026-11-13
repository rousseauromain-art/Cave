// Étagère de bar : bouteilles debout en silhouette (forme selon la catégorie), liquide à son niveau, halo de recherche.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, texte) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  if (texte !== undefined) e.textContent = texte;
  return e;
};

// Silhouettes dans une case de 48 × 120 (base à y = 116). corps = zone remplissable (pour le liquide).
const FORMES = {
  haute: { contour: 'M20 6h8v20c0 6 10 10 10 20v62a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V46c0-10 10-14 10-20z', corps: [10, 44, 28, 72] },
  ronde: { contour: 'M20 30h8v12c10 4 16 16 16 30v30a14 14 0 0 1-14 14H18A14 14 0 0 1 4 102V72c0-14 6-26 16-30z', corps: [4, 54, 40, 62] },
  carafe: { contour: 'M19 18h10v18c0 4 16 10 16 30v38a12 12 0 0 1-12 12H15A12 12 0 0 1 3 104V66c0-20 16-26 16-30z', corps: [3, 52, 42, 64] },
  flasque: { contour: 'M21 4h6v34c0 4 7 8 7 16v54a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V54c0-8 7-12 7-16z', corps: [14, 52, 20, 64] },
  carree: { contour: 'M19 14h10v18l8 8v68a8 8 0 0 1-8 8H19a8 8 0 0 1-8-8V40l8-8z', corps: [11, 42, 26, 74] }
};

// Couleur du liquide (robe réelle) ; la catégorie est portée par le bouchon (couleur de la pastille).
const ROBES = { tourbe: '#D2A04A', malt: '#D9A441', sherry: '#9A4420', blend: '#DDB04E', bourbon: '#B8642C', rhum: '#9A5426', cognac: '#B86A22', edv: '#F3EEDF' };

export function formeDe(p) {
  if (!p) return 'haute';
  if (p.pays === 'JP') return 'ronde';
  if (p.style === 'cognac' || p.style === 'rhum') return 'carafe';
  if (p.style === 'edv') return 'flasque';
  if (p.style === 'bourbon') return 'carree';
  return 'haute';
}

let compteur = 0;

// etageres : [{ titre, places: [{ code, bouteille, produit, trouve }] }] ; surChoix(place) au toucher.
export function dessinerEtagere(etageres, { surChoix = () => {} } = {}) {
  const racine = document.createElement('div');
  racine.className = 'bar';
  for (const etg of etageres) {
    const n = Math.max(etg.places.length, 1), W = 52 * n + 8, H = 138;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bar-etagere', role: 'group', 'aria-label': etg.titre });
    svg.append(el('rect', { x: 0, y: 122, width: W, height: 10, rx: 2, class: 'bar-planche' }), el('rect', { x: 0, y: 132, width: W, height: 4, class: 'bar-ombre' }));
    etg.places.forEach((pl, i) => {
      const x = 6 + i * 52;
      const g = el('g', { transform: `translate(${x} 4)`, class: `bar-place${pl.bouteille ? '' : ' vide'}${pl.trouve ? ' trouve' : ''}`, 'data-emplacement': pl.code });
      if (!pl.bouteille) {
        g.append(el('path', { d: FORMES.haute.contour, class: 'bar-fantome' }));
        g.setAttribute('aria-label', `${pl.libelle} libre`);
        svg.append(g);
        return;
      }
      const f = FORMES[formeDe(pl.produit)];
      const id = `bar-clip-${++compteur}`;
      const niveau = pl.bouteille.etat === 'ouverte' ? Math.max(0, Math.min(100, pl.bouteille.niveau ?? 100)) : 100;
      const [cx, cy, cw, ch] = f.corps;
      const hLiquide = (ch * niveau) / 100;
      const couleur = ROBES[pl.produit?.style] || '#D9A441';
      const bouchon = pl.produit?.styleInfo?.pastille || '#5C5045';
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', `Bouteille ${pl.bouteille.numero}, ${pl.produit?.nom || 'inconnue'}, ${pl.libelle}${pl.bouteille.etat === 'ouverte' ? `, reste ${niveau} %` : ''}`);
      if (pl.trouve) g.append(el('ellipse', { cx: 24, cy: 74, rx: 30, ry: 56, class: 'bar-halo' }));
      g.append(
        el('clipPath', { id }, undefined),
        el('path', { d: f.contour, class: 'bar-verre' }),
        el('rect', { x: cx, y: cy + ch - hLiquide, width: cw, height: hLiquide + 8, fill: couleur, 'clip-path': `url(#${id})`, class: 'bar-liquide' }),
        el('path', { d: f.contour, class: 'bar-contour' }),
        el('rect', { x: 18, y: Number(f.contour.match(/^M[\d.]+ ([\d.]+)/)[1]) - 5, width: 12, height: 9, rx: 2, fill: bouchon, class: 'bar-bouchon' }),
        el('rect', { x: 12, y: 78, width: 24, height: 18, rx: 3, class: 'bar-etiquette' }),
        el('text', { x: 24, y: 91, 'text-anchor': 'middle', class: 'bar-numero' }, String(pl.bouteille.numero))
      );
      g.querySelector('clipPath').append(el('path', { d: f.contour }));
      const choisir = () => surChoix(pl);
      g.addEventListener('click', choisir);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); } });
      svg.append(g);
    });
    const bloc = document.createElement('div');
    bloc.className = 'bar-rangee';
    const titre = document.createElement('span');
    titre.className = 'bar-titre';
    titre.textContent = etg.titre;
    bloc.append(titre, svg);
    racine.append(bloc);
  }
  return racine;
}
