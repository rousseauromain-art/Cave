// Reprise de la page « Collection Privée — Carte des Origines » (legacy/collection-privee-whisky.html, même site) :
// chaque expression devient un produit spiritueux avec une bouteille en stock. Relançable sans doublon.
import { prochainNumero } from './inventaire.js';

export const CHEMIN_COLLECTION = 'legacy/collection-privee-whisky.html';

// Extrait le tableau SITES de la page (fichier statique de ce dépôt, pas une source externe).
export function extraireSites(html) {
  const m = html.match(/const SITES = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error('collection introuvable dans la page');
  return new Function(`return ${m[1]}`)();
}

export async function chargerCollection() {
  const r = await fetch(CHEMIN_COLLECTION, { cache: 'no-store' });
  if (!r.ok) return null;
  return extraireSites(await r.text());
}

const nombre = (v) => { const m = String(v ?? '').replace(',', '.').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

function pays(site) {
  if (site.bzh) return 'BZH';
  const r = `${site.region} ${site.name}`.toLowerCase();
  if (site.type === 'scotch') return /irlande|ireland/.test(r) ? 'IE' : 'SC';
  if (site.type === 'japon') return 'JP';
  if (site.type === 'canada') return 'CA';
  if (site.type === 'grappa') return 'IT';
  if (/ibiza|espagne/.test(r)) return 'ES';
  if (/moscou|russie/.test(r)) return 'RU';
  if (/cuba/.test(r)) return 'CU';
  if (site.type === 'france' || site.type === 'rhum') return 'FR';
  return null;
}

function style(site, e) {
  const t = `${e.n} ${e.notes || ''}`.toLowerCase();
  if (site.type === 'rhum') return 'rhum';
  if (site.type === 'grappa' || /eau[ -]de[ -]vie|e\. de vie|vodka|hierbas|grappa/.test(t)) return 'edv';
  if (/cognac|armagnac|lambig|calvados|cormeil|fine bretagne/.test(t)) return 'cognac';
  if ((e.badges || []).includes('peat') || /tourb/.test(t)) return 'tourbe';
  if (/bourbon/.test(e.n.toLowerCase())) return 'bourbon';
  if (/sherry|oloroso|\bpx\b|pedro xim/.test(t)) return 'sherry';
  if (/blend/.test(t)) return 'blend';
  return 'malt';
}

// Conversion pure (testée) : expression → produit spiritueux.
export function produitDepuisExpression(site, e) {
  const age = /ans/i.test(e.age || '') ? nombre(e.age) : null;
  const annee = !age && e.n.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
  return {
    profil: 'spiritueux',
    nom: e.n,
    producteur: site.name,
    region: site.region || null,
    pays: pays(site),
    style: style(site, e),
    age_ans: age,
    millesime: annee ? Number(annee[1]) : null,
    degre: nombre(e.abv),
    commentaire: e.notes || null,
    extra: {
      ancien_id: `${site.id}:${e.n}`, source: 'collection-privee', lien: e.link || null, badges: e.badges || [],
      lieu: site.lat ? { lat: site.lat, lon: site.lon } : null
    }
  };
}

export async function importerCollection(store, sites) {
  const deja = new Set((await store.list('produits', { tous: true })).map((p) => p.extra?.ancien_id).filter(Boolean));
  let numero = await prochainNumero(store);
  const bilan = { flacons: 0, deja: 0 };
  for (const site of sites) {
    for (const e of site.expressions || []) {
      const p = produitDepuisExpression(site, e);
      if (deja.has(p.extra.ancien_id)) { bilan.deja++; continue; }
      const cree = await store.put('produits', p);
      await store.put('bouteilles', { produit_id: cree.id, numero: numero++, etat: 'stock' });
      deja.add(p.extra.ancien_id);
      bilan.flacons++;
    }
  }
  return bilan;
}
