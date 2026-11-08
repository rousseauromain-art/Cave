// Bus d'événements minimal partagé par le noyau et les modules.
const abonnes = new Map();

export function sur(nom, fn) {
  if (!abonnes.has(nom)) abonnes.set(nom, new Set());
  abonnes.get(nom).add(fn);
  return () => abonnes.get(nom).delete(fn);
}

export function emettre(nom, detail) {
  (abonnes.get(nom) || []).forEach((fn) => fn(detail));
}
