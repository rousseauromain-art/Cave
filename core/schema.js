// Tables synchronisées, dans l'ordre d'envoi (les parents avant les enfants), et leurs colonnes.
// Doit rester identique à supabase/migrations/*.sql.
const COMMUNES = ['id', 'user_id', 'modifie_le', 'supprime'];

export const TABLES = {
  rangements: [...COMMUNES, 'nom', 'type', 'lieu', 'lignes', 'colonnes', 'ble_id'],
  produits: [...COMMUNES, 'profil', 'nom', 'producteur', 'cuvee', 'millesime', 'style', 'pays', 'region',
    'appellation', 'cepages', 'degre', 'age_ans', 'fut', 'note', 'apogee_debut', 'apogee_fin', 'photo_path',
    'commentaire', 'extra'],
  bouteilles: [...COMMUNES, 'produit_id', 'rangement_id', 'emplacement', 'numero', 'etat', 'niveau',
    'entree_le', 'ouverte_le', 'sortie_le', 'prix'],
  mesures: [...COMMUNES, 'produit_id', 'appareil', 'mesure_le', 'brut', 'puissance', 'tanins', 'vivacite',
    'garde', 'evolution'],
  degustations: [...COMMUNES, 'produit_id', 'mesure_id', 'le', 'note', 'mots_cles', 'commentaire', 'aeration_h']
};

export const ORDRE = Object.keys(TABLES);

// Ne garde que les colonnes connues du serveur (retire _sale, sync_at et tout champ local).
export function versServeur(table, ligne) {
  const sortie = {};
  for (const c of TABLES[table]) if (ligne[c] !== undefined) sortie[c] = ligne[c];
  return sortie;
}
