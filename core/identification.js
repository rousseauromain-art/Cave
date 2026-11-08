// Identification d'une étiquette : IA (Gemini ou Claude) si une clé est saisie, sinon OCR.space, sinon lecture locale.
// Repris de Cave Revival v9.3 (fonctionnel), rendu générique pour les deux profils.
import { cles } from './cles.js';

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const COULEURS = { rouge: 'rouge', blanc: 'blanc', 'rosé': 'rose', rose: 'rose', effervescent: 'champagne', liquoreux: 'liquoreux', jaune: 'jaune' };

const CONSIGNE = {
  vin: 'Tu es sommelier. Identifie ce vin et réponds UNIQUEMENT par un objet JSON avec les clés : nom, domaine, appellation, region, pays (nom du pays en français), millesime, couleur (rouge|blanc|rosé|effervescent|liquoreux|jaune), cepages, garde_de (année à partir de laquelle le boire), garde_a (année limite), accords (texte court), description (2-3 phrases : style, température de service, carafage). Si une information est incertaine, donne ta meilleure estimation ; laisse vide ce que tu ignores.',
  spiritueux: 'Tu es caviste spécialiste des spiritueux. Identifie cette bouteille et réponds UNIQUEMENT par un objet JSON avec les clés : nom, distillerie, region, pays (nom en français ; « Bretagne » pour un whisky breton, « Écosse » pour un scotch), categorie (tourbe|malt|sherry|blend|bourbon|rhum|cognac|edv), age (nombre d’années), degre (nombre), fut, accords (texte court), description (2-3 phrases). Laisse vide ce que tu ignores.'
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
      commentaire: [r.description, r.accords && `Accords : ${r.accords}`].filter(Boolean).join('\n') || null, source
    };
  }
  return {
    profil, nom: r.nom || '', producteur: r.domaine || null, appellation: r.appellation || null, region: r.region || null,
    pays: codePays(r.pays), millesime: nombre(r.millesime), style: COULEURS[normaliser(r.couleur)] || null,
    cepages: Array.isArray(r.cepages) ? r.cepages.join(', ') : r.cepages || null,
    apogee_debut: nombre(r.garde_de), apogee_fin: nombre(r.garde_a),
    commentaire: [r.description, r.accords && `Accords : ${r.accords}`].filter(Boolean).join('\n') || null, source
  };
}

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
  const bruit = (t) => /mis en bouteille|appellation|contr[oô]l[eé]e|prot[eé]g[eé]e|\bcl\b|% ?vol|produit de|product of|contient|sulfites|^\d|c[oô]tes du|france/i.test(t);
  const lisibles = propres.filter((l) => l.t.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3);
  const di = lisibles.findIndex((l) => /\b(domaine|ch[aâ]teau|clos|mas|vignobles?|maison|cellier|distillerie)\b/i.test(l.t));
  let domaine = di >= 0 ? lisibles[di].t : '';
  if (domaine && /^(domaine|ch[aâ]teau)( d[eu]s?)?$/i.test(domaine) && lisibles[di + 1]) domaine += ' ' + lisibles[di + 1].t;
  const candidats = lisibles.filter((l, i) => i !== di && !bruit(l.t) && l.t.length >= 4).sort((a, b) => b.h - a.h);
  const degre = brut.match(/(\d{2}(?:[.,]\d)?)\s?% ?vol/i);
  return {
    nom: candidats[0]?.t || domaine || '', producteur: domaine || null,
    appellation: meilleure && score >= 6 ? meilleure.k.split('>').at(-1).trim() : null,
    millesime: annees[0] ?? null, style, degre: degre ? nombre(degre[1]) : null, texte: brut
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

// Enchaînement : IA choisie → OCR.space → lecture locale. Chaque échec est journalisé et on passe au suivant.
export async function identifier(photo, profil, { statut = () => {}, journal = () => {} } = {}) {
  const k = cles();
  const ia = (k.fournisseur === 'gemini' || k.fournisseur === 'auto') && k.geminiKey ? 'gemini'
    : (k.fournisseur === 'claude' || k.fournisseur === 'auto') && k.claudeKey ? 'claude' : null;
  if (ia) {
    try {
      statut(`Analyse par ${ia === 'gemini' ? 'Gemini' : 'Claude'}…`);
      const b64 = await enBase64(photo);
      const r = ia === 'gemini' ? await demanderGemini(b64, profil, k) : await demanderClaude(b64, profil, k);
      return versProduit(r, profil, ia === 'gemini' ? 'Gemini' : 'Claude');
    } catch (e) {
      journal(`IA ${ia} en échec : ${e.message}`);
      statut('IA indisponible, essai OCR.space…');
    }
  }
  let lignes = null, source = '';
  if (k.fournisseur !== 'local') {
    try {
      statut('Lecture OCR.space…');
      lignes = await ocrSpace(photo, k);
      source = 'OCR.space';
    } catch (e) {
      journal(`OCR.space en échec : ${e.message}`);
      statut('OCR.space indisponible, lecture locale…');
    }
  }
  if (!lignes) { lignes = await lectureLocale(photo, statut); source = 'Lecture locale'; }
  const a = analyserTexte(lignes, await appellations());
  return { profil, ...a, source };
}

// Rapprochement avec l'inventaire : meilleurs candidats (score > 0), du plus probable au moins probable.
export function rapprocher(trouve, produits, max = 3) {
  const mots = (s) => new Set(normaliser(s).split(' ').filter((m) => m.length >= 3));
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
