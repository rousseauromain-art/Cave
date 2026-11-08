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
    { id: 'cognac', titre: 'Cognac & EDV', test: parStyle('cognac', 'edv') },
    { id: 'sans-stock', titre: 'Sans stock', test: (p) => p.stock === 0 }
  ]
};
