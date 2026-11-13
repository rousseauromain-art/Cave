// Types de rangement, collection (vins / spiritueux / mixte) et libellés d'emplacement.
// Code d'emplacement commun à toutes les grilles : R<rangée>-E<place> (rangée 1 = en bas, comme le casier).

export const TYPES = {
  placard: { titre: 'Placard', grille: null, collection: 'mixte' },
  etagere: { titre: 'Étagère', grille: null, collection: 'mixte' },
  carton: { titre: 'Carton / caisse', grille: null, collection: 'mixte' },
  casier: { titre: 'Casier à bouteilles', grille: 'casier', collection: 'vin' },
  montrouge: { titre: 'Casier Montrouge (connecté)', grille: 'casier', collection: 'vin' },
  // Bar et vitrine : vue illustrée de l'inventaire (étagères par pays…), sans emplacement précis.
  bar: { titre: 'Bar', grille: null, vue: 'bar', collection: 'spiritueux' },
  vitrine: { titre: 'Vitrine', grille: null, vue: 'bar', collection: 'spiritueux' }
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

// Vue du détail : 'bar' (illustration), 'casier' (grille de culs de bouteille) ou 'liste'.
export function vueDe(r) {
  return TYPES[r?.type]?.vue || (grilleDe(r) ? 'casier' : 'liste');
}

// Emplacement affiché seulement pour les rangements à grille (« R3-E2 »).
export function libelleEmplacement(r, code) {
  return code && grilleDe(r) ? code : '';
}
