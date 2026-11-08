// Onglet « Scanner » — écran provisoire jusqu'à la story S2.
import { ICONES } from '../../core/ui/icones.js';
import { ecranAVenir } from '../../core/ui/a-venir.js';

export default {
  id: 'scanner',
  titre: 'Scanner',
  flag: { defaut: true, experimental: false },
  ecrans: [{
    route: '/scanner', titre: 'Scanner', icone: ICONES.scanner, place: 'centre', ordre: 30,
    rendu: ecranAVenir('Scanner', 'S2', 'Photographiez une étiquette pour retrouver ou ajouter une bouteille.')
  }],
  tables: []
};
