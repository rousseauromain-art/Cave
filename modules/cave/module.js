// Inventaire : matrice d'étiquettes, fiche dépliable, ajout/modification (stock 0 autorisé).
import { ICONES } from '../../core/ui/icones.js';
import { ecranListe } from './liste.js';
import { ecranFiche } from './fiche.js';
import { ecranFormulaire } from './formulaire.js';

export default {
  id: 'cave',
  titre: 'Cave',
  flag: { defaut: true, experimental: false },
  ecrans: [
    { route: '/cave', titre: 'Cave', icone: ICONES.grille, place: 'nav', ordre: 20, rendu: ecranListe },
    { route: '/fiche/:id', titre: 'Fiche', onglet: '/cave', rendu: ecranFiche },
    { route: '/produit/nouveau', titre: 'Nouveau', onglet: '/cave', rendu: (c, el) => ecranFormulaire(c, el, {}) },
    { route: '/produit/:id/modifier', titre: 'Modifier', onglet: '/cave', rendu: ecranFormulaire }
  ],
  tables: ['produits', 'bouteilles']
};
