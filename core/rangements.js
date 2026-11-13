// Types de rangement, collection (vins / spiritueux / mixte) et libellés d'emplacement.
// Code d'emplacement commun à toutes les grilles : R<rangée>-E<place> (rangée 1 = en bas, comme le casier).

export const TYPES = {
  placard: { titre: 'Placard', grille: null, collection: 'mixte' },
  etagere: { titre: 'Étagère', grille: null, collection: 'mixte' },
  carton: { titre: 'Carton / caisse', grille: null, collection: 'mixte' },
  casier: { titre: 'Casier à bouteilles', grille: 'casier', collection: 'vin' },
  montrouge: { titre: 'Casier Montrouge (connecté)', grille: 'casier', collection: 'vin' },
  bar: { titre: 'Bar (étagères à bouteilles)', grille: 'bar', collection: 'spiritueux' },
  vitrine: { titre: 'Vitrine', grille: 'bar', collection: 'spiritueux' }
};

export const COLLECTIONS = { vin: 'Vins', spiritueux: 'Spiritueux', mixte: 'Vins et spiritueux' };

// Types proposés à la création selon la collection affichée.
export function typesPour(profil) {
  return Object.entries(TYPES).filter(([, t]) => t.collection === 'mixte' || t.collection === profil);
}

export function collectionDe(r) {
  return r?.profil || TYPES[r?.type]?.collection || 'mixte';
}

export function visibleDans(r, profil) {
  const c = collectionDe(r);
  return c === 'mixte' || c === profil;
}

export function grilleDe(r) {
  const g = TYPES[r?.type]?.grille;
  return g && r.lignes > 0 && r.colonnes > 0 ? g : null;
}

// « R3-E2 » → « R3 · E2 » (casier) ou « Étagère 1 · place 2 » (bar, étagères numérotées du haut).
export function libelleEmplacement(r, code) {
  if (!code) return '';
  const m = code.match(/^R(\d+)-E(\d+)$/);
  if (!m || grilleDe(r) !== 'bar') return code;
  return `Étagère ${r.lignes - Number(m[1]) + 1} · place ${m[2]}`;
}
