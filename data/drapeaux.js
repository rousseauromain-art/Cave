// Drapeaux dessinés dans un carré 24×24 : rectangles [x, y, l, h, couleur] et polygones [points, couleur].
const bandesV = (a, b, c) => [[0, 0, 8, 24, a], [8, 0, 8, 24, b], [16, 0, 8, 24, c]];
const bandesH = (a, b, c) => [[0, 0, 24, 8, a], [0, 8, 24, 8, b], [0, 16, 24, 8, c]];

function etoile(cx, cy, R, r) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function polygoneRegulier(cx, cy, r, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

const hermine = (x, y) => [`${x},${y - 1.4} ${x + 0.9},${y} ${x},${y + 1.4} ${x - 0.9},${y}`, '#111111'];
const pas9 = 24 / 9, pas7 = 24 / 7;

export const DRAPEAUX = {
  FR: { nom: 'France', r: bandesV('#0055A4', '#FFFFFF', '#EF4135') },
  IT: { nom: 'Italie', r: bandesV('#009246', '#FFFFFF', '#CE2B37') },
  ES: { nom: 'Espagne', r: [[0, 0, 24, 6, '#AA151B'], [0, 6, 24, 12, '#F1BF00'], [0, 18, 24, 6, '#AA151B']] },
  DE: { nom: 'Allemagne', r: bandesH('#000000', '#DD0000', '#FFCE00') },
  PT: { nom: 'Portugal', r: [[0, 0, 9.6, 24, '#046A38'], [9.6, 0, 14.4, 24, '#DA291C']], p: [[polygoneRegulier(9.6, 12, 4, 8), '#FFE900']] },
  CL: { nom: 'Chili', r: [[0, 0, 24, 12, '#FFFFFF'], [0, 12, 24, 12, '#D52B1E'], [0, 0, 10, 12, '#0039A6']], p: [[etoile(5, 6, 3.2, 1.3), '#FFFFFF']] },
  SC: { nom: 'Écosse', r: [[0, 0, 24, 24, '#005EB8']], p: [['0,0 3.4,0 24,20.6 24,24 20.6,24 0,3.4', '#FFFFFF'], ['24,0 24,3.4 3.4,24 0,24 0,20.6 20.6,0', '#FFFFFF']] },
  BZH: {
    nom: 'Bretagne',
    r: [[0, 0, 24, 24, '#FFFFFF'], ...[0, 2, 4, 6, 8].map((k) => [0, k * pas9, 24, pas9, '#111111']), [0, 0, 11, 5 * pas9, '#FFFFFF']],
    p: [hermine(2.8, 3.4), hermine(5.5, 3.4), hermine(8.2, 3.4), hermine(4.1, 7.6), hermine(6.9, 7.6), hermine(5.5, 11.2)]
  },
  JP: { nom: 'Japon', r: [[0, 0, 24, 24, '#FFFFFF']], p: [[polygoneRegulier(12, 12, 6.2, 24), '#BC002D']] },
  US: { nom: 'États-Unis', r: [[0, 0, 24, 24, '#FFFFFF'], ...[0, 2, 4, 6].map((k) => [0, k * pas7, 24, pas7, '#B22234']), [0, 0, 11, pas7 * 4, '#3C3B6E']] },
  VE: { nom: 'Venezuela', r: bandesH('#FFCC00', '#00247D', '#CF142B') },
  IE: { nom: 'Irlande', r: bandesV('#169B62', '#FFFFFF', '#FF883E') }
};
