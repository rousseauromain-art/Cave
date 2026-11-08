// Inventaire : matrice d'étiquettes, fiche dépliable, ajout/modification (stock 0 autorisé).
import { ICONES } from '../../core/ui/icones.js';
import { ecranListe } from './liste.js';
import { ecranFiche } from './fiche.js';
import { ecranFormulaire } from './formulaire.js';
import { chargerCollection, importerCollection } from '../../core/import-whisky.js';

// Réglages : reprise de la collection whisky de l'ancienne page, si elle est encore publiée.
async function reglages(core, el) {
  const { h } = core;
  const carte = h('section', { class: 'carte', 'data-carte': 'reprise-whisky', hidden: true });
  el.append(carte);
  let sites;
  try { sites = await chargerCollection(); } catch { sites = null; }
  if (!sites) return;
  const total = sites.reduce((n, s) => n + (s.expressions || []).length, 0);
  const msg = h('p', { class: 'message', role: 'status' });
  carte.hidden = false;
  core.ajouter(carte, [
    h('h2', {}, 'Reprendre la collection whisky'),
    h('p', {}, `La page « Collection Privée » contient ${total} flacon(s) de ${sites.length} distillerie(s).`),
    h('button', {
      type: 'button', class: 'bouton principal', onclick: async () => {
        const b = await importerCollection(core.store, sites);
        core.ajouter(core.vider(msg), [`${b.flacons} flacon(s) repris${b.deja ? `, ${b.deja} déjà présent(s)` : ''}. `, h('a', { href: '#/cave', onclick: () => core.profilCourant() === 'vin' && core.basculerProfil() }, 'Voir les spiritueux')]);
      }
    }, 'Reprendre les spiritueux'),
    h('p', { class: 'discret' }, 'Origine, catégorie, âge, degré, notes et lien de chaque flacon ; relançable sans doublon.'),
    msg
  ]);
}

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
  reglages,
  tables: ['produits', 'bouteilles']
};
