// Rangements : placards, étagères, casiers. Vue en grille (culs de bouteille) avec recherche et halo jaune.
import { ICONES } from '../../core/ui/icones.js';
import { inventaire, aGrille, emplacementsGrille, EN_CAVE } from '../../core/inventaire.js';
import { STYLES } from '../../data/styles.js';
import { emplacement } from '../../core/ui/badges.js';

const TYPES = { placard: 'Placard', etagere: 'Étagère', casier: 'Casier', montrouge: 'Casier Montrouge (connecté)' };
const STYLE_INCONNU = { titre: 'Non précisé', fond: 'var(--c-bord-fort)', texte: 'var(--c-texte)' };

async function contenu(store) {
  const [rangements, bouteilles] = await Promise.all([store.list('rangements'), store.list('bouteilles')]);
  const produits = new Map([...(await inventaire(store, 'vin')), ...(await inventaire(store, 'spiritueux'))].map((p) => [p.id, p]));
  const enCave = bouteilles.filter((b) => EN_CAVE.includes(b.etat));
  return { rangements, enCave, produits };
}

async function ecranListe(core, el) {
  const { h } = core;
  const { rangements, enCave } = await contenu(core.store);
  const sans = enCave.filter((b) => !b.rangement_id).length;
  const message = h('p', { class: 'message', role: 'alert' });
  const type = h('select', { name: 'type' }, Object.entries(TYPES).map(([k, t]) => h('option', { value: k }, t)));
  const dims = h('div', { class: 'deux dimensions', hidden: true },
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Rangées'), h('input', { name: 'lignes', type: 'number', min: '1', max: '30', value: '8' })),
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Emplacements par rangée'), h('input', { name: 'colonnes', type: 'number', min: '1', max: '30', value: '6' })));
  type.addEventListener('change', () => { dims.hidden = !['casier', 'montrouge'].includes(type.value); });

  const form = h('form', { class: 'carte formulaire' },
    h('h2', {}, 'Nouveau rangement'),
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Nom'), h('input', { name: 'nom', required: true, placeholder: 'Placard du salon' })),
    h('div', { class: 'deux' },
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Type'), type),
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Lieu'), h('input', { name: 'lieu', placeholder: 'Rennes' }))),
    dims, message,
    h('button', { type: 'submit', class: 'bouton principal' }, 'Créer'));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.nom.trim()) { message.textContent = 'Donnez un nom au rangement.'; return; }
    const grille = ['casier', 'montrouge'].includes(d.type);
    await core.store.put('rangements', {
      nom: d.nom.trim(), type: d.type, lieu: d.lieu.trim() || null,
      lignes: grille ? Number(d.lignes) : null, colonnes: grille ? Number(d.colonnes) : null
    });
    core.aller('/rangements');
  });

  el.append(
    h('ul', { class: 'liste-rangements' },
      rangements.map((r) => {
        const n = enCave.filter((b) => b.rangement_id === r.id).length;
        return h('li', {}, h('a', { href: `#/rangement/${r.id}`, class: 'carte rangement' },
          h('span', { class: 'rangement-nom' }, r.nom),
          h('span', { class: 'discret' }, [TYPES[r.type], r.lieu, aGrille(r) ? `${n} / ${r.lignes * r.colonnes}` : `${n} bouteille${n > 1 ? 's' : ''}`].filter(Boolean).join(' · '))));
      }),
      sans ? h('li', {}, h('div', { class: 'carte rangement' }, h('span', { class: 'rangement-nom' }, 'Sans rangement'), h('span', { class: 'discret' }, `${sans} bouteille${sans > 1 ? 's' : ''}`))) : null),
    form);
}

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function ecranDetail(core, el, { id }) {
  const { h } = core;
  const { rangements, enCave, produits } = await contenu(core.store);
  const r = rangements.find((x) => x.id === id);
  if (!r) { el.append(h('p', {}, 'Rangement introuvable.')); return; }
  core.titre(r.nom);
  const ici = enCave.filter((b) => b.rangement_id === r.id);
  const cible = Number(core.requete().b) || null;
  let recherche = '';
  let choisi = cible;

  const styleDe = (b) => produits.get(b.produit_id)?.styleInfo || STYLE_INCONNU;
  const nomDe = (b) => produits.get(b.produit_id)?.nom || 'Inconnu';
  const correspond = (b) => (choisi ? b.numero === choisi : recherche && normaliser(nomDe(b)).includes(normaliser(recherche)));

  const zone = h('div');
  const carteChoix = h('div', { class: 'choix-bouteille' });

  function dessiner() {
    const trouves = ici.filter(correspond);
    if (aGrille(r)) {
      const parEmplacement = new Map(ici.map((b) => [b.emplacement, b]));
      const rangs = [];
      for (let ligne = r.lignes; ligne >= 1; ligne--) {
        const cases = [];
        for (let e = 1; e <= r.colonnes; e++) {
          const b = parEmplacement.get(`R${ligne}-E${e}`);
          if (!b) { cases.push(h('span', { class: 'emplacement libre', role: 'img', 'aria-label': `R${ligne}-E${e} libre` })); continue; }
          const rond = emplacement(b.numero, styleDe(b), { trouve: correspond(b) });
          cases.push(h('button', {
            type: 'button', class: 'case', 'aria-label': `Bouteille ${b.numero}, ${nomDe(b)}, R${ligne}-E${e}`,
            onclick: () => { choisi = b.numero; recherche = ''; champ.value = ''; dessiner(); }
          }, rond));
        }
        rangs.push(h('div', { class: 'rangee' }, h('span', { class: 'rangee-nom' }, `R${ligne}`), cases));
      }
      const horsGrille = ici.filter((b) => !emplacementsGrille(r).includes(b.emplacement));
      core.ajouter(core.vider(zone), [
        h('div', { class: 'carte grille-casier' }, h('div', { class: 'grille-titre' }, h('strong', {}, 'Vue de face'), h('span', { class: 'discret' }, 'Culs de bouteille · touchez pour identifier')), rangs),
        horsGrille.length ? h('p', { class: 'discret' }, `${horsGrille.length} bouteille(s) sans emplacement précis.`) : null]);
    } else {
      const lignes = [...new Set(ici.map((b) => b.produit_id))].map((pid) => {
        const bt = ici.filter((b) => b.produit_id === pid);
        const trouve = bt.some(correspond);
        return h('li', { class: trouve ? 'trouve' : null }, h('a', { href: `#/fiche/${pid}` }, nomDe(bt[0])), h('span', { class: 'discret' }, ` · ${bt.length} · n° ${bt.map((b) => b.numero).join(', ')}`));
      });
      zone.replaceChildren(h('div', { class: 'carte' }, lignes.length ? h('ul', { class: 'liste-simple' }, lignes) : h('p', { class: 'discret' }, 'Aucune bouteille ici.')));
    }
    const premier = trouves[0];
    resultat.textContent = choisi || recherche ? `${trouves.length} bouteille${trouves.length > 1 ? 's' : ''}${premier?.emplacement ? ` · ${premier.emplacement}` : ''}` : '';
    carteChoix.replaceChildren(...(premier ? [h('a', { href: `#/fiche/${premier.produit_id}`, class: 'carte bouteille-choisie' },
      emplacement(premier.numero, styleDe(premier)),
      h('span', {}, h('strong', {}, nomDe(premier)), h('span', { class: 'discret bloc' }, `${premier.emplacement || r.nom} · voir le détail dans l'inventaire`)))] : []));
  }

  const resultat = h('span', { class: 'discret' });
  const champ = h('input', {
    type: 'search', placeholder: 'Chercher un vin dans ce rangement', 'aria-label': 'Chercher un vin dans ce rangement',
    oninput: (e) => { recherche = e.target.value; choisi = null; dessiner(); }
  });
  el.append(h('div', { class: 'recherche-casier' }, champ, resultat), zone, carteChoix);
  dessiner();
}

export default {
  id: 'rangements',
  titre: 'Rangements',
  flag: { defaut: true, experimental: false },
  ecrans: [
    { route: '/rangements', titre: 'Rangements', icone: ICONES.casier, place: 'nav', ordre: 50, rendu: ecranListe },
    { route: '/rangement/:id', titre: 'Rangement', onglet: '/rangements', rendu: ecranDetail }
  ],
  tables: ['rangements', 'bouteilles']
};
