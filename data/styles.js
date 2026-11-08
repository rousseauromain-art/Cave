// Styles de produits : couleur de la pastille, fond et texte de l'étiquette générée.
// Données de contenu (pas de thème) : partagées par l'inventaire, le casier et l'aide.
export const STYLES = {
  vin: {
    rouge: { titre: 'Rouge', pastille: '#7A1530', fond: '#5C1027', texte: '#FFFFFF' },
    blanc: { titre: 'Blanc sec', pastille: '#E7CF7A', fond: '#F3EACB', texte: '#3A2E12' },
    rose: { titre: 'Rosé', pastille: '#EFA3B4', fond: '#F6CFD7', texte: '#4A1424' },
    jaune: { titre: 'Vin jaune, oxydatif', pastille: '#C8961E', fond: '#E9C562', texte: '#3A2A05' },
    liquoreux: { titre: 'Liquoreux', pastille: '#D49A2A', fond: '#E7B04C', texte: '#3A2405' },
    champagne: { titre: 'Effervescent blanc', pastille: '#E7CF7A', fond: '#EFE3B8', texte: '#3A2E12', bulles: true },
    champRose: { titre: 'Effervescent rosé', pastille: '#EFA3B4', fond: '#F6CFD7', texte: '#4A1424', bulles: true },
    prosecco: { titre: 'Effervescent, cuve close', pastille: '#C9DD8E', fond: '#E4EDC6', texte: '#2A3410', bulles: true },
    mute: { titre: 'Muté', pastille: '#4E0E22', fond: '#3E0B1B', texte: '#FFFFFF' }
  },
  spiritueux: {
    tourbe: { titre: 'Single malt tourbé', pastille: '#3A2A1E', fond: '#4A3626', texte: '#FFFFFF' },
    malt: { titre: 'Single malt', pastille: '#C98A2B', fond: '#E2B465', texte: '#2B1A08' },
    sherry: { titre: 'Fût de sherry', pastille: '#7A2E14', fond: '#8E3A1C', texte: '#FFFFFF' },
    blend: { titre: 'Blend', pastille: '#D9A441', fond: '#EBCB86', texte: '#2B1A08' },
    bourbon: { titre: 'Bourbon', pastille: '#A4501F', fond: '#9C4A1A', texte: '#FFFFFF' },
    rhum: { titre: 'Rhum', pastille: '#5E3218', fond: '#6E3C1E', texte: '#FFFFFF' },
    cognac: { titre: 'Cognac / Armagnac', pastille: '#B5651D', fond: '#D48A45', texte: '#2B1A08' },
    edv: { titre: 'Eau-de-vie blanche', pastille: '#EDE6D3', fond: '#F3EEDF', texte: '#3A3020' }
  }
};
