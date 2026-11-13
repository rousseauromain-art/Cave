// Message éphémère en bas d'écran, avec action « Annuler » facultative (6 s).
import { h } from './dom.js';

let courant = null;

export function toast(texte, { annuler = null, duree = 6000 } = {}) {
  courant?.remove();
  const el = h('div', { class: 'toast', role: 'status' },
    h('span', {}, texte),
    annuler ? h('button', { type: 'button', class: 'toast-action', onclick: async () => { el.remove(); await annuler(); } }, 'Annuler') : null);
  document.body.append(el);
  courant = el;
  setTimeout(() => { if (courant === el) { el.remove(); courant = null; } }, duree);
  return el;
}
