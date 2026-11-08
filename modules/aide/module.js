// Aide : illustre toutes les légendes de l'app (ex-« Système visuel » des maquettes).
import { ICONES } from '../../core/ui/icones.js';
import { drapeau, pastille, note, jauge, emplacement } from '../../core/ui/badges.js';
import { STYLES } from '../../data/styles.js';

function legende(h, visuel, titre, ...lignes) {
  return h('li', { class: 'legende' },
    h('span', { class: 'legende-visuel' }, visuel),
    h('span', { class: 'legende-texte' }, h('strong', {}, titre), ...lignes.map((l) => h('span', {}, l))));
}

function rendu(core, el) {
  const { h } = core;
  const profil = core.profilCourant();
  const styles = STYLES[profil];
  const exemple = Object.values(styles)[0];
  core.ajouter(el, [
    h('section', { class: 'carte' },
      h('h2', {}, profil === 'vin' ? 'Pastilles · couleur du vin' : 'Pastilles · catégorie'),
      h('ul', { class: 'grille-legendes' },
        Object.values(styles).map((s) => h('li', {}, pastille(s), h('span', {}, s.titre))))),
    h('section', { class: 'carte' },
      h('h2', {}, 'Sur une étiquette'),
      h('ul', { class: 'legendes' },
        legende(h, h('span', { class: 'compteur' }, '3'), 'Nombre de bouteilles', 'en haut à gauche'),
        legende(h, [drapeau(profil === 'vin' ? 'FR' : 'BZH'), note(4.5)], 'Origine et note', 'drapeau rond = pays ou région', 'étoile = votre note, absente si non noté'),
        profil === 'spiritueux' ? legende(h, jauge(60), 'Niveau', 'ce qui reste dans la bouteille entamée') : null)),
    h('section', { class: 'carte' },
      h('h2', {}, 'Rangement'),
      h('ul', { class: 'legendes' },
        legende(h, emplacement(7, exemple, { trouve: true }), 'Halo jaune', 'bouteille trouvée dans le casier', 'le numéro est l’identifiant de la bouteille'),
        legende(h, h('span', { class: 'emplacement libre', 'aria-label': 'Emplacement libre', role: 'img' }), 'Emplacement libre', 'cercle en pointillés'))),
    profil === 'vin' ? h('section', { class: 'carte' },
      h('h2', {}, 'Apogée'),
      h('ul', { class: 'statuts' },
        h('li', { class: 'statut jeunesse' }, 'Jeunesse'),
        h('li', { class: 'statut apogee' }, 'Apogée'),
        h('li', { class: 'statut declin' }, 'Déclin'))) : null
  ]);
}

export default {
  id: 'aide',
  titre: 'Aide',
  flag: { defaut: true, experimental: false },
  ecrans: [{ route: '/aide', titre: 'Aide', icone: ICONES.aide, place: 'entete', ordre: 90, rendu }],
  tables: []
};
