// Écran « Cave » : matrice d'étiquettes du profil courant, filtres, recherche.
import { remplacer } from '../../core/ui/dom.js';
import { inventaire } from '../../core/inventaire.js';
import { filtresPour } from '../../data/filtres.js';
import { lireCepages } from '../../core/identification.js';
import { tuile } from './tuile.js';

let filtreCourant = 'tout';
let recherche = '';
let cepageCourant = null;

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function ecranListe(core, el) {
  const { h } = core;
  const profil = core.profilCourant();
  const tous = await inventaire(core.store, profil);
  const filtres = filtresPour(profil, tous);
  // Cépages : mots-clés de la cave (les plus fréquents d'abord) ; #/cave?cepage=Grenache arrive depuis une fiche.
  for (const p of tous) p.cepagesListe = lireCepages(p.cepages);
  if (core.requete().cepage) cepageCourant = core.requete().cepage;
  const frequences = new Map();
  for (const p of tous) for (const c of p.cepagesListe) frequences.set(c.nom, (frequences.get(c.nom) || 0) + 1);
  const cepages = [...frequences.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([nom, n]) => ({ nom, n }));
  if (cepageCourant && !frequences.has(cepageCourant)) cepageCourant = null;
  if (!filtres.some((f) => f.id === filtreCourant)) filtreCourant = 'tout';

  const bouteilles = tous.reduce((n, p) => n + p.stock, 0);
  const pays = new Set(tous.filter((p) => p.pays).map((p) => p.pays)).size;
  const grille = h('div', { class: 'matrice', role: 'list' });
  const vide = h('p', { class: 'vide' });

  function dessiner() {
    const f = filtres.find((x) => x.id === filtreCourant);
    const q = normaliser(recherche);
    const visibles = tous.filter((p) => f.test(p) && (!cepageCourant || p.cepagesListe.some((c) => c.nom === cepageCourant))
      && (!q || normaliser([p.nom, p.producteur, p.appellation, p.region, p.cepages].join(' ')).includes(q)));
    remplacer(grille, ...visibles.map((p) => h('div', { role: 'listitem' }, tuile(core, p))));
    vide.textContent = tous.length === 0
      ? 'Votre cave est vide. Ajoutez un premier vin avec le bouton +, ou reprenez vos données dans ⚙ Réglages.'
      : visibles.length === 0 ? 'Aucun résultat.' : '';
    puces.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtre === filtreCourant)));
    motsCepages?.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cepage === cepageCourant)));
  }

  const motsCepages = profil === 'vin' && cepages.length ? h('div', { class: 'puces-mots cepages-cave', role: 'toolbar', 'aria-label': 'Cépages' },
    h('span', { class: 'discret' }, 'Cépages'),
    cepages.map((c) => h('button', {
      type: 'button', class: 'puce-mot', 'data-cepage': c.nom,
      onclick: () => { cepageCourant = cepageCourant === c.nom ? null : c.nom; dessiner(); }
    }, `${c.nom} · ${c.n}`))) : null;

  const puces = h('div', { class: 'puces', role: 'toolbar', 'aria-label': 'Filtres' },
    filtres.map((f) => h('button', {
      type: 'button', class: 'puce', 'data-filtre': f.id,
      onclick: () => { filtreCourant = f.id; dessiner(); }
    }, f.titre)));

  el.append(
    h('div', { class: 'bandeau' },
      core.selecteurProfil(),
      h('p', { class: 'resume' }, `${bouteilles} bouteille${bouteilles > 1 ? 's' : ''} · ${tous.length} ${profil === 'vin' ? 'vin' : 'flacon'}${tous.length > 1 ? 's' : ''} · ${pays} origine${pays > 1 ? 's' : ''}`),
      h('label', { class: 'recherche' },
        h('span', { class: 'masque' }, 'Rechercher'),
        h('input', {
          type: 'search', placeholder: profil === 'vin' ? 'Rechercher un nom, un domaine, un cépage…' : 'Rechercher un nom, un domaine…', value: recherche,
          oninput: (e) => { recherche = e.target.value; dessiner(); }
        })),
      puces, motsCepages),
    grille,
    vide,
    h('a', { href: '#/produit/nouveau', class: 'bouton-ajout', 'aria-label': profil === 'vin' ? 'Ajouter un vin' : 'Ajouter un spiritueux' }, '+')
  );
  dessiner();
}
