// MyOeno : algorithme d'origine (ComputeKt.computeData, app 2.3), porté à l'identique depuis la v9.3.
// Entrée : 6 entiers (référence R, V, B puis vin R, V, B). Sortie : puissance, tanins, vivacité, garde, évolution.
export function calculer(d) {
  const c1 = (v) => (v > 1 ? 1 : v);
  const r = c1(d[3] / (d[0] * 1.17)), g = c1(d[4] / (d[1] * 1.17)), b = c1(d[5] / (d[2] * 1.17));
  const lin = (v) => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
  const R = lin(r) * 100, G = lin(g) * 100, B = lin(b) * 100;
  const X = 0.4124 * R + 0.3576 * G + 0.1805 * B, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  const f = (t) => (t > 0.008856 ? Math.pow(t, 1 / 3) : t * 7.787 + 0.13793103448275862);
  const fx = f(X / 95.047), fy = f(Y / 100), fz = f(Z / 108.883);
  const L = 116 * fy - 16, A = 500 * (fx - fy), Bl = 200 * (fy - fz);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
  let h = 0;
  if (mx !== mn) {
    if (mx === r) h = (g - b) / dl + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / dl + 2;
    else h = (r - g) / dl + 4;
    h /= 6;
  }
  const h2 = h < 0.166 ? h + 0.834 : h - 0.166;
  let ev = ((h2 - 0.8) * 80) / 0.06999999999999995;
  ev = ev < 0 ? 0 : ev > 100 ? 100 : ev;
  const k = -0.15 * ev, d50 = Bl + k, d51 = 100 - L + k;
  const d55 = (((100 - A + (100 - ev)) / 2 - 41) * 41) / 30 + 30;
  let tan = ((d50 - 4) * 70) / 28 + 15, pui = ((d51 - 26) * 65) / 50 + 20, viv = d55 + ((d55 - pui - 10) / 10) * 3;
  const evo = ev < 10 ? 10 : ev > 90 ? 90 : ev, cl = (v) => (v < 5 ? 5 : v > 95 ? 95 : v);
  viv = cl(viv); tan = cl(tan); pui = cl(pui);
  const garde = (tan / 7 - 2) * ((100 - evo) / 100);
  const [puissance, tanins, vivacite, gardeR, evolution] = [pui, tan, viv, garde, evo].map((v) => (Number.isFinite(v) ? Math.round(v) : null));
  return { puissance, tanins, vivacite, garde: gardeR, evolution };
}

// Trame BLE → { etat } (1 prêt, 2 trop de lumière, 3 instable, 4 mesure) ou { brut, valeurs } (résultat).
export const ETATS = {
  1: { niveau: 'ok', texte: 'Plongez la pointe du scanner dans le verre.' },
  2: { niveau: 'alerte', texte: 'Lumière ambiante trop intense : mettez-vous à l’abri de la lumière.' },
  3: { niveau: 'alerte', texte: 'Lumière trop instable : mettez-vous à l’abri de la lumière.' },
  4: { niveau: 'ok', texte: 'Mesure en cours…' }
};

export function lireTrame(dv) {
  if (dv.byteLength < 12) return null;
  const st = dv.getUint8(11);
  if (ETATS[st]) return { etat: st };
  if (st === 0) return { etat: 0 };
  const brut = [0, 1, 2, 3, 4, 5].map((i) => dv.getUint16(i * 2, false));
  return { brut, valeurs: calculer(brut) };
}

export function decrire(m) {
  const choisir = (v, t) => { for (const [a, b, w] of t) if (v >= a && v < b) return w; return null; };
  const tan = choisir(m.tanins, [[0, 40, 'discrets'], [40, 50, 'souples'], [50, 60, 'légers'], [60, 70, 'fermes'], [70, 101, 'rugueux']]);
  const viv = choisir(m.vivacite, [[0, 40, 'tendre'], [40, 50, 'ferme'], [50, 60, 'vigoureux'], [60, 70, 'anguleux'], [70, 80, 'incisif'], [80, 101, 'mordant']]);
  const pui = m.puissance > 70 ? 'le côté alcooleux' : m.puissance > 55 ? 'la chaleur' : m.puissance > 40 ? 'l’opulence' : 'la légèreté';
  return `Tanins ${tan}, une acidité qui rend ce vin ${viv}, une puissance qui exprime ${pui}.${m.evolution > 45 ? ' Vin déjà évolué.' : ' Vin encore jeune.'}`;
}

// Mots-clés suggérés : d'abord ceux que le profil mesuré justifie, puis ceux du style.
const PAR_STYLE = {
  rouge: ['Fruits rouges', 'Fruits noirs', 'Épices', 'Garrigue', 'Réglisse', 'Boisé', 'Cuir'],
  blanc: ['Agrumes', 'Fleurs blanches', 'Minéral', 'Beurré', 'Fruits blancs', 'Miel'],
  rose: ['Petits fruits', 'Agrumes', 'Fleurs', 'Léger'],
  champagne: ['Brioché', 'Fines bulles', 'Agrumes', 'Pomme'], champRose: ['Fruits rouges', 'Fines bulles', 'Brioché'], prosecco: ['Poire', 'Fleurs', 'Fines bulles'],
  liquoreux: ['Miel', 'Abricot', 'Fruits confits', 'Safran'], jaune: ['Noix', 'Curry', 'Épices'], mute: ['Fruits cuits', 'Cacao', 'Pruneau'],
  spiritueux: ['Tourbé', 'Fumé', 'Iodé', 'Vanille', 'Fruits secs', 'Sherry', 'Épicé', 'Miel', 'Céréales', 'Agrumes']
};

export function motsCles(m, style, profil = 'vin') {
  const liste = [];
  if (m) {
    if (m.tanins >= 65) liste.push('Tanins fermes', 'À carafer');
    else if (m.tanins < 45) liste.push('Tanins souples');
    if (m.vivacite >= 65) liste.push('Vif');
    if (m.puissance >= 60) liste.push('Chaleureux');
    else if (m.puissance < 40) liste.push('Léger');
    liste.push(m.evolution > 45 ? 'Évolué' : 'Jeune');
  }
  liste.push(...(profil === 'spiritueux' ? PAR_STYLE.spiritueux : PAR_STYLE[style] || PAR_STYLE.rouge), 'Long en bouche');
  return [...new Set(liste)];
}
