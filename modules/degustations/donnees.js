// Accès aux mesures et dégustations, et reprise de l'historique MyOeno de la v9.3.
import { moyenne } from '../../core/ui/radar.js';

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export async function historique(store) {
  const [mesures, degustations, produits] = await Promise.all([store.list('mesures'), store.list('degustations'), store.list('produits')]);
  const parId = new Map(produits.map((p) => [p.id, p]));
  const degParMesure = new Map(degustations.filter((d) => d.mesure_id).map((d) => [d.mesure_id, d]));
  const lignes = mesures.map((m) => ({ mesure: m, degustation: degParMesure.get(m.id) || null, produit: parId.get(m.produit_id) || null, quand: m.mesure_le }));
  for (const d of degustations.filter((x) => !x.mesure_id)) lignes.push({ mesure: null, degustation: d, produit: parId.get(d.produit_id) || null, quand: d.le });
  return lignes.sort((a, b) => String(b.quand).localeCompare(String(a.quand)));
}

// Moyenne des vins mesurés du même style (hors produit courant).
export async function moyenneDuStyle(store, style, sauf) {
  if (!style) return null;
  const produits = new Map((await store.list('produits')).filter((p) => p.style === style && p.id !== sauf).map((p) => [p.id, p]));
  return moyenne((await store.list('mesures')).filter((m) => produits.has(m.produit_id)));
}

export async function enregistrer(store, { produitId, mesure, note, motsCles, commentaire }) {
  let m = null;
  if (mesure) {
    m = await store.put('mesures', {
      produit_id: produitId || null, appareil: 'myoeno', mesure_le: mesure.quand || new Date().toISOString(),
      brut: { valeurs: mesure.brut, batterie: mesure.batterie ?? null }, ...mesure.valeurs
    });
  }
  const d = await store.put('degustations', {
    produit_id: produitId || null, mesure_id: m?.id || null, le: new Date().toISOString().slice(0, 10),
    note: note ?? null, mots_cles: motsCles, commentaire: commentaire || null
  });
  if (produitId && note) {
    const p = await store.get('produits', produitId);
    if (p) await store.put('produits', { ...p, note });
  }
  return { mesure: m, degustation: d };
}

export function historiqueV9() {
  try {
    const h = JSON.parse(localStorage.getItem('myoeno_hist'));
    return Array.isArray(h) && h.length ? h : null;
  } catch {
    return null;
  }
}

// Reprise : chaque mesure garde sa date ; le vin est retrouvé par son nom, sinon créé sans stock. Sans doublon.
export async function importerHistoriqueV9(store, hist) {
  const deja = new Set((await store.list('mesures', { tous: true })).map((m) => m.brut?.v9_date).filter(Boolean));
  const produits = await store.list('produits');
  const bilan = { mesures: 0, vins: 0, deja: 0 };
  for (const x of hist) {
    if (!x.date || deja.has(x.date)) { bilan.deja++; continue; }
    let produit = null;
    if (x.nom) {
      const cle = normaliser(x.nom);
      produit = produits.find((p) => normaliser(p.nom) === cle && (!x.millesime || String(p.millesime || '') === String(x.millesime)))
        || produits.find((p) => normaliser(p.nom) === cle);
      if (!produit) {
        produit = await store.put('produits', { profil: 'vin', nom: x.nom, millesime: Number(x.millesime) || null, extra: { source: 'myoeno-v9' } });
        produits.push(produit);
        bilan.vins++;
      }
    }
    const m = await store.put('mesures', {
      produit_id: produit?.id || null, appareil: 'myoeno', mesure_le: x.date,
      brut: { valeurs: x.raw || null, v9_date: x.date },
      puissance: x.puissance, tanins: x.tanins, vivacite: x.vivacite, garde: x.garde, evolution: x.evolution
    });
    await store.put('degustations', {
      produit_id: produit?.id || null, mesure_id: m.id, le: x.date.slice(0, 10), note: Number(x.note) || null,
      mots_cles: String(x.aromes || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean), commentaire: x.commentaire || null
    });
    bilan.mesures++;
  }
  return bilan;
}
