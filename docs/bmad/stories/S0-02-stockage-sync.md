# S0-02 · Stockage local et synchronisation Supabase

**But.** Ne jamais perdre la cave si le téléphone casse.

**À faire**
- `core/store.js` : IndexedDB, tables `produits`, `bouteilles`, `rangements`, `mesures`, `degustations`, `reglages`, `file_sync` ;
  API générique `get/put/list/remove` ; `put` met à jour `modifie_le`, `remove` met `supprime = true`.
- `core/sync.js` avec `@supabase/supabase-js` (CDN épinglé) :
  - connexion par lien magique (e-mail), session persistante ;
  - envoi des lignes modifiées depuis le dernier envoi (upsert), réception des lignes dont `sync_at` > curseur ;
  - conflit : la plus récente `modifie_le` gagne ;
  - photos : upload dans `etiquettes/<user_id>/<produit_id>.jpg` (compressées ≤ 300 Ko), téléchargement à la restauration ;
  - déclenchement : au lancement, après chaque écriture (anti-rebond 5 s), au retour en ligne.
- Indicateur dans l'en-tête : synchronisé / en attente / hors ligne / erreur (détail dans Diagnostic).
- Export et import JSON complets (secours manuel).
- `core/config.js` lit `SUPABASE_URL` et `SUPABASE_ANON_KEY`.

**Terminé quand**
- Ajout d'un produit sur le téléphone A → visible sur le navigateur B après connexion.
- Navigateur vidé → reconnexion → tout revient, photos comprises.
- Hors ligne : ajout possible, envoyé au retour du réseau.
- Tests : logique de fusion (dernier écrit gagne, suppression logique) en test unitaire sans réseau.
