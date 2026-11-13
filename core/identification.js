// Identification d'une étiquette : IA (Gemini ou Claude) si une clé est saisie, sinon OCR.space, sinon lecture locale.
// Repris de Cave Revival v9.3 (fonctionnel), rendu générique pour les deux profils.
import { cles } from './cles.js';

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const COULEURS = { rouge: 'rouge', blanc: 'blanc', 'rosé': 'rose', rose: 'rose', effervescent: 'champagne', liquoreux: 'liquoreux', jaune: 'jaune' };

const CONSIGNE = {
  vin: 'Tu es sommelier. Identifie ce vin et réponds UNIQUEMENT par un objet JSON avec les clés : nom, domaine, appellation, region, pays (nom du pays en français), millesime, couleur (rouge|blanc|rosé|effervescent|liquoreux|jaune), cepages, garde_de (année à partir de laquelle le boire), garde_a (année limite), accords (texte court), description (2-3 phrases : style, température de service, carafage). texte (tout le texte lisible sur l’étiquette, ligne par ligne). Si une information est incertaine, donne ta meilleure estimation ; laisse vide ce que tu ignores.',
  spiritueux: 'Tu es caviste spécialiste des spiritueux. Identifie cette bouteille et réponds UNIQUEMENT par un objet JSON avec les clés : nom, distillerie, region, pays (nom en français ; « Bretagne » pour un whisky breton, « Écosse » pour un scotch), categorie (tourbe|malt|sherry|blend|bourbon|rhum|cognac|edv), age (nombre d’années), degre (nombre), fut, accords (texte court), description (2-3 phrases), texte (tout le texte lisible sur l’étiquette, ligne par ligne). Laisse vide ce que tu ignores.'
};

const PAYS = { france: 'FR', italie: 'IT', espagne: 'ES', allemagne: 'DE', portugal: 'PT', chili: 'CL', ecosse: 'SC', bretagne: 'BZH', japon: 'JP', 'etats unis': 'US', venezuela: 'VE', irlande: 'IE' };
const codePays = (nom) => PAYS[normaliser(nom)] || null;
const nombre = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Réponse IA → champs de produit.
export function versProduit(r, profil, source) {
  if (profil === 'spiritueux') {
    return {
      profil, nom: r.nom || '', producteur: r.distillerie || r.domaine || null, region: r.region || null, pays: codePays(r.pays),
      style: ['tourbe', 'malt', 'sherry', 'blend', 'bourbon', 'rhum', 'cognac', 'edv'].includes(r.categorie) ? r.categorie : null,
      age_ans: nombre(r.age), degre: nombre(r.degre), fut: r.fut || null,
      commentaire: [r.description, r.accords && `Accords : ${r.accords}`].filter(Boolean).join('\n') || null, texte: texteIA(r), source
    };
  }
  return {
    profil, nom: r.nom || '', producteur: r.domaine || null, appellation: r.appellation || null, region: r.region || null,
    pays: codePays(r.pays), millesime: nombre(r.millesime), style: COULEURS[normaliser(r.couleur)] || null,
    cepages: Array.isArray(r.cepages) ? r.cepages.join(', ') : r.cepages || null,
    apogee_debut: nombre(r.garde_de), apogee_fin: nombre(r.garde_a),
    commentaire: [r.description, r.accords && `Accords : ${r.accords}`].filter(Boolean).join('\n') || null, texte: texteIA(r), source
  };
}

const texteIA = (r) => (Array.isArray(r.texte) ? r.texte.join('\n') : r.texte || '');

function lireJson(texte) {
  const m = String(texte).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('réponse illisible');
  return JSON.parse(m[0]);
}

async function demanderGemini(b64, profil, k) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(k.geminiModel)}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': k.geminiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: CONSIGNE[profil] }] }], generationConfig: { responseMimeType: 'application/json' } })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Gemini ${r.status}`);
  return lireJson((j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(''));
}

async function demanderClaude(b64, profil, k) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': k.claudeKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' },
    body: JSON.stringify({ model: k.claudeModel, max_tokens: 800, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: CONSIGNE[profil] }] }] })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Claude ${r.status}`);
  return lireJson((j.content || []).map((c) => c.text || '').join(''));
}

// --- Lecture de texte (OCR) puis analyse heuristique ---
let indexAppellations = null;
async function appellations() {
  if (indexAppellations) return indexAppellations;
  try {
    const table = await (await fetch('data/apogee.json')).json(); // relatif au site (index.html à la racine)
    indexAppellations = Object.keys(table).map((k) => ({ k, dernier: normaliser(k.split('>').at(-1)) }));
  } catch {
    indexAppellations = [];
  }
  return indexAppellations;
}

// Cépages reconnus sur une étiquette (forme affichée) et couleur qu'ils suggèrent.
const CEPAGES = {
  rouge: ['Cabernet Sauvignon', 'Cabernet Franc', 'Merlot', 'Malbec', 'Petit Verdot', 'Carménère', 'Pinot Noir', 'Gamay', 'Syrah', 'Shiraz', 'Grenache', 'Mourvèdre',
    'Carignan', 'Cinsault', 'Tannat', 'Négrette', 'Fer Servadou', 'Pinot Meunier', 'Nebbiolo', 'Sangiovese', 'Barbera', 'Dolcetto', 'Tempranillo', 'Zinfandel', 'Primitivo',
    'Cot', 'Côt', 'Poulsard', 'Trousseau', 'Mondeuse', 'Pinotage', 'Marselan', 'Corvina', 'Montepulciano', 'Aglianico', 'Touriga Nacional'],
  blanc: ['Chardonnay', 'Sauvignon Blanc', 'Sauvignon', 'Sémillon', 'Muscadelle', 'Chenin', 'Chenin Blanc', 'Riesling', 'Gewurztraminer', 'Pinot Gris', 'Pinot Blanc', 'Muscat',
    'Viognier', 'Marsanne', 'Roussanne', 'Grenache Blanc', 'Vermentino', 'Rolle', 'Picpoul', 'Melon de Bourgogne', 'Aligoté', 'Savagnin', 'Jacquère', 'Altesse',
    'Gros Manseng', 'Petit Manseng', 'Colombard', 'Ugni Blanc', 'Clairette', 'Bourboulenc', 'Albariño', 'Grüner Veltliner', 'Glera', 'Mauzac', 'Macabeu', 'Macabeo']
};
const INDEX_CEPAGES = Object.entries(CEPAGES).flatMap(([couleur, l]) => l.map((nom) => ({ nom, couleur, cle: normaliser(nom) })))
  .sort((a, b) => b.cle.length - a.cle.length); // le plus long d'abord (« grenache blanc » avant « grenache »)

// Cépages cités dans un texte, dans l'ordre d'apparition, sans doublon.
export function trouverCepages(texte) {
  let reste = ` ${normaliser(texte)} `;
  const vus = [];
  for (const c of INDEX_CEPAGES) {
    const i = reste.indexOf(` ${c.cle} `);
    if (i < 0) continue;
    vus.push({ ...c, i });
    reste = reste.slice(0, i) + ' '.repeat(c.cle.length + 2) + reste.slice(i + c.cle.length + 2);
  }
  const noms = new Set();
  return vus.sort((a, b) => a.i - b.i).filter((c) => !noms.has(c.cle) && noms.add(c.cle)).map(({ nom, couleur }) => ({ nom, couleur }));
}

// Vin ou spiritueux d'après le texte lu (null si rien de net).
export function profilProbable(texte, { appellation = null, cepages = [] } = {}) {
  const t = normaliser(texte);
  const spiritueux = /\b(whiske?y|single malt|malt whisky|scotch|bourbon|rhum|rum|cognac|armagnac|calvados|gin|vodka|distill?er|distillerie|distillery|eau de vie|liqueur|grappa|mezcal|tequila)\b/.test(t);
  const vin = !!appellation || cepages.length > 0 || /\b(appellation|aop|aoc|igp|vin de france|vin rouge|vin blanc|mis en bouteille au (domaine|chateau)|grand cru|premier cru|cuvee)\b/.test(t);
  return vin && !spiritueux ? 'vin' : spiritueux && !vin ? 'spiritueux' : null;
}

// Lignes OCR [{texte, hauteur}] → champs. Exportée pour les tests.
export function analyserTexte(lignes, index = [], annee = new Date().getFullYear()) {
  const propres = lignes.map((l) => ({ t: l.texte.replace(/\s+/g, ' ').trim(), h: l.hauteur ?? 20 })).filter((l) => l.t);
  const brut = propres.map((l) => l.t).join(' ');
  const annees = (brut.match(/\b(19[5-9]\d|20[0-4]\d)\b/g) || []).map(Number).filter((v) => v <= annee);
  const jetons = normaliser(brut).split(' ').filter(Boolean);
  let meilleure = null, score = 0;
  for (const o of index) {
    const at = o.dernier.split(' ');
    if (o.dernier.length < 4) continue;
    for (let i = 0; i < jetons.length; i++) {
      let m = 0, car = 0;
      for (let j = 0; j < at.length && i + j < jetons.length; j++) {
        const a = at[j], t = jetons[i + j];
        if (t === a) { m++; car += a.length; } else if (j > 0 && t.length >= 2 && a.startsWith(t)) { m++; car += t.length; break; } else break;
      }
      const sc = car + (m === at.length ? 3 : 0);
      if (m >= Math.min(2, at.length) && sc > score) { score = sc; meilleure = o; }
    }
  }
  const style = /\bros[eé]\b/i.test(brut) ? 'rose' : /\b(brut|cr[eé]mant|champagne|p[eé]tillant|mousseux|cava|prosecco)\b/i.test(brut) ? 'champagne'
    : /\b(moelleux|liquoreux|sauternes|doux)\b/i.test(brut) ? 'liquoreux' : /\bblanc\b/i.test(brut) ? 'blanc' : /\brouge\b/i.test(brut) ? 'rouge' : null;
  const cepages = trouverCepages(brut);
  const queCepages = (t) => trouverCepages(t).length > 0 && normaliser(t).split(' ').filter((m) => m && !['et', 'de'].includes(m)).length <= trouverCepages(t).reduce((n, c) => n + c.nom.split(' ').length, 0);
  const bruit = (t) => /mis en bouteille|appellation|contr[oô]l[eé]e|prot[eé]g[eé]e|\bcl\b|% ?vol|produit de|product of|contient|sulfites|^\d|c[oô]tes du|france/i.test(t) || queCepages(t);
  const lisibles = propres.filter((l) => l.t.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3);
  const di = lisibles.findIndex((l) => /\b(domaine|ch[aâ]teau|clos|mas|vignobles?|maison|famille|cellier|caves?|vignerons|distillerie)\b/i.test(l.t));
  let domaine = di >= 0 ? lisibles[di].t : '';
  let fin = di;
  // « Famille de » / « Domaine du » sur une ligne, le nom sur la suivante.
  if (domaine && /^(domaine|ch[aâ]teau|famille|maison|clos)( d[eu]s?| de la| d')?\.?$/i.test(domaine) && lisibles[di + 1]) { domaine += ' ' + lisibles[di + 1].t; fin = di + 1; }
  domaine = domaine.replace(/\s+\b(1[5-9]\d\d)\b$/, '').trim(); // année de fondation (« 1620 »)
  const appellation = meilleure && score >= 6 ? meilleure.k.split('>').at(-1).trim() : null;
  const estAppellation = (t) => appellation && normaliser(t) === normaliser(appellation);
  const candidats = lisibles.filter((l, i) => (i < di || i > fin) && !bruit(l.t) && !estAppellation(l.t) && l.t.length >= 4).sort((a, b) => b.h - a.h);
  const degre = brut.match(/(\d{2}(?:[.,]\d)?)\s?% ?vol/i);
  const cl = brut.match(/\b(\d{2,3})\s?cl\b/i), ml = brut.match(/\b(\d{3,4})\s?ml\b/i);
  // Couleur : écrite sur l'étiquette, sinon celle de tous les cépages lus s'ils concordent.
  const couleurs = [...new Set(cepages.map((c) => c.couleur))];
  return {
    nom: candidats[0]?.t || domaine || '', producteur: domaine || null, appellation,
    millesime: annees[0] ?? null, style: style || (couleurs.length === 1 ? couleurs[0] : null), styleDeduit: !style && couleurs.length === 1,
    degre: degre ? nombre(degre[1]) : null, cepages: cepages.map((c) => c.nom).join(', ') || null,
    volume_cl: cl ? Number(cl[1]) : ml ? Number(ml[1]) / 10 : null,
    texte: propres.map((l) => l.t).join('\n')
  };
}

async function ocrSpace(fichier, k) {
  const fd = new FormData();
  fd.append('apikey', k.ocrKey || 'helloworld');
  fd.append('file', fichier, 'etiquette.jpg');
  fd.append('OCREngine', '2');
  fd.append('scale', 'true');
  fd.append('detectOrientation', 'true');
  fd.append('isOverlayRequired', 'true');
  const r = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.IsErroredOnProcessing || !j.ParsedResults) throw new Error(`OCR.space ${r.status} ${[].concat(j.ErrorMessage || '').join(' ').slice(0, 160)}`);
  const lignes = [];
  for (const p of j.ParsedResults) {
    for (const L of p.TextOverlay?.Lines || []) {
      const mots = L.Words || [];
      if (mots.length) lignes.push({ texte: mots.map((w) => w.WordText).join(' '), hauteur: Math.max(...mots.map((w) => w.Height)) });
    }
  }
  if (!lignes.length) for (const p of j.ParsedResults) for (const t of (p.ParsedText || '').split(/\r?\n/)) if (t.trim()) lignes.push({ texte: t, hauteur: 20 });
  return lignes;
}

let tesseract = null;
function chargerTesseract() {
  return tesseract || (tesseract = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => ok(window.Tesseract);
    s.onerror = () => { tesseract = null; ko(new Error('lecteur local indisponible (réseau ?)')); };
    document.head.append(s);
  }));
}

async function lectureLocale(fichier, statut) {
  statut('Lecture locale… (premier usage : téléchargement d’environ 10 Mo)');
  const T = await chargerTesseract();
  const r = await T.recognize(fichier, 'fra', { logger: (m) => m.status === 'recognizing text' && statut(`Lecture… ${Math.round(m.progress * 100)} %`) });
  return (r.data.lines || []).filter((l) => l.confidence > 35).map((l) => ({ texte: l.text, hauteur: l.bbox.y1 - l.bbox.y0 }));
}

const enBase64 = (blob) => new Promise((ok, ko) => {
  const f = new FileReader();
  f.onload = () => ok(String(f.result).split(',')[1]);
  f.onerror = () => ko(f.error);
  f.readAsDataURL(blob);
});

// Texte seul (verso, contre-étiquette) : OCR.space puis lecture locale. Renvoie les lignes [{texte, hauteur}].
export async function lireTexte(photo, { statut = () => {}, journal = () => {} } = {}) {
  const k = cles();
  if (k.fournisseur !== 'local') {
    try {
      statut('Lecture OCR.space…');
      return { lignes: await ocrSpace(photo, k), source: 'OCR.space' };
    } catch (e) {
      journal(`OCR.space en échec : ${e.message}`);
      statut('OCR.space indisponible, lecture locale…');
    }
  }
  return { lignes: await lectureLocale(photo, statut), source: 'Lecture locale' };
}

// Enchaînement : IA choisie → OCR.space → lecture locale. Chaque échec est journalisé et on passe au suivant.
// Le profil renvoyé est celui que l'étiquette indique (vin ou spiritueux), sinon celui demandé.
export async function identifier(photo, profil, { statut = () => {}, journal = () => {} } = {}) {
  const k = cles();
  const ia = (k.fournisseur === 'gemini' || k.fournisseur === 'auto') && k.geminiKey ? 'gemini'
    : (k.fournisseur === 'claude' || k.fournisseur === 'auto') && k.claudeKey ? 'claude' : null;
  if (ia) {
    try {
      statut(`Analyse par ${ia === 'gemini' ? 'Gemini' : 'Claude'}…`);
      const b64 = await enBase64(photo);
      const r = ia === 'gemini' ? await demanderGemini(b64, profil, k) : await demanderClaude(b64, profil, k);
      const detecte = profilProbable([texteIA(r), r.nom, r.categorie, r.distillerie].join(' '), { appellation: r.appellation, cepages: trouverCepages(texteIA(r) + ' ' + [].concat(r.cepages || []).join(' ')) });
      return versProduit(r, detecte || profil, ia === 'gemini' ? 'Gemini' : 'Claude');
    } catch (e) {
      journal(`IA ${ia} en échec : ${e.message}`);
      statut('IA indisponible, essai OCR.space…');
    }
  }
  const { lignes, source } = await lireTexte(photo, { statut, journal });
  const a = analyserTexte(lignes, await appellations());
  const detecte = profilProbable(a.texte, { appellation: a.appellation, cepages: a.cepages ? a.cepages.split(', ') : [] });
  return { profil: detecte || profil, ...a, source };
}

// Complète une lecture avec le verso : champs manquants seulement, texte ajouté à part.
export async function completerAvecVerso(trouve, lignes) {
  const v = analyserTexte(lignes, await appellations());
  const sortie = { ...trouve, texte_verso: v.texte };
  for (const k of ['producteur', 'appellation', 'millesime', 'degre', 'volume_cl']) if (!sortie[k] && v[k]) sortie[k] = v[k];
  if (v.cepages) {
    const tous = [...new Set([...(trouve.cepages ? trouve.cepages.split(', ') : []), ...v.cepages.split(', ')])];
    sortie.cepages = tous.join(', ');
  }
  if (!sortie.style && v.style) { sortie.style = v.style; sortie.styleDeduit = v.styleDeduit; }
  return sortie;
}

// Mots trop courants sur les étiquettes pour rapprocher deux produits.
const MOTS_VIDES = new Set(['famille', 'reserve', 'selection', 'domaine', 'chateau', 'maison', 'cuvee', 'grand', 'grande', 'vin', 'vins', 'appellation', 'origine',
  'protegee', 'controlee', 'france', 'les', 'des', 'and', 'the', 'vieilles', 'vignes', 'rouge', 'blanc', 'single', 'malt', 'whisky', 'whiskey', 'rhum', 'old', 'ans', 'years',
  'blend', 'edition', 'special', 'speciale', 'mis', 'bouteille', 'produit', 'tradition', 'prestige', 'brut', 'cru', 'premier', 'vie', 'eau']);

// Rapprochement avec l'inventaire : meilleurs candidats (score > 0), du plus probable au moins probable.
export function rapprocher(trouve, produits, max = 3) {
  const mots = (s) => new Set(normaliser(s).split(' ').filter((m) => m.length >= 3 && !MOTS_VIDES.has(m)));
  const cible = mots([trouve.nom, trouve.producteur, trouve.appellation, trouve.texte].join(' '));
  return produits
    .map((p) => {
      const m = mots([p.nom, p.producteur, p.appellation, p.cuvee].join(' '));
      let s = 0;
      for (const x of m) if (cible.has(x)) s += x.length;
      if (s && trouve.millesime && p.millesime === trouve.millesime) s += 4;
      return { p, s };
    })
    .filter((x) => x.s >= 4)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.p);
}

// Brouillon transmis au formulaire « Nouveau » après une identification.
let brouillon = null;
export function deposerBrouillon(b) { brouillon = b; }
export function prendreBrouillon() { const b = brouillon; brouillon = null; return b; }
