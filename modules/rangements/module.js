// Onglet « Rangements » — écran provisoire jusqu'à la story S1 et S6.
import { ICONES } from '../../core/ui/icones.js';
import { ecranAVenir } from '../../core/ui/a-venir.js';

export default {
  id: 'rangements',
  titre: 'Rangements',
  flag: { defaut: true, experimental: false },
  ecrans: [{
    route: '/rangements', titre: 'Rangements', icone: ICONES.casier, place: 'nav', ordre: 50,
    rendu: ecranAVenir('Rangements', 'S1 et S6', 'Placard, étagères et casier Montrouge avec le halo de recherche.')
  }],
  tables: []
};
