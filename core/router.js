// Navigation par hash : #/cave, #/fiche/<id>… Les écrans sont fournis par les modules et le noyau.
import { emettre } from './evenements.js';

export function routeCourante() {
  return location.hash.replace(/^#/, '') || '';
}

export function aller(route) {
  if (routeCourante() === route) emettre('route', route);
  else location.hash = route;
}

// Compare un motif (« /fiche/:id ») à un chemin ; renvoie les paramètres ou null.
export function correspondance(motif, chemin) {
  const [base] = chemin.split('?');
  const m = motif.split('/'), c = base.split('/');
  if (m.length !== c.length) return null;
  const params = {};
  for (let i = 0; i < m.length; i++) {
    if (m[i].startsWith(':')) params[m[i].slice(1)] = decodeURIComponent(c[i]);
    else if (m[i] !== c[i]) return null;
  }
  return params;
}

// Paramètres de requête du hash : #/cave?filtre=rouge → { filtre: 'rouge' }.
export function requete() {
  return Object.fromEntries(new URLSearchParams(routeCourante().split('?')[1] || ''));
}

export function demarrer() {
  addEventListener('hashchange', () => emettre('route', routeCourante()));
}
