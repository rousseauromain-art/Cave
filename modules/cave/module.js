// Onglet « Cave » — écran provisoire jusqu'à la story S1.
import { ICONES } from '../../core/ui/icones.js';
import { ecranAVenir } from '../../core/ui/a-venir.js';

export default {
  id: 'cave',
  titre: 'Cave',
  flag: { defaut: true, experimental: false },
  ecrans: [{
    route: '/cave', titre: 'Cave', icone: ICONES.grille, place: 'nav', ordre: 20,
    rendu: ecranAVenir('Cave', 'S1', 'La matrice de vos étiquettes, avec pastille, drapeau et note.')
  }],
  tables: []
};
