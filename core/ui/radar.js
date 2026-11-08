// Triangle MyOeno (puissance en haut, tanins à droite, vivacité à gauche), échelle 0–120 comme l'app d'origine.
const NS = 'http://www.w3.org/2000/svg';
const ANGLES = [-90, 30, 150].map((a) => (a * Math.PI) / 180);
const CLES = ['puissance', 'tanins', 'vivacite'];
const NOMS = ['Puissance', 'Tanins', 'Vivacité'];

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function radar(m, { taille = 240, etiquettes = true, fantome = null, legende = '' } = {}) {
  const c = taille / 2, R = taille * (etiquettes ? 0.34 : 0.44), cy = c + (etiquettes ? 8 : 4);
  const pt = (v, i) => {
    const r = (R * Math.max(0, Math.min(120, v || 0))) / 120;
    return `${(c + r * Math.cos(ANGLES[i])).toFixed(1)},${(cy + r * Math.sin(ANGLES[i])).toFixed(1)}`;
  };
  const poly = (o) => CLES.map((k, i) => pt(o[k], i)).join(' ');
  const svg = el('svg', {
    viewBox: `0 0 ${taille} ${taille}`, width: taille, height: taille, class: 'radar', role: 'img',
    'aria-label': `Profil : puissance ${m.puissance}, tanins ${m.tanins}, vivacité ${m.vivacite}${legende ? ` ; en pointillés, ${legende}` : ''}`
  });
  [120, 80, 40].forEach((f) => svg.append(el('polygon', { points: CLES.map((k, i) => pt(f, i)).join(' '), class: f === 120 ? 'radar-cadre' : 'radar-grille' })));
  if (fantome) svg.append(el('polygon', { points: poly(fantome), class: 'radar-fantome' }));
  svg.append(el('polygon', { points: poly(m), class: 'radar-vin' }));
  if (etiquettes) {
    CLES.forEach((k, i) => {
      const [x, y] = pt(150, i).split(',').map(Number);
      const t = el('text', { x: Math.min(taille - 4, Math.max(4, x)), y: i === 0 ? y + 4 : y + 4, 'text-anchor': i === 0 ? 'middle' : i === 1 ? 'end' : 'start', class: 'radar-texte' });
      t.textContent = `${NOMS[i]} ${m[k] ?? '–'}`;
      svg.append(t);
    });
  }
  return svg;
}

// Moyenne des profils d'un ensemble de mesures (pointillés « vos vins du même style »).
export function moyenne(mesures) {
  if (!mesures.length) return null;
  const o = {};
  for (const k of CLES) o[k] = Math.round(mesures.reduce((s, m) => s + (m[k] || 0), 0) / mesures.length);
  return o;
}
