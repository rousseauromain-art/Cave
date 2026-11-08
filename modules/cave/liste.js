// Écran « Cave » : matrice d'étiquettes du profil courant, filtres, recherche.
import { inventaire } from '../../core/inventaire.js';
import { FILTRES } from '../../data/filtres.js';
import { tuile } from './tuile.js';

let filtreCourant = 'tout';
let recherche = '';

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function ecranListe(core, el) {
  const { h } = core;
  const profil = core.profilCourant();
  const tous = await inventaire(core.store, profil);
  const filtres = FILTRES[profil];
  if (!filtres.some((f) => f.id === filtreCourant)) filtreCourant = 'tout';

  const bouteilles = tous.reduce((n, p) => n + p.stock, 0);
  const pays = new Set(tous.filter((p) => p.pays).map((p) => p.pays)).size;
  const grille = h('div', { class: 'matrice', role: 'list' });
  const vide = h('p', { class: 'vide' });

  function dessiner() {
    const f = filtres.find((x) => x.id === filtreCourant);
    const q = normaliser(recherche);
    const visibles = tous.filter((p) => f.test(p) && (!q || normaliser([p.nom, p.producteur, p.appellation, p.region].join(' ')).includes(q)));
    grille.replaceChildren(...visibles.map((p) => h('div', { role: 'listitem' }, tuile(core, p))));
    vide.textContent = tous.length === 0
      ? 'Votre cave est vide. Ajoutez un premier vin avec le bouton +, ou reprenez vos données dans ⚙ Réglages.'
      : visibles.length === 0 ? 'Aucun résultat.' : '';
    puces.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtre === filtreCourant)));
  }

  const puces = h('div', { class: 'puces', role: 'toolbar', 'aria-label': 'Filtres' },
    filtres.map((f) => h('button', {
      type: 'button', class: 'puce', 'data-filtre': f.id,
      onclick: () => { filtreCourant = f.id; dessiner(); }
    }, f.titre)));

  el.append(
    h('div', { class: 'bandeau' },
      h('p', { class: 'resume' }, `${bouteilles} bouteille${bouteilles > 1 ? 's' : ''} · ${tous.length} ${profil === 'vin' ? 'vin' : 'flacon'}${tous.length > 1 ? 's' : ''} · ${pays} origine${pays > 1 ? 's' : ''}`),
      h('label', { class: 'recherche' },
        h('span', { class: 'masque' }, 'Rechercher'),
        h('input', {
          type: 'search', placeholder: 'Rechercher un nom, un domaine…', value: recherche,
          oninput: (e) => { recherche = e.target.value; dessiner(); }
        })),
      puces),
    grille,
    vide,
    h('a', { href: '#/produit/nouveau', class: 'bouton-ajout', 'aria-label': profil === 'vin' ? 'Ajouter un vin' : 'Ajouter un spiritueux' }, '+')
  );
  dessiner();
}
