// Expérimental : autorise la mesure MyOeno sur les spiritueux (couleur ≠ goût : indices à interpréter avec prudence).
// Aucun écran propre : il débloque la connexion du scanner dans l'écran Dégustation du profil Spiritueux.
export default {
  id: 'myoeno-spiritueux',
  titre: 'MyOeno pour les spiritueux',
  flag: { defaut: false, experimental: true },
  profils: ['spiritueux'],
  ecrans: [],
  tables: ['mesures']
};
