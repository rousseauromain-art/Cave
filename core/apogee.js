import { lire, ecrire } from './kv.js';
// Apogée (fenêtre de garde) et aération conseillée.
// Table d'apogée Caveasy : « Pays > Région > Appellation » → { couleur: [début, fin] } en années après le millésime.

const COULEUR_TABLE = {
  rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', jaune: 'Jaune', liquoreux: 'Blanc moelleux ou liquoreux',
  champagne: 'Blanc pétillant', champRose: 'Rosé pétillant', prosecco: 'Blanc pétillant', mute: 'Rouge'
};

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

let table = null;
export async function chargerTable() {
  if (table) return table;
  try { table = await (await fetch('data/apogee.json')).json(); } catch { table = {}; }
  return table;
}

// Mots d'étiquette sans valeur pour retrouver une appellation (« AOP Ventoux » → « ventoux »).
const MOTS_LABEL = /\b(aop|aoc|igp|vdp|appellation|d origine|origine|controlee|protegee|vin de pays|vin de france)\b/g;
const cleApp = (s) => normaliser(s).replace(MOTS_LABEL, ' ').replace(/\s+/g, ' ').trim();

// Fenêtres génériques (années après le millésime) quand ni l'appellation ni la région ne sont connues.
const GENERIQUE = { rouge: [3, 8], blanc: [1, 4], rose: [1, 2], jaune: [10, 40], liquoreux: [5, 25], champagne: [2, 6], champRose: [1, 4], prosecco: [0, 2], mute: [5, 30] };

const fenetre = (t, k, couleur) => { const f = t[k]?.[couleur]; return Array.isArray(f) && f[0] !== null && f[1] !== null ? f : null; };
const mediane = (l) => { const x = [...l].sort((a, b) => a - b); return x[Math.floor((x.length - 1) / 2)]; };

// Estimation : appellation (exacte, puis incluse), sinon région, sinon fenêtre générique de la couleur.
// Renvoie { debut, fin, source, precision: 'appellation' | 'region' | 'generique' } en années civiles, ou null sans millésime.
export function estimer(produit, t) {
  if (!produit.millesime) return null;
  t = t || {};
  const couleur = COULEUR_TABLE[produit.style] || 'Rouge';
  const app = cleApp(produit.appellation), reg = cleApp(produit.region);
  const cles = Object.keys(t).filter((k) => fenetre(t, k, couleur));
  const dernier = (k) => cleApp(k.split('>').at(-1));
  const contient = (grand, petit) => petit.length >= 4 && ` ${grand} `.includes(` ${petit} `);
  let cle = null;
  if (app) {
    cle = cles.find((k) => dernier(k) === app)
      || cles.filter((k) => contient(app, dernier(k))).sort((a, b) => dernier(b).length - dernier(a).length)[0]
      || cles.filter((k) => contient(dernier(k), app)).sort((a, b) => dernier(a).length - dernier(b).length)[0] || null;
  }
  if (!cle && reg) cle = cles.find((k) => dernier(k) === reg) || null;
  if (cle) {
    const [a, b] = fenetre(t, cle, couleur);
    return { debut: produit.millesime + a, fin: produit.millesime + b, source: `Table d'apogée Caveasy : ${cle}`, precision: 'appellation' };
  }
  // Région viticole (« Rhône », « Bourgogne ») : médiane des appellations de la région.
  const deRegion = reg || app ? cles.filter((k) => [reg, app].includes(cleApp(k.split('>')[1] || ''))) : [];
  if (deRegion.length) {
    const f = deRegion.map((k) => fenetre(t, k, couleur));
    const nom = deRegion[0].split('>').slice(0, 2).join('>').trim();
    return { debut: produit.millesime + mediane(f.map((x) => x[0])), fin: produit.millesime + mediane(f.map((x) => x[1])), source: `Médiane des appellations ${nom} (${deRegion.length})`, precision: 'region' };
  }
  const g = GENERIQUE[produit.style] || GENERIQUE.rouge;
  return { debut: produit.millesime + g[0], fin: produit.millesime + g[1], source: 'Fenêtre générique de la couleur (sans appellation reconnue)', precision: 'generique' };
}

// Informations utiles aux calculs, pour les afficher dans la fiche : [{ libelle, valeur, ok, requis }].
export function prerequis(p, quoi) {
  if (quoi === 'apogee') {
    const precision = p.apogee?.precision;
    return [
      { libelle: 'Millésime', valeur: p.millesime, ok: !!p.millesime, requis: true },
      { libelle: 'Couleur', valeur: p.styleInfo?.titre, ok: !!p.style, requis: false, aide: 'rouge supposé' },
      { libelle: 'Appellation ou région', valeur: p.appellation || p.region, ok: !!(p.appellation || p.region) && precision !== 'generique', requis: false,
        aide: p.appellation || p.region ? 'non reconnue dans la table' : 'estimation générique sinon' }
    ];
  }
  return [
    { libelle: 'Couleur', valeur: p.styleInfo?.titre, ok: !!p.style, requis: true },
    { libelle: 'Apogée (phase)', valeur: p.phase ? PHASES[p.phase] : null, ok: !!p.phase, requis: false, aide: 'apogée supposée' },
    { libelle: 'Tanins (mesure MyOeno)', valeur: p.mesure ? String(p.mesure.tanins) : null, ok: !!p.mesure, requis: false, aide: 'tanins moyens supposés' }
  ];
}

// Phase à une date : jeunesse avant la fenêtre, apogée dedans, déclin après.
export function phase(debut, fin, annee = new Date().getFullYear()) {
  if (!debut || !fin) return null;
  if (annee < debut) return 'jeunesse';
  if (annee <= fin) return 'apogee';
  return 'declin';
}

export const PHASES = { jeunesse: 'Jeunesse', apogee: 'Apogée', declin: 'Déclin' };

// Aération : H = min(Hmax, max(1, B_couleur × f_phase × (0,6 + T/100) × p)), arrondie à l'heure ; 0 pour les effervescents.
const BASE = { rouge: 6, mute: 2, blanc: 2, jaune: 2, rose: 1, liquoreux: 1, champagne: 0, champRose: 0, prosecco: 0 };
const F_PHASE = { jeunesse: 1.5, apogee: 1, declin: 0.25 };

export function aeration({ style, phase: ph, tanins = null, preference = 1, hmax = 24 }) {
  const b = BASE[style] ?? 4;
  if (b === 0) return 0;
  const t = tanins ?? 50;
  const h = b * (F_PHASE[ph] ?? 1) * (0.6 + t / 100) * preference;
  return Math.min(hmax, Math.max(1, Math.round(h)));
}

// Température de service conseillée (°C) selon le style.
export const SERVICE = {
  rouge: [16, 18], mute: [14, 16], blanc: [10, 12], jaune: [14, 15], rose: [8, 10], liquoreux: [8, 10],
  champagne: [7, 9], champRose: [7, 9], prosecco: [6, 8]
};

// Température de service : celle du producteur si elle a été lue (page web), sinon celle du style.
export const temperaturePour = (p) => p.extra?.temperature || SERVICE[p.style] || null;

// Courbe de garde pour le dessin : points [année, qualité 0..1] entre le millésime et fin + durée.
export function courbe(millesime, debut, fin) {
  const span = Math.max(1, fin - debut), finTrace = fin + span + 1;
  const q = (y) => {
    if (y < debut) return 0.3 + 0.7 * Math.pow((y - millesime) / Math.max(0.5, debut - millesime), 0.85);
    if (y <= fin) return 1;
    return Math.max(0.2, 1 - 0.8 * Math.pow((y - fin) / (span + 1), 1.4));
  };
  const points = [];
  for (let y = millesime; y <= finTrace + 0.001; y += 0.1) points.push([y, Math.max(0, Math.min(1, q(y)))]);
  return { points, de: millesime, a: finTrace, q };
}

// Réglages de service (appareil Aveine et goût personnel), sur cet appareil.
export const MODELES = { aveine: { titre: 'Aveine (1–24 h)', hmax: 24 }, essentiel: { titre: 'Aveine Essentiel (1–12 h)', hmax: 12 } };
export const PREFERENCES = { 0.7: 'Plutôt courte', 1: 'Conseillée', 1.3: 'Plutôt longue' };
export function reglagesService() {
  return { modele: 'aveine', preference: 1, ...lire('service', {}) };
}
export function enregistrerReglagesService(r) {
  ecrire('service', { ...reglagesService(), ...r });
}
export function aerationPour(p) {
  const r = reglagesService();
  return aeration({ style: p.style, phase: p.phase, tanins: p.mesure?.tanins ?? null, preference: Number(r.preference), hmax: MODELES[r.modele]?.hmax ?? 24 });
}
