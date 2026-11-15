// Lecture d'une page web (fiche d'un caviste, d'un domaine) : texte de la page puis champs du produit.
// Le navigateur ne peut pas lire la plupart des sites directement (CORS) : on essaie la page, puis le service de
// lecture r.jina.ai (seule l'adresse publique lui est transmise). Sinon, le texte peut être collé à la main.
import { analyserTexte, trouverCepages, profilProbable, casse } from './identification.js';

const LECTEUR = 'https://r.jina.ai/';
const normaliser = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

// HTML → { titre, image, texte } (texte ligne par ligne, sans scripts ni menus).
export function texteDeHtml(html, base = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (n) => doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.content || null;
  doc.querySelectorAll('script, style, noscript, nav, header, footer, svg, form').forEach((e) => e.remove());
  doc.querySelectorAll('br, p, div, li, h1, h2, h3, h4, h5, h6, dt, dd, tr, section').forEach((e) => e.after(doc.createTextNode('\n')));
  const image = meta('og:image');
  return {
    titre: meta('og:title') || doc.title || null,
    image: image ? new URL(image, base || undefined).href : null,
    texte: (doc.body?.textContent || '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
  };
}

// Réponse du lecteur (« Title: … / Markdown Content: … ») → { titre, image, texte }.
function texteDeLecteur(md) {
  const titre = md.match(/^Title:\s*(.+)$/m)?.[1] || null;
  const corps = md.split(/^Markdown Content:\s*$/m)[1] ?? md;
  const image = corps.match(/!\[[^\]]*\]\((https?:[^)\s]+)\)/)?.[1] || null;
  const texte = corps.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split('\n').map((l) => l.replace(/^[#>*\-\s]+|[*_]+/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return { titre, image, texte };
}

export async function lirePage(url, { journal = () => {} } = {}) {
  if (!/^https:\/\//.test(url)) throw new Error('Adresse en https:// attendue.');
  try {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (r.ok) return texteDeHtml(await r.text(), url);
  } catch (e) {
    journal(`Lecture directe impossible (${e.message}) : passage par le lecteur`);
  }
  const r = await fetch(LECTEUR + url, { headers: { Accept: 'text/plain' } });
  if (!r.ok) throw new Error(`Page illisible (${r.status})`);
  return texteDeLecteur(await r.text());
}

// Photo du produit : téléchargée si le site l'autorise, sinon rien (la photo d'étiquette reste possible).
export async function imagePage(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
    const b = r.ok ? await r.blob() : null;
    return b && b.type.startsWith('image/') ? b : null;
  } catch {
    return null;
  }
}

// Rubriques usuelles des fiches de vin et de spiritueux (titre seul sur sa ligne, ou « Titre : valeur »).
const RUBRIQUES = {
  cepages: ['cepages', 'cepage', 'encepagement', 'assemblage'],
  terroir: ['sol terroir', 'terroir', 'sol', 'sols'],
  vinification: ['vinification', 'elevage', 'vinification et elevage', 'vinification elevage'],
  degustation: ['degustation', 'notes de degustation', 'commentaire de degustation', 'le vin', 'description', 'oeil', 'nez', 'bouche'],
  service: ['temperature de service', 'service', 'temperature'],
  accords: ['accords mets vins', 'accords mets et vins', 'accords mets', 'accord mets vins', 'accords', 'accord mets et vin'],
  garde: ['garde', 'potentiel de garde', 'apogee', 'a boire', 'conservation'],
  degre: ['degre', 'degre d alcool', 'alcool', 'teneur en alcool', 'titre alcoometrique'],
  millesime: ['millesime', 'annee'],
  appellation: ['appellation', 'aoc', 'aop'],
  couleur: ['couleur', 'type de vin', 'type'],
  contenance: ['contenance', 'volume', 'format']
};
const PAR_CLE = new Map(Object.entries(RUBRIQUES).flatMap(([r, l]) => l.map((k) => [k, r])));

// Texte → { rubrique: texte }.
export function rubriques(texte) {
  const res = {};
  let courante = null;
  for (const ligne of texte.split('\n')) {
    const n = normaliser(ligne);
    const enLigne = ligne.match(/^([^:：]{2,40})\s*[:：]\s*(.+)$/);
    if (enLigne && PAR_CLE.has(normaliser(enLigne[1]))) {
      const r = PAR_CLE.get(normaliser(enLigne[1]));
      res[r] = [res[r], enLigne[2].trim()].filter(Boolean).join(' ');
      courante = null;
    } else if (n.length <= 40 && PAR_CLE.has(n)) {
      courante = PAR_CLE.get(n);
      res[courante] ??= '';
    } else if (courante && res[courante].length < 900) {
      res[courante] = [res[courante], ligne.trim()].filter(Boolean).join(' ');
    }
  }
  return res;
}

const annees = (t) => [...String(t || '').matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)].map((m) => Number(m[1]));

// Page lue → lecture au format du scanner (mêmes écrans : créer la fiche, ou mettre à jour une fiche existante).
export function analyserPage({ titre, texte, image = null }, url, table = []) {
  const r = rubriques(texte);
  const lignes = [{ texte: titre || '', hauteur: 40 }, ...[r.appellation, r.couleur, r.degre, r.contenance, r.cepages].filter(Boolean).map((t) => ({ texte: t, hauteur: 12 }))];
  const a = analyserTexte(lignes, table);
  const cepages = trouverCepages(r.cepages || '').map((c) => c.nom);
  const millesime = annees(r.millesime)[0] ?? annees(titre)[0] ?? null;
  // Nom : le titre sans appellation, mentions d'étiquette, couleur, millésime ni nom du site.
  let nom = (titre || '').split(/\s[|–—-]\s/)[0];
  nom = nom.replace(/\b(19[5-9]\d|20[0-4]\d)\b/g, ' '); // millésimes du titre (parfois faux : « 2023 » pour un 2024)
  for (const motif of [a.appellation, 'AOP', 'AOC', 'IGP', 'rouge', 'blanc', 'rosé', 'rose'].filter(Boolean)) {
    nom = nom.replace(new RegExp(`(^|\\s)${motif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\s]+/g, '[-\\s]+')}(?=\\s|$)`, 'gi'), ' ');
  }
  nom = casse(nom.replace(/\s+/g, ' ').trim()) || a.nom;
  const temp = (r.service || '').match(/(\d{1,2})\s*°?\s*(?:c\b)?\s*(?:à|a|-|–)\s*(\d{1,2})/i);
  const garde = r.garde || '';
  const jusqua = garde.match(/jusqu.?(?:en|à)?\s*(20\d\d)/i)?.[1];
  const ans = garde.match(/(\d{1,2})\s*(?:à|a|-|–)\s*(\d{1,2})\s*ans/i);
  const notes = [['Dégustation', r.degustation], ['Accords', r.accords], ['Vinification', r.vinification], ['Terroir', r.terroir]]
    .filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`).join('\n');
  return {
    profil: profilProbable(texte, { appellation: a.appellation, cepages }) || 'vin',
    nom, producteur: null, appellation: a.appellation, millesime,
    style: a.style, degre: a.degre, volume_cl: a.volume_cl,
    cepages: cepages.join(', ') || null,
    apogee_debut: ans && millesime ? millesime + Number(ans[1]) : null,
    apogee_fin: jusqua ? Number(jusqua) : ans && millesime ? millesime + Number(ans[2]) : null,
    temperature: temp ? [Number(temp[1]), Number(temp[2])] : null,
    notes: notes || null, lien: url, image, texte: texte.slice(0, 6000), source: 'Page web'
  };
}
