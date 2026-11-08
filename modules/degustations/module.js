// Onglet « Dégustations » — écran provisoire jusqu'à la story S3.
import { ICONES } from '../../core/ui/icones.js';
import { ecranAVenir } from '../../core/ui/a-venir.js';

export default {
  id: 'degustations',
  titre: 'Dégustations',
  flag: { defaut: true, experimental: false },
  ecrans: [{
    route: '/degustations', titre: 'Dégustations', icone: ICONES.etoile, place: 'nav', ordre: 40,
    rendu: ecranAVenir('Dégustations', 'S3', 'Vos mesures MyOeno, notes et mots-clés.')
  }],
  tables: []
};
