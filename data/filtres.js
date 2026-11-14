// Filtres de l'inventaire par profil : chaque filtre est un test sur un produit enrichi (styles, stock, mesure…).
const parStyle = (...styles) => (p) => styles.includes(p.style);

export const FILTRES = {
  vin: [
    { id: 'tout', titre: 'Tout', test: () => true },
    { id: 'rouges', titre: 'Rouges', test: parStyle('rouge') },
    { id: 'blancs', titre: 'Blancs', test: parStyle('blanc', 'jaune') },
    { id: 'roses', titre: 'Rosés', test: parStyle('rose') },
    { id: 'bulles', titre: 'Bulles', test: parStyle('champagne', 'champRose', 'prosecco') },
    { id: 'doux', titre: 'Doux & mutés', test: parStyle('liquoreux', 'mute') },
    { id: 'a-mesurer', titre: 'À mesurer', test: (p) => !p.mesure },
    { id: 'sans-stock', titre: 'Sans stock', test: (p) => p.stock === 0 }
  ],
  spiritueux: [
    { id: 'tout', titre: 'Tout', test: () => true },
    { id: 'entamees', titre: 'Entamées', test: (p) => p.bouteilles.some((b) => b.etat === 'ouverte') },
    { id: 'tourbes', titre: 'Tourbés', test: parStyle('tourbe') },
    { id: 'malts', titre: 'Single malts', test: parStyle('malt', 'sherry', 'tourbe') },
    { id: 'rhums', titre: 'Rhums', test: parStyle('rhum') },
    { id: 'brutfut', titre: 'Brut de fût', test: parStyle('brutfut') },
    { id: 'cognac', titre: 'Cognac & EDV', test: parStyle('cognac', 'edv', 'calvados') },
    { id: 'sans-stock', titre: 'Sans stock', test: (p) => p.stock === 0 }
  ]
};

// Filtres de l'inventaire : ceux du profil, plus un par catégorie personnelle utilisée (avant « Sans stock »).
export function filtresPour(profil, produits) {
  const base = FILTRES[profil];
  const perso = [...new Map(produits.filter((p) => p.style?.startsWith('perso-') && p.styleInfo).map((p) => [p.style, p.styleInfo.titre])).entries()]
    .map(([cle, titre]) => ({ id: cle, titre, test: parStyle(cle) }));
  return [...base.slice(0, -1), ...perso, base.at(-1)];
}
