# S0-01 · Socle de l'application

**But.** Une PWA vide mais installable, avec le noyau modulaire, les deux thèmes et la navigation.

**À faire**
- `index.html`, `manifest.webmanifest` (nom « Cave », icône, `start_url` relatif), `sw.js` (cache hors ligne du shell).
- `core/` : `app.js`, `registry.js`, `router.js`, `flags.js`, `theme.js`, `version.js` (v0.1.0), `ui/` (barre de navigation 5 onglets
  des maquettes : Ce soir, Cave, Scanner, Dégustations, Rangements).
- `themes/tokens.css`, `vin.css`, `spiritueux.css` d'après `03-architecture.md`.
- Un module d'exemple `modules/aide/` (écran Aide avec les légendes de `docs/design/maquettes/Systeme.dc.html`).
- Écran Réglages : liste des modules avec interrupteur, bascule de profil, version.

**Terminé quand**
- L'app s'installe sur Android depuis GitHub Pages et s'ouvre hors ligne.
- Désactiver « Aide » retire son onglet ; le réactiver le rend.
- La bascule Vin ⇄ Spiritueux change toutes les couleurs sans rechargement.
- Tests Playwright : navigation, interrupteur de module, bascule de thème.
