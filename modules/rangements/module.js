// Rangements : placards, étagères, casiers. Vue en grille (culs de bouteille) avec recherche et halo jaune.
import { remplacer } from '../../core/ui/dom.js';
import { ICONES } from '../../core/ui/icones.js';
import { inventaire, aGrille, emplacementsGrille, emplacementsLibres, EN_CAVE, libelleNiveau, versesRestants } from '../../core/inventaire.js';
import { STYLES } from '../../data/styles.js';
import { emplacement, drapeau, pastille } from '../../core/ui/badges.js';
import { DRAPEAUX } from '../../data/drapeaux.js';
import { TYPES, COLLECTIONS, typesPour, collectionDe, visibleDans, libelleEmplacement, vueDe } from '../../core/rangements.js';
import { dessinerBar } from '../../core/ui/etagere.js';
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
    libLignes.textContent = 'Rangées';
    libColonnes.textContent = 'Emplacements par rangée';
    lignes.value = '8'; colonnes.value = '6';
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

// Regroupements du bar : une étagère par pays, par catégorie ou par niveau.
const REGROUPEMENTS = {
  pays: { titre: 'Pays', cle: (b, p) => (p?.pays ? [p.pays, DRAPEAUX[p.pays]?.nom || p.pays, drapeau(p.pays, 22)] : ['?', 'Origine inconnue', null]), ordre: (a, b) => b.places.length - a.places.length },
  categorie: { titre: 'Catégorie', cle: (b, p) => (p?.style ? [p.style, p.styleInfo?.titre || p.style, pastille(p.styleInfo)] : ['?', 'Non précisée', null]), ordre: (a, b) => b.places.length - a.places.length },
  niveau: { titre: 'Niveau', cle: (b) => (b.etat === 'ouverte' ? ['a', 'Entamées', null] : ['b', 'Pleines', null]), ordre: (a, b) => a.titre.localeCompare(b.titre) }
};
let triBar = 'pays';

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
    if (vueDe(r) === 'bar') {
      const groupes = new Map();
      for (const b of ici) {
        const p = produits.get(b.produit_id);
        const [cle, titre, entete] = REGROUPEMENTS[triBar].cle(b, p);
        if (!groupes.has(cle)) groupes.set(cle, { titre, entete, places: [] });
        groupes.get(cle).places.push({ bouteille: b, produit: p, trouve: !!correspond(b) });
      }
      const liste = [...groupes.entries()].sort(([ka, a], [kb, b]) => (ka === '?') - (kb === '?') || REGROUPEMENTS[triBar].ordre(a, b) || a.titre.localeCompare(b.titre))
        .map(([, g]) => ({ ...g, resume: `${g.places.length} bouteille${g.places.length > 1 ? 's' : ''}`, places: g.places.sort((x, y) => (x.produit?.nom || '').localeCompare(y.produit?.nom || '')) }));
      remplacer(zone,
        h('div', { class: 'tri-bar', role: 'group', 'aria-label': 'Ranger par' }, h('span', { class: 'discret' }, 'Ranger par'),
          Object.entries(REGROUPEMENTS).map(([k, t]) => h('button', { type: 'button', class: 'puce-mot', 'aria-pressed': String(k === triBar), onclick: () => { triBar = k; dessiner(); } }, t.titre))),
        h('div', { class: 'carte bar-carte' }, liste.length ? dessinerBar(liste, { surChoix: (pl) => { choisi = pl.bouteille.numero; recherche = ''; champ.value = ''; dessiner(); } }) : h('p', { class: 'discret' }, 'Aucune bouteille ici : rangez-en depuis leur fiche ou ci-dessous.')));
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
      h('span', {}, h('strong', {}, nomDe(premier)), h('span', { class: 'discret bloc' }, detailChoix(premier))))] : []));
  }

  // Sous-titre de la bouteille choisie : lieu, ou origine et niveau pour le bar.
  function detailChoix(b) {
    if (vueDe(r) !== 'bar') return `${libelleEmplacement(r, b.emplacement) || r.nom} · voir le détail dans l'inventaire`;
    const p = produits.get(b.produit_id);
    const cl = Number(p?.extra?.volume_cl) || 70, niveau = b.etat === 'ouverte' ? b.niveau ?? 100 : 100;
    return [p?.region || DRAPEAUX[p?.pays]?.nom, b.etat === 'ouverte' ? `reste ${libelleNiveau(niveau)}` : 'pleine', `≈ ${versesRestants(niveau, cl)} verres`].filter(Boolean).join(' · ');
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
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Rangées'), h('input', { name: 'lignes', type: 'number', min: '1', max: '30', value: String(r.lignes) })),
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Emplacements par rangée'), h('input', { name: 'colonnes', type: 'number', min: '1', max: '30', value: String(r.colonnes) }))) : null,
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
