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
    tourbe: { titre: 'Single malt tourbé', pastille: '#2A1D14', fond: '#6A5040', texte: '#FFFFFF' },
    malt: { titre: 'Single malt', pastille: '#C98A2B', fond: '#E2B465', texte: '#2B1A08' },
    sherry: { titre: 'Fût de sherry', pastille: '#7A2E14', fond: '#8E3A1C', texte: '#FFFFFF' },
    blend: { titre: 'Blend', pastille: '#D9A441', fond: '#EBCB86', texte: '#2B1A08' },
    bourbon: { titre: 'Bourbon', pastille: '#A4501F', fond: '#9C4A1A', texte: '#FFFFFF' },
    rhum: { titre: 'Rhum', pastille: '#5E3218', fond: '#6E3C1E', texte: '#FFFFFF' },
    cognac: { titre: 'Cognac / Armagnac', pastille: '#B5651D', fond: '#D48A45', texte: '#2B1A08' },
    edv: { titre: 'Eau-de-vie blanche', pastille: '#EDE6D3', fond: '#F3EEDF', texte: '#3A3020' },
    brutfut: { titre: 'Brut de fût (cask strength)', pastille: '#5B2333', fond: '#6B2A3C', texte: '#FFFFFF' },
    grain: { titre: 'Single grain', pastille: '#E3C77E', fond: '#F0DDA8', texte: '#2B1A08' },
    rye: { titre: 'Rye', pastille: '#8A5A2B', fond: '#9A6634', texte: '#FFFFFF' },
    calvados: { titre: 'Calvados', pastille: '#C7792E', fond: '#DC9A55', texte: '#2B1A08' },
    gin: { titre: 'Gin', pastille: '#9EC3C6', fond: '#D6E8E9', texte: '#173436' },
    liqueur: { titre: 'Liqueur', pastille: '#8E2C4F', fond: '#9E3A5E', texte: '#FFFFFF' }
  }
};

// Couleurs proposées pour une catégorie créée par l'utilisateur.
export const COULEURS_PERSO = ['#2F5D50', '#3B4F7A', '#6A3D7A', '#8E2C4F', '#B3541E', '#C9A227', '#5E6B2E', '#4A4A4A'];

// Catégorie créée dans une fiche : portée par le produit (extra.style_perso), donc synchronisée avec lui.
export function stylePerso(sp) {
  if (!sp?.titre || !/^#[0-9a-f]{6}$/i.test(sp.pastille || '')) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(sp.pastille.slice(i, i + 2), 16) / 255);
  const clair = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
  return { titre: sp.titre, pastille: sp.pastille, fond: sp.pastille, texte: clair ? '#1E1610' : '#FFFFFF', perso: true };
}

// Clé de style d'une catégorie personnelle (« perso-brut-de-fut »).
export const clePerso = (titre) => 'perso-' + titre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Catégories personnelles déjà utilisées dans les produits d'un profil : { cle: { titre, pastille } }.
export function categoriesPerso(produits, profil) {
  const r = {};
  for (const p of produits) if (p.profil === profil && p.style?.startsWith('perso-') && stylePerso(p.extra?.style_perso)) r[p.style] = p.extra.style_perso;
  return r;
}
