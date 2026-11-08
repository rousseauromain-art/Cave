// Correspondance nom de pays (ancienne app, saisie libre) → code de drapeau.
export const PAYS_PAR_NOM = {
  france: 'FR', italie: 'IT', espagne: 'ES', allemagne: 'DE', portugal: 'PT', chili: 'CL',
  ecosse: 'SC', 'écosse': 'SC', bretagne: 'BZH', japon: 'JP', 'etats-unis': 'US', 'états-unis': 'US', usa: 'US',
  venezuela: 'VE', irlande: 'IE'
};

export function codePays(nom) {
  if (!nom) return null;
  return PAYS_PAR_NOM[nom.trim().toLowerCase()] || null;
}
