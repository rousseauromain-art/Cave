// Sélecteur Vins | Spiritueux affiché en haut des écrans principaux.
import { h } from './dom.js';

const PICTOS = {
  vin: '<path d="M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0L8 3z"/><path d="M12 12.5V20"/><path d="M8.5 20h7"/>',
  spiritueux: '<path d="M6 7h12l-1.4 11.2A2 2 0 0 1 14.6 20H9.4a2 2 0 0 1-2-1.8L6 7z"/><path d="M6.6 12h10.8"/>'
};

export const PROFIL_LIBELLES = { vin: 'Vins', spiritueux: 'Spiritueux' };
export const pictoProfil = (p) => PICTOS[p];

export function selecteurProfil(courant, changer) {
  const svg = (trace) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '18'); s.setAttribute('height', '18'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('stroke-linecap', 'round');
    s.innerHTML = trace;
    return s;
  };
  return h('div', { class: 'selecteur-profil', role: 'radiogroup', 'aria-label': 'Collection' },
    Object.entries(PROFIL_LIBELLES).map(([id, t]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(id === courant), 'data-profil-choix': id,
      onclick: () => changer(id)
    }, svg(PICTOS[id]), t)));
}
