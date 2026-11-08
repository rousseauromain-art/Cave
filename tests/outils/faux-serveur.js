// Faux serveur Supabase en mémoire (tests uniquement) : reproduit upsert, curseur sync_at et stockage de photos.
export function creerFauxServeur() {
  const tables = {};
  const photos = new Map();
  let horloge = Date.parse('2026-01-01T00:00:00Z');
  const etat = { horsLigne: false, utilisateur: { id: 'u-1', email: 'romain@example.fr' }, appels: 0 };

  const reseau = () => { etat.appels++; if (etat.horsLigne) throw new TypeError('Failed to fetch'); };
  // Format Postgres (+00:00, microsecondes) pour éprouver la comparaison des horodatages.
  const maintenant = () => new Date(++horloge).toISOString().replace('Z', '123+00:00');

  const adaptateur = {
    async utilisateur() { reseau(); return etat.utilisateur; },
    async pousser(table, lignes) {
      reseau();
      tables[table] ??= new Map();
      for (const l of lignes) {
        if (!l.user_id) throw new Error('user_id manquant');
        tables[table].set(l.id, { ...tables[table].get(l.id), ...l, sync_at: maintenant() });
      }
    },
    async tirer(table, depuis, max) {
      reseau();
      return [...(tables[table]?.values() || [])]
        .filter((l) => l.sync_at > depuis)
        .sort((a, b) => (a.sync_at < b.sync_at ? -1 : 1))
        .slice(0, max)
        .map((l) => structuredClone(l));
    },
    async envoyerPhoto(chemin, blob) { reseau(); photos.set(chemin, blob); },
    async telechargerPhoto(chemin) { reseau(); return photos.get(chemin) || null; }
  };
  return { adaptateur, tables, photos, etat };
}
