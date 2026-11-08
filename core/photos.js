// Photos d'étiquettes : réduction côté téléphone (≤ 1200 px, ≤ 300 Ko) et URL d'affichage mises en cache.
const urls = new Map();

export async function compresser(fichier, { cote = 1200, poids = 300 * 1024 } = {}) {
  const image = await createImageBitmap(fichier);
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  let qualite = 0.82, blob;
  do {
    blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', qualite));
    qualite -= 0.12;
  } while (blob.size > poids && qualite > 0.3);
  return blob;
}

export async function urlPhoto(store, produitId) {
  if (urls.has(produitId)) return urls.get(produitId);
  const blob = await store.photo(produitId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(produitId, url);
  return url;
}

export function oublierPhoto(produitId) {
  if (urls.has(produitId)) { URL.revokeObjectURL(urls.get(produitId)); urls.delete(produitId); }
}

export async function dataUrlVersBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}
