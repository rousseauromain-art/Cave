// Adaptateur Supabase pour core/sync.js. La bibliothèque n'est chargée qu'à la première utilisation,
// pour que l'app démarre hors ligne et sans réseau pour un utilisateur jamais connecté.
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JS, BUCKET_PHOTOS } from './config.js';

let client = null;

async function obtenirClient() {
  if (client) return client;
  const { createClient } = await import(SUPABASE_JS);
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
  });
  return client;
}

function verifier({ data, error }) {
  if (error) throw new Error(error.message || String(error));
  return data;
}

// Vrai si une session Supabase a déjà été enregistrée dans ce navigateur.
export function sessionMemorisee() {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
  } catch {
    return false;
  }
}

export const adaptateurSupabase = {
  async utilisateur() {
    const c = await obtenirClient();
    return verifier(await c.auth.getSession())?.session?.user ?? null;
  },
  async pousser(table, lignes) {
    const c = await obtenirClient();
    verifier(await c.from(table).upsert(lignes, { onConflict: 'id', defaultToNull: false }));
  },
  async tirer(table, depuis, max) {
    const c = await obtenirClient();
    return verifier(await c.from(table).select('*').gt('sync_at', depuis).order('sync_at').limit(max)) || [];
  },
  async envoyerPhoto(chemin, blob) {
    const c = await obtenirClient();
    verifier(await c.storage.from(BUCKET_PHOTOS).upload(chemin, blob, { upsert: true, contentType: blob.type || 'image/jpeg' }));
  },
  async telechargerPhoto(chemin) {
    const c = await obtenirClient();
    const { data, error } = await c.storage.from(BUCKET_PHOTOS).download(chemin);
    return error ? null : data;
  },
  async connecter(email) {
    const c = await obtenirClient();
    const retour = location.origin + location.pathname;
    verifier(await c.auth.signInWithOtp({ email, options: { emailRedirectTo: retour } }));
  },
  async deconnecter() {
    const c = await obtenirClient();
    verifier(await c.auth.signOut());
  },
  async surChangementSession(fn) {
    const c = await obtenirClient();
    c.auth.onAuthStateChange((evenement, session) => fn(evenement, session));
  }
};
