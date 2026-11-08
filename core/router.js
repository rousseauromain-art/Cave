// Navigation par hash : #/cave, #/aide… Les écrans sont fournis par les modules et le noyau.
import { emettre } from './evenements.js';

export function routeCourante() {
  return location.hash.replace(/^#/, '') || '';
}

export function aller(route) {
  if (routeCourante() === route) emettre('route', route);
  else location.hash = route;
}

export function demarrer() {
  addEventListener('hashchange', () => emettre('route', routeCourante()));
}
