// Protocole du casier Montrouge (ex-Caveasy), décodé en v9 :
// flux série sur notifications ; 0xFF sépare les trames, 0xFE échappe l'octet suivant.
// Trame = [somme des octets suivants mod 256][adresse][type][données].
// Type 0x45 : capteurs d'une rangée (adresse = n° de rangée) → [masque présent][bits éteints][bits allumés].

export function creerDecodeur(surTrame) {
  let tampon = [], echappe = false;
  return (octets) => {
    for (const b of octets) {
      if (echappe) { tampon.push(b); echappe = false; continue; }
      if (b === 0xfe) { echappe = true; continue; }
      if (b === 0xff) { if (tampon.length) surTrame(tampon); tampon = []; continue; }
      tampon.push(b);
    }
  };
}

export function lireTrame(f) {
  if (f.length < 3) return { valide: false };
  const somme = f.slice(1).reduce((a, b) => a + b, 0) & 255;
  if (somme !== f[0]) return { valide: false };
  return { valide: true, adresse: f[1], type: f[2], donnees: f.slice(3) };
}

// Différence entre deux masques d'une rangée : emplacements (0..7) posés et retirés.
export function differences(avant, apres) {
  const poses = [], retires = [];
  for (let i = 0; i < 8; i++) {
    const bit = 1 << i;
    if (apres & bit && !(avant & bit)) poses.push(i);
    if (avant & bit && !(apres & bit)) retires.push(i);
  }
  return { poses, retires };
}

export const emplacement = (rangee, i) => `R${rangee}-E${i + 1}`;

// Encodage d'une trame quelconque : somme, adresse, type, données, échappement, séparateurs.
export function encoderTrame(adresse, type, donnees = []) {
  const corps = [adresse & 255, type & 255, ...donnees.map((b) => b & 255)];
  const brut = [corps.reduce((a, b) => a + b, 0) & 255, ...corps];
  return [0xff, ...brut.flatMap((b) => (b === 0xff || b === 0xfe ? [0xfe, b] : [b])), 0xff];
}

// Trame 0x45 (tests et simulateur).
export const encoderRangee = (rangee, masque) => encoderTrame(rangee, 0x45, [masque, 0, masque]);

// Types observés (v9) ; les autres sont à découvrir avec le labo.
export const TYPES_CONNUS = { 0x00: 'état de rangée', 0x21: 'passerelle (journal)', 0x40: 'module', 0x45: 'capteurs de rangée' };

export const hexa = (octets) => [...octets].map((b) => b.toString(16).padStart(2, '0')).join(' ');
export const lireHexa = (texte) => (String(texte).match(/[0-9a-f]{1,2}/gi) || []).map((x) => parseInt(x, 16));
