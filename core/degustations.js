// Dégustations et mesures : historique commun (écran Dégustations, fiche) et suppression.

// Départage deux dégustations du même jour : la dernière enregistrée d'abord.
const recent = (l) => String(l.degustation?.modifie_le || l.mesure?.modifie_le || '');

export async function historique(store, { produitId = null } = {}) {
  const [mesures, degustations, produits] = await Promise.all([store.list('mesures'), store.list('degustations'), store.list('produits')]);
  const parId = new Map(produits.map((p) => [p.id, p]));
  const degParMesure = new Map(degustations.filter((d) => d.mesure_id).map((d) => [d.mesure_id, d]));
  const lignes = mesures.map((m) => ({ mesure: m, degustation: degParMesure.get(m.id) || null, produit: parId.get(m.produit_id) || null, quand: m.mesure_le }));
  const mesuresVues = new Set(mesures.map((m) => m.id));
  for (const d of degustations.filter((x) => !x.mesure_id || !mesuresVues.has(x.mesure_id))) lignes.push({ mesure: null, degustation: d, produit: parId.get(d.produit_id) || null, quand: d.le });
  return lignes.filter((l) => !produitId || l.produit?.id === produitId).sort((a, b) => String(b.quand).localeCompare(String(a.quand)) || recent(b).localeCompare(recent(a)));
}

// Supprime une ligne d'historique : la dégustation et sa mesure. Si la note du produit venait de cette
// dégustation, elle reprend celle de la dégustation notée la plus récente (ou s'efface).
export async function supprimerDegustation(store, { mesure, degustation }) {
  if (degustation) await store.remove('degustations', degustation.id);
  if (mesure) await store.remove('mesures', mesure.id);
  const produitId = degustation?.produit_id || mesure?.produit_id;
  if (!produitId || !degustation?.note) return;
  const p = await store.get('produits', produitId);
  if (!p || Number(p.note) !== Number(degustation.note)) return;
  const restantes = (await store.list('degustations')).filter((d) => d.produit_id === produitId && d.note).sort((a, b) => String(b.le).localeCompare(String(a.le)) || String(b.modifie_le).localeCompare(String(a.modifie_le)));
  await store.put('produits', { ...p, note: restantes[0]?.note ?? null });
}
