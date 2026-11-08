# Cave — règles du projet pour Claude Code

Application web unique (PWA, GitHub Pages) pour gérer une cave à vin et une collection de spiritueux,
et faire revivre deux objets Bluetooth orphelins : la sonde **MyOeno** et le casier **Montrouge**
(ex-Caveasy). L'aérateur **Aveine** est piloté en réglage manuel (v1).

Langue : interface, code commenté, commits et docs en **français**.

## À lire avant toute story
1. `docs/bmad/01-brief.md` — pourquoi, pour qui
2. `docs/bmad/02-prd.md` — exigences fonctionnelles
3. `docs/bmad/03-architecture.md` — modules, données, synchro, thèmes
4. La story demandée dans `docs/bmad/stories/`
5. Les maquettes de référence `docs/design/maquettes/*.dc.html` (styles en ligne = valeurs exactes)

## Règles techniques
- **Aucun build** : HTML + modules ES natifs + CSS. Pas de framework. Une dépendance externe
  (CDN épinglé à une version exacte) seulement si justifiée dans la PR. Seule prévue : `@supabase/supabase-js`.
- **Local d'abord** : IndexedDB est la source de vérité, l'app marche hors ligne. Supabase = sauvegarde + synchro.
- **Modules** : chaque module est un dossier `modules/<nom>/` avec un `module.js` qui exporte
  `{ id, titre, flag, profils, ecrans, tables, init(core) }`. Le noyau (`core/`) n'importe **aucun** module :
  il les charge depuis `core/registry.js`. Un module désactivé disparaît des menus sans perdre ses données.
- **Code générique** : fonctions réutilisables ; une correction s'applique à tous les cas similaires,
  jamais de copie par cas particulier.
- **Thèmes** : uniquement des variables CSS (`themes/tokens.css`, `themes/vin.css`, `themes/spiritueux.css`).
  Aucune couleur en dur dans un module.
- **Accessibilité** : contraste ≥ 4,5:1 pour le texte, cibles tactiles ≥ 40 px, `aria-label` sur les icônes.
- **Web Bluetooth** : Chrome Android + HTTPS uniquement ; toujours un repli lisible si indisponible.
- **Version** visible dans l'app (`core/version.js`), incrémentée à chaque PR.

## Sécurité et données
- Jamais de données personnelles dans le dépôt (public) : inventaires, exports, photos → `.gitignore`.
- Clés OCR.space / Gemini / Claude : saisies dans l'app, stockées en local, jamais exportées ni commitées.
- Supabase : seules l'URL du projet et la clé **publique** (anon/publishable) vont dans `core/config.js`.
  La clé `service_role` ne doit jamais apparaître. Toute nouvelle table : RLS + politique propriétaire + grant
  `authenticated`, via une nouvelle migration `supabase/migrations/AAAAMMJJHHMMSS_nom.sql`.

## Flux de travail
- Une story = une branche `sNN-court-nom` = une PR vers `main`.
- La PR liste : ce qui change, comment tester sur téléphone, captures si UI, version.
- Tests Playwright dans `tests/` pour chaque écran ou logique ajoutés (`npx playwright test`).
- Ne pas modifier `legacy/` : ce sont des références (MyOeno v9.3, collection whisky).

## Références à porter
- `legacy/cave-revival-v9.3.html` : protocole MyOeno fonctionnel (service `f92158cd-…`,
  caractéristique `e5042891-…`, abonnement sans lecture initiale, 4 tentatives, repli en lecture périodique,
  calcul `computeData`), protocole Caveasy/Montrouge en lecture (trames 0xFF/0xFE, type 0x45).
- `legacy/collection-privee-whisky.html` : collection whisky (tableau `SITES` : distillerie, région,
  coordonnées, type, nombre, `bzh`), carte des origines, recherche avec halo → à migrer (story S5).
- `data/apogee.json` : fenêtres d'apogée par appellation et couleur (années après millésime).
