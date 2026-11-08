// Règles métier de l'inventaire, partagées par les modules Cave, Rangements, Ce soir, Dégustations.
import { STYLES } from '../data/styles.js';

export const EN_CAVE = ['stock', 'ouverte'];

export function styleDe(produit) {
  return STYLES[produit.profil]?.[produit.style] || null;
}

export function nomComplet(p) {
  return [p.nom, p.millesime].filter(Boolean).join(' ');
}

// Ligne d'information sous la vignette : appellation/région · millésime (vin) ou région · degré · âge (spiritueux).
export function infoCourte(p) {
  if (p.profil === 'spiritueux') {
    return [p.region, p.degre ? `${String(p.degre).replace('.', ',')} %` : null, p.age_ans ? `${p.age_ans} ans` : null].filter(Boolean).join(' · ');
  }
  return [p.appellation || p.region, p.millesime].filter(Boolean).join(' · ');
}

// Produits du profil enrichis : bouteilles en cave, stock, dernière mesure, rangements.
export async function inventaire(store, profil) {
  const [produits, bouteilles, mesures] = await Promise.all([
    store.list('produits'), store.list('bouteilles'), store.list('mesures')
  ]);
  const enCave = new Map();
  for (const b of bouteilles) {
    if (!EN_CAVE.includes(b.etat)) continue;
    if (!enCave.has(b.produit_id)) enCave.set(b.produit_id, []);
    enCave.get(b.produit_id).push(b);
  }
  const mesure = new Map();
  for (const m of mesures) {
    if (m.produit_id && (!mesure.has(m.produit_id) || m.mesure_le > mesure.get(m.produit_id).mesure_le)) mesure.set(m.produit_id, m);
  }
  return produits
    .filter((p) => !profil || p.profil === profil)
    .map((p) => {
      const bt = (enCave.get(p.id) || []).sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
      return { ...p, bouteilles: bt, stock: bt.length, mesure: mesure.get(p.id) || null, styleInfo: styleDe(p) };
    })
    .sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.nom.localeCompare(b.nom, 'fr'));
}

export async function produitEnrichi(store, id) {
  const p = await store.get('produits', id);
  if (!p || p.supprime) return null;
  return (await inventaire(store, p.profil)).find((x) => x.id === id) || null;
}

// Numéro de bouteille unique et stable (affiché dans le casier).
export async function prochainNumero(store) {
  const toutes = await store.list('bouteilles', { tous: true });
  return toutes.reduce((max, b) => Math.max(max, b.numero || 0), 0) + 1;
}

export async function ajouterBouteilles(store, produitId, n, { rangement_id = null, emplacements = [] } = {}) {
  let numero = await prochainNumero(store);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const creees = [];
  for (let i = 0; i < n; i++) {
    creees.push(await store.put('bouteilles', {
      produit_id: produitId, rangement_id, emplacement: emplacements[i] || null,
      numero: numero++, etat: 'stock', entree_le: aujourdhui
    }));
  }
  return creees;
}

// Sortie d'une bouteille : « bue » (vin) ; un spiritueux est d'abord « ouverte » puis « bue » quand il est vide.
export async function sortirBouteille(store, bouteille, etat = 'bue') {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const maj = { ...bouteille, etat };
  if (etat === 'ouverte') { maj.ouverte_le = aujourdhui; maj.niveau = maj.niveau ?? 100; } else maj.sortie_le = aujourdhui;
  if (etat !== 'ouverte') maj.emplacement = null;
  return store.put('bouteilles', maj);
}

// Emplacements d'une grille : R<rangée>-E<emplacement>, rangée 1 en bas.
export function emplacementsGrille(rangement) {
  const liste = [];
  for (let r = rangement.lignes || 0; r >= 1; r--) {
    for (let e = 1; e <= (rangement.colonnes || 0); e++) liste.push(`R${r}-E${e}`);
  }
  return liste;
}

export async function emplacementsLibres(store, rangement) {
  const occupes = new Set((await store.list('bouteilles'))
    .filter((b) => b.rangement_id === rangement.id && EN_CAVE.includes(b.etat) && b.emplacement)
    .map((b) => b.emplacement));
  return emplacementsGrille(rangement).filter((e) => !occupes.has(e));
}

export function aGrille(rangement) {
  return ['casier', 'montrouge'].includes(rangement?.type) && rangement.lignes > 0 && rangement.colonnes > 0;
}
