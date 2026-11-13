// Import de photos d'étiquettes en lot : { format: 'cave-photos', photos: [{ ancien_id, nom, jpeg (base64) }] }.
// Chaque photo rejoint le produit de même identifiant d'origine (reprises), sinon de même nom. Relançable.
import { oublierPhoto } from './photos.js';

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function estFormatPhotos(d) {
  return d?.format === 'cave-photos' && Array.isArray(d.photos);
}

export async function importerPhotos(store, donnees) {
  const produits = await store.list('produits');
  const parAncien = new Map(produits.filter((p) => p.extra?.ancien_id).map((p) => [p.extra.ancien_id, p]));
  const parNom = new Map(produits.map((p) => [normaliser(p.nom), p]));
  const bilan = { associees: 0, introuvables: [] };
  for (const ph of donnees.photos) {
    const p = parAncien.get(ph.ancien_id) || parNom.get(normaliser(ph.nom));
    if (!p) { bilan.introuvables.push(ph.nom || ph.ancien_id); continue; }
    const octets = Uint8Array.from(atob(ph.jpeg), (c) => c.charCodeAt(0));
    await store.enregistrerPhoto(p.id, new Blob([octets], { type: 'image/jpeg' }));
    oublierPhoto(p.id);
    if (p.photo_path !== `${p.id}.jpg`) await store.put('produits', { ...p, photo_path: `${p.id}.jpg` });
    bilan.associees++;
  }
  return bilan;
}
