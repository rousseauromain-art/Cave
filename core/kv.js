// Réglages clé/valeur persistants.
// Provisoire (S0-01) : localStorage. S0-02 bascule vers la table IndexedDB « reglages » sans changer cette API.
const PREFIXE = 'cave.';

export function lire(cle, defaut) {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    return brut === null ? defaut : JSON.parse(brut);
  } catch {
    return defaut;
  }
}

export function ecrire(cle, valeur) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    /* navigation privée ou stockage plein : le réglage vit seulement en mémoire */
  }
}
