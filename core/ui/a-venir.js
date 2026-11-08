// Écran générique « à venir » pour les onglets dont le module n'est pas encore livré.
import { h } from './dom.js';

export function ecranAVenir(titre, story, texte) {
  return (core, el) => {
    el.append(
      h('section', { class: 'carte a-venir' },
        h('h2', {}, titre),
        h('p', {}, texte),
        h('p', { class: 'discret' }, `Livré par la story ${story}.`))
    );
  };
}
