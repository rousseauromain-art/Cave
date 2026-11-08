# Architecture

## Arborescence
```
index.html  manifest.webmanifest  sw.js
core/      app.js  registry.js  router.js  store.js  sync.js  flags.js  theme.js  config.js  version.js  ui/
modules/   placard/ casier/ montrouge/ myoeno/ myoeno-spiritueux/ degustation/ apogee/ aeration/
           identification/ spiritueux/ aide/ diagnostic/
themes/    tokens.css  vin.css  spiritueux.css
data/      apogee.json  mots-cles.json  drapeaux.js
supabase/  migrations/
tests/     *.spec.js (Playwright)
legacy/    références, ne pas modifier
```

## Noyau
| Fichier | Rôle |
|---|---|
| `registry.js` | Liste des modules et leur ordre ; seul endroit qui importe `modules/*/module.js` |
| `flags.js` | État activé/désactivé par module, persistant (`kv.js` : localStorage en S0-01, table IndexedDB `reglages` en S0-02) |
| `store.js` | Accès IndexedDB générique : `get/put/list/remove(table, …)`, horodatage `modifie_le`, suppression logique |
| `sync.js` | Pousse les lignes modifiées depuis le dernier envoi, tire celles dont `sync_at` > curseur ; dernier écrit gagne sur `modifie_le` ; photos dans le bucket `etiquettes/<user_id>/<produit_id>.jpg` |
| `router.js` | Navigation par hash (`#/cave`, `#/fiche/<id>`…) |
| `theme.js` | Applique `data-profil="vin|spiritueux"` sur `<html>` |
| `ui/` | `dom.js` (création d'éléments sûre), `icones.js`, `badges.js` (drapeau, pastille, note, jauge, emplacement avec halo), `a-venir.js` |
| `config.js` | URL Supabase + clé publique ; rien de secret |

Contrat d'un module :
```js
export default {
  id: 'myoeno', titre: 'MyOeno', flag: { defaut: true, experimental: false },
  profils: ['vin'],                 // profils où il est disponible
  ecrans: [{ route: '/mesure', titre: 'Dégustation', icone: ICONES.etoile,
             place: 'nav',          // 'nav' | 'centre' (bouton rond) | 'entete' (icône en haut)
             ordre: 40,             // position dans la barre
             rendu: (core, el) => {} }],
  tables: ['mesures'],              // tables qu'il lit/écrit
  init(core) {}                     // abonnements, actions sur les fiches
};
```

## Données (identiques en IndexedDB et Supabase)
| Table | Contenu clé |
|---|---|
| `produits` | un vin ou un spiritueux : profil, nom, producteur, cuvée, millésime, style, pays, région, appellation, degré, âge, fût, note, apogée, photo |
| `bouteilles` | exemplaires : produit, rangement, emplacement `R3-E2`, numéro, état, niveau %, dates |
| `rangements` | placard, étagère, casier, montrouge (lignes × colonnes, identifiant BLE) |
| `mesures` | MyOeno : trame brute + 5 indicateurs, produit facultatif |
| `degustations` | note, mots-clés, commentaire, aération, mesure liée |

Colonnes communes : `id uuid` (généré par l'app), `user_id`, `modifie_le`, `supprime`, `sync_at`.
Schéma : `supabase/migrations/20261108000000_init.sql`.

## Thèmes
| Jeton | Vin | Spiritueux |
|---|---|---|
| `--c-entete` | #4A0B22 | #2B1A10 |
| `--c-accent` | #6D1030 | #8A4F12 |
| `--c-fond` | #F6F0F1 | #F7F1E8 |
| `--c-texte` | #1C1013 | #1E1610 |
| `--c-texte-2` | #5E4F55 | #5C5045 |
| `--c-bord` | #EADFE2 | #E8DCCB |
| `--c-halo` | #F5C518 | #F5C518 |
Statuts : apogée #2F6F4E, jeunesse #2D5B8C, déclin #B3541E / texte #8A3B12 sur #F8E9DF.
Polices : Fraunces (titres), Inter (texte).

Pastilles vin : rouge #7A1530, blanc #E7CF7A, jaune #C8961E, liquoreux #D49A2A, champagne #E7CF7A (+ bulles),
rosé effervescent #EFA3B4, prosecco #C9DD8E, muté #4E0E22.
Pastilles spiritueux : tourbé #3A2A1E, single malt #C98A2B, sherry #7A2E14, blend #D9A441, bourbon #A4501F,
rhum #5E3218, cognac #B5651D, eau-de-vie #EDE6D3.
