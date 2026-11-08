// Activation des modules. Un module désactivé disparaît des menus ; ses données restent intactes.
import { lire, ecrire } from './kv.js';
import { emettre } from './evenements.js';

let etats = lire('flags', {});

export function estActif(module) {
  return Object.hasOwn(etats, module.id) ? etats[module.id] : module.flag?.defaut !== false;
}

export function definir(id, actif) {
  etats = { ...etats, [id]: !!actif };
  ecrire('flags', etats);
  emettre('flags', { id, actif: !!actif });
}
