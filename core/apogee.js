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

// Estimation depuis la table : appellation exacte, sinon région ; renvoie { debut, fin, source } en années civiles.
export function estimer(produit, t) {
  if (!produit.millesime || !t) return null;
  const couleur = COULEUR_TABLE[produit.style] || 'Rouge';
  const app = normaliser(produit.appellation), reg = normaliser(produit.region);
  let cle = null;
  for (const k of Object.keys(t)) {
    const fin = normaliser(k.split('>').at(-1));
    if (app && fin === app && t[k][couleur]) { cle = k; break; }
  }
  if (!cle && reg) cle = Object.keys(t).find((k) => normaliser(k.split('>').at(-1)) === reg && t[k][couleur]) || null;
  if (!cle) return null;
  const [a, b] = t[cle][couleur];
  return { debut: produit.millesime + a, fin: produit.millesime + b, source: `Table d'apogée Caveasy : ${cle}` };
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
