// Reprise des données de l'ancienne app « Cave Revival » v9.x (état caveasy_state) :
// vins, photos, emplacements du casier Montrouge. Relançable : un vin déjà repris n'est pas dupliqué.
import { codePays } from '../data/pays.js';
import { dataUrlVersBlob } from './photos.js';
import { prochainNumero, EN_CAVE } from './inventaire.js';

const COULEURS = {
  rouge: 'rouge', blanc: 'blanc', 'rosé': 'rose', rose: 'rose', effervescent: 'champagne',
  champagne: 'champagne', liquoreux: 'liquoreux', moelleux: 'liquoreux', jaune: 'jaune'
};

// État de l'ancienne app sur ce même site (même origine), s'il existe.
export function etatAncienneApp() {
  try {
    const etat = JSON.parse(localStorage.getItem('caveasy_state'));
    return etat && etat.wines && Object.keys(etat.wines).length ? etat : null;
  } catch {
    return null;
  }
}

export function estFormatV9(donnees) {
  return !!(donnees && typeof donnees === 'object' && donnees.wines && donnees.slots !== undefined && donnees.nRows);
}

const entier = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

// Conversion pure (testable) : ancien vin → produit.
export function produitDepuisV9(cle, vin) {
  const chemin = (vin.origine || '').split('>').map((s) => s.trim()).filter(Boolean);
  return {
    profil: 'vin',
    nom: vin.nom || 'Sans nom',
    producteur: vin.domaine || null,
    millesime: entier(vin.millesime),
    style: COULEURS[(vin.couleur || '').toLowerCase()] || null,
    pays: codePays(chemin[0]),
    region: chemin[1] || null,
    appellation: vin.appellation || chemin[chemin.length - 1] || null,
    apogee_debut: entier(vin.garde_de),
    apogee_fin: entier(vin.garde_a),
    extra: { ancien_id: cle, source: 'cave-revival-v9', ...(vin.apo_src ? { apogee_source: vin.apo_src } : {}) }
  };
}

// slots « r-i » (rangée 1 en bas, emplacement 0..n-1) → « R<r>-E<i+1> ».
export function emplacementDepuisV9(cle) {
  const [r, i] = cle.split('-').map(Number);
  return `R${r}-E${i + 1}`;
}

export async function importerV9(store, etat) {
  const bilan = { vins: 0, deja: 0, bouteilles: 0, photos: 0 };
  const produits = await store.list('produits', { tous: true });
  const parAncienId = new Map(produits.filter((p) => p.extra?.ancien_id).map((p) => [p.extra.ancien_id, p]));

  // Le casier Montrouge
  const rangements = await store.list('rangements');
  let casier = rangements.find((r) => r.type === 'montrouge');
  if (!casier) {
    casier = await store.put('rangements', {
      nom: 'Casier Montrouge', type: 'montrouge', lignes: etat.nRows || 8, colonnes: etat.perRow || 6,
      ble_id: etat.device?.address || null
    });
  }

  for (const [cle, vin] of Object.entries(etat.wines)) {
    if (parAncienId.has(cle)) { bilan.deja++; continue; }
    const produit = await store.put('produits', produitDepuisV9(cle, vin));
    parAncienId.set(cle, produit);
    bilan.vins++;
    if (typeof vin.photo === 'string' && vin.photo.startsWith('data:image')) {
      await store.enregistrerPhoto(produit.id, await dataUrlVersBlob(vin.photo));
      await store.put('produits', { ...produit, photo_path: `${produit.id}.jpg` });
      bilan.photos++;
    }
  }

  // Emplacements occupés que l'ancienne app n'avait pas identifiés : une fiche « À identifier ».
  const inconnus = Object.entries(etat.slots || {}).filter(([, v]) => !v || !etat.wines[v]);
  if (inconnus.length && !parAncienId.has('?')) {
    parAncienId.set('?', await store.put('produits', {
      profil: 'vin', nom: 'À identifier', commentaire: 'Bouteilles présentes dans le casier mais non identifiées dans l\u2019ancienne app.',
      extra: { ancien_id: '?', a_identifier: true, source: 'cave-revival-v9' }
    }));
  }

  const occupes = new Set((await store.list('bouteilles'))
    .filter((b) => b.rangement_id === casier.id && EN_CAVE.includes(b.etat)).map((b) => b.emplacement));
  let numero = await prochainNumero(store);
  for (const [slot, cleVin] of Object.entries(etat.slots || {})) {
    const emplacement = emplacementDepuisV9(slot);
    const produit = parAncienId.get(cleVin && etat.wines[cleVin] ? cleVin : '?');
    if (!produit || occupes.has(emplacement)) continue;
    await store.put('bouteilles', {
      produit_id: produit.id, rangement_id: casier.id, emplacement, numero: numero++, etat: 'stock'
    });
    occupes.add(emplacement);
    bilan.bouteilles++;
  }
  return bilan;
}
