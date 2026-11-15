// Protocole du casier Montrouge (ex-Caveasy), décodé en v9 :
// flux série sur notifications ; 0xFF sépare les trames, 0xFE échappe l'octet suivant.
// Trame = [somme des octets suivants mod 256][adresse][type][données].
// Type 0x45 : capteurs d'une rangée (adresse = n° de rangée) → [posés][retirés][présents] (vérifié sur le casier réel
// le 15/11/2026 : retrait de E3 avec E5 en place → « 00 04 10 »). Rangée 1 en bas, bit 0 = emplacement 1 à gauche.

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

// Trame 0x45 (tests et simulateur) : présents, et facultativement posés / retirés.
export const encoderRangee = (rangee, presents, poses = presents, retires = 0) => encoderTrame(rangee, 0x45, [poses, retires, presents]);

// Masque des bouteilles présentes d'une trame 0x45.
export const presentsDe = (t) => (t.donnees.length >= 3 ? t.donnees[2] : t.donnees[0]);

// Types observés (v9) ; les autres sont à découvrir avec le labo.
export const TYPES_CONNUS = { 0x00: 'état de rangée', 0x21: 'passerelle (journal)', 0x40: 'module', 0x45: 'capteurs de rangée' };

// Lecture détaillée des trames observées (journal du 15/11/2026) ; hypothèses marquées « ? ».
// 0x21 passerelle : [identifiant 15 octets][FF][genre] puis, pour genre 01 : [horloge 4 octets LE, 1/8 s][n° d'événement 2 octets LE]
//   [rangée][posés][retirés][présents selon la passerelle] (n° passé de 0x0aff à 0x0b00 le 15/11).
// 0x40 module de rangée : [02][identifiant 4 octets][nom ASCII 8][version ? 3 octets][FF][03 00 06].
// 0x00 vers une rangée : octet 3b envoyé deux fois après chaque mouvement (acquittement ?).
export function detailTrame({ adresse, type, donnees: d }) {
  const ascii = (o) => o.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·')).join('');
  if (type === 0x45 && d.length >= 3) {
    const places = (m) => [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => m & (1 << i)).map((i) => `E${i + 1}`).join('+') || '—';
    return `rangée ${adresse} : posé ${places(d[0])}, retiré ${places(d[1])}, présents ${places(d[2])}`;
  }
  if (type === 0x21 && d.length >= 16) {
    const id = ascii(d.slice(3, 13)).trim();
    if (d[16] === 0x01 && d.length >= 27) {
      const tic = d[17] | (d[18] << 8) | (d[19] << 16) | (d[20] * 2 ** 24);
      const quand = new Date(Date.UTC(2019, 0, 1) + (tic / 8) * 1000);
      const places = (m) => [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => m & (1 << i)).map((i) => `E${i + 1}`).join('+') || '—';
      return `passerelle ${id} : événement n° ${d[21] | (d[22] << 8)}, rangée ${d[23]} : posé ${places(d[24])}, retiré ${places(d[25])}, présents selon la passerelle ${places(d[26])} · horloge ${quand.toISOString().slice(0, 19).replace('T', ' ')} ?`;
    }
    return `passerelle ${id} : ${d[16] === 0x00 ? 'début' : d[16] === 0xff ? 'fin' : `genre ${d[16]}`}`;
  }
  if (type === 0x40 && d.length >= 13) return `module rangée ${adresse} : « ${ascii(d.slice(5, 13)).trim()} » id ${hexa(d.slice(1, 5))}`;
  return null;
}

export const hexa = (octets) => [...octets].map((b) => b.toString(16).padStart(2, '0')).join(' ');
export const lireHexa = (texte) => (String(texte).match(/[0-9a-f]{1,2}/gi) || []).map((x) => parseInt(x, 16));
