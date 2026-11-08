// Profil (vin / spiritueux) : pilote le thème via data-profil sur <html> et filtre les modules.
import { lire, ecrire } from './kv.js';
import { emettre } from './evenements.js';

export const PROFILS = {
  vin: { titre: 'Vins', couleurMeta: '#4A0B22' },
  spiritueux: { titre: 'Spiritueux', couleurMeta: '#2B1A10' }
};

let profil = PROFILS[lire('profil')] ? lire('profil') : 'vin';

export function profilCourant() {
  return profil;
}

export function appliquer() {
  document.documentElement.dataset.profil = profil;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = PROFILS[profil].couleurMeta;
}

export function changerProfil(nouveau) {
  if (!PROFILS[nouveau] || nouveau === profil) return;
  profil = nouveau;
  ecrire('profil', profil);
  appliquer();
  emettre('profil', profil);
}

export function basculerProfil() {
  changerProfil(profil === 'vin' ? 'spiritueux' : 'vin');
}
