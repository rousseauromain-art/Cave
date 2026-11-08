// Onglet « Ce soir » — écran provisoire jusqu'à la story S4.
import { ICONES } from '../../core/ui/icones.js';
import { ecranAVenir } from '../../core/ui/a-venir.js';

export default {
  id: 'ce-soir',
  titre: 'Ce soir',
  flag: { defaut: true, experimental: false },
  ecrans: [{
    route: '/ce-soir', titre: 'Ce soir', icone: ICONES.verre, place: 'nav', ordre: 10,
    rendu: ecranAVenir('Ce soir', 'S4', 'Ce que vous pourriez ouvrir ce soir, selon l’apogée et vos envies.')
  }],
  tables: []
};
