// Règle de fusion entre une ligne locale et une ligne distante : la plus récente modification gagne.
// Les horodatages peuvent venir du navigateur (…Z) ou de Postgres (…+00:00) : comparaison en millisecondes.
export function horodatage(ligne) {
  const t = Date.parse(ligne?.modifie_le ?? '');
  return Number.isNaN(t) ? -Infinity : t;
}

// 'distant' si la ligne distante doit remplacer la locale, sinon 'local'.
export function choisir(locale, distante) {
  if (!locale) return 'distant';
  return horodatage(distante) > horodatage(locale) ? 'distant' : 'local';
}
