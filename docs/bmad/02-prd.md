# Exigences produit

Écrans de référence : `docs/design/maquettes/` (n° entre parenthèses).

## Inventaire (2 · Cave, 9 · Spiritueux)
- Matrice 3 colonnes de vignettes : photo d'étiquette, sinon étiquette générée (nom court + millésime/âge).
- Sur la vignette : nombre de bouteilles en haut à gauche, **pastille** couleur/style en haut à droite
  (bulles dessinées pour les effervescents), **drapeau rond** + **note ★** en bas à gauche.
- Sous la vignette : nom (2 lignes max), puis appellation · phase (vin) ou région · degré (spiritueux).
- Spiritueux : barre de niveau restant sous la vignette.
- Filtres en puces : Tout, par couleur/catégorie, « À mesurer », « Entamées ».
- Bascule de profil Vin ⇄ Spiritueux dans l'en-tête.

## Fiche (3)
- Photo plein cadre ; drapeau, note et ×N sur la photo ; pastille en haut à droite.
- Sections **dépliables** au style de la carte MyOeno : Stock & rangement, Profil MyOeno, Apogée,
  Aération Aveine, Historique, Accords. En-tête fermé = résumé (« 3 bouteilles », « Déclin », « 2 h »).
- Bouton « Scanner avec MyOeno » qui ouvre la mesure rattachée à ce vin.
- Icône localiser → casier avec halo sur la bouteille.

## Ajout et identification (4)
- Ajout manuel complet, stock 0 accepté.
- Photo d'étiquette → OCR (OCR.space, Tesseract hors ligne, Gemini/Claude optionnels) → fiche préremplie.
- Pour un verre : « verre offert » (mesure non rattachée) ou « vin de ma cave » (rattachée).

## Dégustation MyOeno (5)
- Connexion BLE, étapes Prêt → Dans le verre → Mesure → Résultat, batterie.
- Triangle puissance / tanins / vivacité (échelle 0–120), pointillé = moyenne du même type.
- Note 1–5 ; **mots-clés suggérés** d'après le profil, ajout par simple toucher, « + Autre ».
- Trame brute toujours conservée (`mesures.brut`) — utile au module expérimental MyOeno spiritueux.

## Service (6)
- Durée d'aération : H = min(Hmax, max(1, B_couleur × f_phase × (0,6 + T/100) × p)),
  B rouge 6 / blanc 2 / rosé 1 / liquoreux 1 / effervescent 0 ; f jeunesse 1,5 / apogée 1 / déclin 0,25 ;
  T = tanins MyOeno ; Hmax 24 h (Aveine), 12 h (Essentiel).

## Casier Montrouge (7)
- Plan 8 rangées × 6 emplacements en **ronds** (culs de bouteille), colorés par style, numéro de bouteille.
- Recherche → **halo jaune** sur la bouteille ; bouton « Faire clignoter la clayette » (expérimental,
  commande BLE inconnue à ce jour).
- Température / humidité si disponibles.

## Aide (Système visuel)
- Écran Aide qui illustre toutes les légendes : pastilles, drapeaux, note, halo, jauge, statuts d'apogée.

## Sauvegarde
- Synchro Supabase automatique après chaque modification et au lancement ; indicateur d'état.
- Restauration complète sur un nouvel appareil après connexion par lien magique.
- Export / import JSON manuel en secours.
