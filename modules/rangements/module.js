// Rangements : placards, étagères, casiers. Vue en grille (culs de bouteille) avec recherche et halo jaune.
import { remplacer } from '../../core/ui/dom.js';
import { ICONES } from '../../core/ui/icones.js';
import { inventaire, aGrille, emplacementsGrille, emplacementsLibres, EN_CAVE } from '../../core/inventaire.js';
import { STYLES } from '../../data/styles.js';
import { emplacement } from '../../core/ui/badges.js';
import { TYPES, COLLECTIONS, typesPour, collectionDe, visibleDans, grilleDe, libelleEmplacement } from '../../core/rangements.js';
import { dessinerEtagere } from '../../core/ui/etagere.js';
const STYLE_INCONNU = { titre: 'Non précisé', fond: 'var(--c-bord-fort)', texte: 'var(--c-texte)' };

async function contenu(store) {
  const [rangements, bouteilles] = await Promise.all([store.list('rangements'), store.list('bouteilles')]);
  const produits = new Map([...(await inventaire(store, 'vin')), ...(await inventaire(store, 'spiritueux'))].map((p) => [p.id, p]));
  const enCave = bouteilles.filter((b) => EN_CAVE.includes(b.etat));
  return { rangements, enCave, produits };
}

async function ecranListe(core, el) {
  const { h } = core;
  const profil = core.profilCourant();
  const { rangements: tous, enCave, produits } = await contenu(core.store);
  const rangements = tous.filter((r) => visibleDans(r, profil));
  const duProfil = (b) => produits.get(b.produit_id)?.profil === profil;
  const sans = enCave.filter((b) => !b.rangement_id && duProfil(b)).length;
  const message = h('p', { class: 'message', role: 'alert' });
  const type = h('select', { name: 'type' }, typesPour(profil).map(([k, t]) => h('option', { value: k }, t.titre)));
  const collection = h('select', { name: 'profil' }, Object.entries(COLLECTIONS).map(([k, t]) => h('option', { value: k, selected: k === profil }, t)));
  const libLignes = h('span', { class: 'libelle' }), libColonnes = h('span', { class: 'libelle' });
  const lignes = h('input', { name: 'lignes', type: 'number', min: '1', max: '30' });
  const colonnes = h('input', { name: 'colonnes', type: 'number', min: '1', max: '30' });
  const dims = h('div', { class: 'deux dimensions', hidden: true },
    h('label', { class: 'champ' }, libLignes, lignes), h('label', { class: 'champ' }, libColonnes, colonnes));
  const majType = () => {
    const t = TYPES[type.value];
    dims.hidden = !t.grille;
    const bar = t.grille === 'bar';
    libLignes.textContent = bar ? 'Étagères' : 'Rangées';
    libColonnes.textContent = bar ? 'Bouteilles par étagère' : 'Emplacements par rangée';
    lignes.value = bar ? '3' : '8'; colonnes.value = bar ? '6' : '6';
    if (t.collection !== 'mixte') collection.value = t.collection;
  };
  type.addEventListener('change', majType);
  if (profil === 'spiritueux') type.value = 'bar';
  majType();

  const form = h('form', { class: 'carte formulaire' },
    h('h2', {}, 'Nouveau rangement'),
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Nom'), h('input', { name: 'nom', required: true, placeholder: 'Placard du salon' })),
    h('div', { class: 'deux' },
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Type'), type),
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Collection'), collection)),
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Lieu'), h('input', { name: 'lieu', placeholder: 'Rennes' })),
    dims, message,
    h('button', { type: 'submit', class: 'bouton principal' }, 'Créer'));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.nom.trim()) { message.textContent = 'Donnez un nom au rangement.'; return; }
    const grille = !!TYPES[d.type].grille;
    await core.store.put('rangements', {
      nom: d.nom.trim(), type: d.type, profil: d.profil, lieu: d.lieu.trim() || null,
      lignes: grille ? Number(d.lignes) : null, colonnes: grille ? Number(d.colonnes) : null
    });
    core.aller('/rangements');
  });

  el.append(
    h('div', { class: 'bandeau' }, core.selecteurProfil()),
    h('ul', { class: 'liste-rangements' },
      rangements.map((r) => {
        const n = enCave.filter((b) => b.rangement_id === r.id && duProfil(b)).length;
        return h('li', {}, h('a', { href: `#/rangement/${r.id}`, class: 'carte rangement' },
          h('span', { class: 'rangement-nom' }, r.nom),
          h('span', { class: 'discret' }, [TYPES[r.type]?.titre, collectionDe(r) === 'mixte' ? 'mixte' : null, r.lieu, aGrille(r) ? `${n} / ${r.lignes * r.colonnes}` : `${n} bouteille${n > 1 ? 's' : ''}`].filter(Boolean).join(' · '))));
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
    if (grilleDe(r) === 'bar') {
      const parEmplacement = new Map(ici.map((b) => [b.emplacement, b]));
      const etageres = [];
      for (let ligne = r.lignes; ligne >= 1; ligne--) {
        const places = [];
        for (let e = 1; e <= r.colonnes; e++) {
          const code = `R${ligne}-E${e}`, b = parEmplacement.get(code);
          places.push({ code, libelle: libelleEmplacement(r, code), bouteille: b || null, produit: b ? produits.get(b.produit_id) : null, trouve: b ? !!correspond(b) : false });
        }
        etageres.push({ titre: `Étagère ${r.lignes - ligne + 1}`, places });
      }
      const aPlacer = ici.filter((b) => !emplacementsGrille(r).includes(b.emplacement));
      if (aPlacer.length) etageres.push({ titre: 'Sur le comptoir · à placer', places: aPlacer.map((b) => ({ code: null, libelle: 'à placer', bouteille: b, produit: produits.get(b.produit_id), trouve: !!correspond(b) })) });
      remplacer(zone, h('div', { class: 'carte bar-carte' },
        h('div', { class: 'grille-titre' }, h('strong', {}, 'Vue du bar'), h('span', { class: 'discret' }, 'Niveau réel · bouchon = catégorie')),
        dessinerEtagere(etageres, { surChoix: (pl) => { choisi = pl.bouteille.numero; recherche = ''; champ.value = ''; dessiner(); } })));
    } else if (aGrille(r)) {
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
      remplacer(zone, h('div', { class: 'carte' }, lignes.length ? h('ul', { class: 'liste-simple' }, lignes) : h('p', { class: 'discret' }, 'Aucune bouteille ici.')));
    }
    const premier = trouves[0];
    resultat.textContent = choisi || recherche ? `${trouves.length} bouteille${trouves.length > 1 ? 's' : ''}${premier?.emplacement ? ` · ${libelleEmplacement(r, premier.emplacement)}` : ''}` : '';
    remplacer(carteChoix, ...(premier ? [h('a', { href: `#/fiche/${premier.produit_id}`, class: 'carte bouteille-choisie' },
      emplacement(premier.numero, styleDe(premier)),
      h('span', {}, h('strong', {}, nomDe(premier)), h('span', { class: 'discret bloc' }, `${libelleEmplacement(r, premier.emplacement) || r.nom} · voir le détail dans l'inventaire`)))] : []));
  }

  const resultat = h('span', { class: 'discret' });
  const champ = h('input', {
    type: 'search', placeholder: 'Chercher une bouteille ici', 'aria-label': 'Chercher un vin dans ce rangement',
    oninput: (e) => { recherche = e.target.value; choisi = null; dessiner(); }
  });
  // Ranger ici des bouteilles qui n'ont pas encore de rangement (profil courant).
  const profil = core.profilCourant();
  const sansRangement = enCave.filter((b) => !b.rangement_id && produits.get(b.produit_id)?.profil === profil);
  const parProduit = [...new Set(sansRangement.map((b) => b.produit_id))].map((pid) => ({ p: produits.get(pid), bt: sansRangement.filter((b) => b.produit_id === pid) }));
  const msgRanger = h('p', { class: 'message', role: 'alert' });
  const rangerIci = parProduit.length ? h('details', { class: 'section', 'data-carte': 'ranger-ici' },
    h('summary', {}, h('span', { class: 'section-titre' }, 'Ranger ici'), h('span', { class: 'section-resume' }, `${sansRangement.length} sans rangement`)),
    h('div', { class: 'section-corps' },
      h('ul', { class: 'liste-cocher' }, parProduit.map(({ p, bt }) => h('li', {}, h('label', {}, h('input', { type: 'checkbox', value: p.id }), ` ${p.nom}`, h('span', { class: 'discret' }, ` · ${bt.length}`))))),
      h('button', {
        type: 'button', class: 'bouton principal', onclick: async (e) => {
          const choisis = [...e.currentTarget.closest('.section-corps').querySelectorAll('input:checked')].map((x) => x.value);
          const aRanger = sansRangement.filter((b) => choisis.includes(b.produit_id));
          if (!aRanger.length) { msgRanger.textContent = 'Cochez au moins un produit.'; return; }
          const libres = aGrille(r) ? await emplacementsLibres(core.store, r) : [];
          if (aGrille(r) && libres.length < aRanger.length) { msgRanger.textContent = `Plus que ${libres.length} emplacement(s) libre(s).`; return; }
          for (const [i, b] of aRanger.entries()) await core.store.put('bouteilles', { ...b, rangement_id: r.id, emplacement: libres[i] || b.emplacement || null });
          core.aller(`/rangement/${r.id}`);
        }
      }, 'Ranger ici'),
      msgRanger)) : null;

  // Modifier / supprimer le rangement
  const msgModif = h('p', { class: 'message', role: 'alert' });
  const grilleR = !!TYPES[r.type]?.grille;
  const formModif = h('form', { class: 'formulaire' },
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Nom'), h('input', { name: 'nom', value: r.nom, required: true })),
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Lieu'), h('input', { name: 'lieu', value: r.lieu || '' })),
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Collection'),
      h('select', { name: 'profil' }, Object.entries(COLLECTIONS).map(([k, t]) => h('option', { value: k, selected: k === collectionDe(r) }, t)))),
    grilleR ? h('div', { class: 'deux' },
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, grilleDe(r) === 'bar' ? 'Étagères' : 'Rangées'), h('input', { name: 'lignes', type: 'number', min: '1', max: '30', value: String(r.lignes) })),
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, grilleDe(r) === 'bar' ? 'Bouteilles par étagère' : 'Emplacements par rangée'), h('input', { name: 'colonnes', type: 'number', min: '1', max: '30', value: String(r.colonnes) }))) : null,
    msgModif,
    h('div', { class: 'boutons' },
      h('button', { type: 'submit', class: 'bouton principal' }, 'Enregistrer'),
      h('button', {
        type: 'button', class: 'bouton danger', onclick: async () => {
          if (ici.length) { msgModif.textContent = `Videz d\u2019abord le rangement (${ici.length} bouteille(s)).`; return; }
          await core.store.remove('rangements', r.id);
          core.aller('/rangements');
        }
      }, 'Supprimer ce rangement')));
  formModif.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(formModif));
    if (!d.nom.trim()) { msgModif.textContent = 'Le nom est obligatoire.'; return; }
    await core.store.put('rangements', { ...r, nom: d.nom.trim(), lieu: d.lieu.trim() || null, profil: d.profil, ...(grilleR ? { lignes: Number(d.lignes), colonnes: Number(d.colonnes) } : {}) });
    core.aller(`/rangement/${r.id}`);
  });
  const modifier = h('details', { class: 'section', 'data-carte': 'modifier-rangement' },
    h('summary', {}, h('span', { class: 'section-titre' }, 'Modifier le rangement')),
    h('div', { class: 'section-corps' }, formModif));

  const lienConnecte = r.type === 'montrouge' && core.moduleActif('montrouge')
    ? h('a', { href: `#/montrouge/${r.id}`, class: 'bouton principal grand' }, 'Casier connecté : capteurs en direct') : null;
  core.ajouter(el, [lienConnecte, h('div', { class: 'recherche-casier' }, champ, resultat), zone, carteChoix, rangerIci, modifier]);
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
