// Point d'entrée : assemble modules, navigation, thème et écran Réglages.
import { MODULES } from './registry.js';
import { VERSION } from './version.js';
import { sur, emettre } from './evenements.js';
import { estActif, definir } from './flags.js';
import { appliquer, profilCourant, basculerProfil, changerProfil, PROFILS } from './theme.js';
import { aller, routeCourante, demarrer, correspondance, requete } from './router.js';
import { h, icone, vider, ajouter } from './ui/dom.js';
import { ICONES } from './ui/icones.js';
import { initialiserSauvegarde } from './sauvegarde.js';

const sauvegarde = initialiserSauvegarde();
const core = {
  h, icone, ajouter, vider, ICONES, aller, sur, emettre, VERSION, profilCourant, basculerProfil, requete,
  store: sauvegarde.store,
  // Un écran peut préciser son titre (ex. le nom du vin sur une fiche).
  titre: (texte) => { document.getElementById('titre').textContent = texte; }
};

const ecranReglages = {
  route: '/reglages', titre: 'Réglages', icone: ICONES.reglages, place: 'entete', ordre: 99,
  rendu: (c, el) => rendreReglages(el)
};

function disponible(module) {
  return !module.profils || module.profils.includes(profilCourant());
}

function modulesActifs() {
  return MODULES.filter((m) => disponible(m) && estActif(m));
}

function ecrans() {
  return [...modulesActifs().flatMap((m) => m.ecrans || []), ecranReglages]
    .sort((a, b) => (a.ordre ?? 50) - (b.ordre ?? 50));
}

function rendreNav() {
  const nav = vider(document.getElementById('nav'));
  const ecran = trouver(routeCourante())?.ecran;
  const onglet = ecran?.onglet || ecran?.route;
  for (const e of ecrans().filter((x) => x.place === 'nav' || x.place === 'centre')) {
    const actif = e.route === onglet;
    const lien = h('a', {
      href: '#' + e.route, class: `onglet${e.place === 'centre' ? ' onglet-centre' : ''}${actif ? ' actif' : ''}`,
      'aria-current': actif ? 'page' : false
    });
    lien.append(e.place === 'centre' ? h('span', { class: 'rond' }, icone(e.icone, 26)) : icone(e.icone), e.titre);
    nav.append(lien);
  }
}

function rendreEntete(ecran) {
  document.getElementById('titre').textContent = ecran.titre;
  const actions = vider(document.getElementById('actions'));
  const autre = profilCourant() === 'vin' ? 'spiritueux' : 'vin';
  const bascule = h('button', {
    type: 'button', class: 'bouton-rond bascule-profil', 'data-test': 'bascule-profil', 'data-vers': autre,
    'aria-label': `Passer au profil ${PROFILS[autre].titre}`, title: PROFILS[autre].titre, onclick: basculerProfil
  });
  bascule.append(icone(ICONES.bascule, 18), h('span', { class: 'point-profil' }));
  actions.append(bascule);
  actions.append(sauvegarde.indicateur());
  for (const e of ecrans().filter((x) => x.place === 'entete')) {
    const b = h('a', { href: '#' + e.route, class: 'bouton-rond', 'aria-label': e.titre });
    b.append(icone(e.icone, 20));
    actions.append(b);
  }
}

function trouver(chemin) {
  for (const ecran of ecrans()) {
    const params = correspondance(ecran.route, chemin);
    if (params) return { ecran, params };
  }
  return null;
}

let rendus = 0;
async function rendre() {
  const trouve = trouver(routeCourante());
  if (!trouve) {
    const liste = ecrans();
    const premier = liste.find((e) => e.place === 'nav') || liste[0];
    history.replaceState(null, '', '#' + premier.route);
    return rendre();
  }
  const { ecran, params } = trouve;
  const numero = ++rendus;
  rendreEntete(ecran);
  rendreNav();
  const vue = document.getElementById('vue');
  const neuf = h('div', { class: 'ecran' });
  try {
    await ecran.rendu(core, neuf, params);
  } catch (e) {
    neuf.replaceChildren(h('section', { class: 'carte' }, h('h2', {}, 'Oups'), h('p', {}, e.message)));
    console.error(e);
  }
  if (numero !== rendus) return; // un rendu plus récent a pris la main
  vider(vue).append(neuf);
  vue.dataset.route = ecran.route;
  vue.focus({ preventScroll: true });
  if (!ecran.garderDefilement) scrollTo(0, 0);
}

function rendreReglages(el) {
  const profil = profilCourant();
  sauvegarde.carte(el);
  // Réglages propres aux modules actifs (ex. clés d'identification).
  for (const m of modulesActifs()) m.reglages?.(core, el);
  el.append(
    h('section', { class: 'carte' },
      h('h2', {}, 'Profil'),
      h('div', { class: 'segments', role: 'radiogroup', 'aria-label': 'Profil' },
        Object.entries(PROFILS).map(([id, p]) => h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(id === profil), class: 'segment',
          onclick: () => changerProfil(id)
        }, p.titre)))),
    h('section', { class: 'carte' },
      h('h2', {}, 'Modules'),
      h('ul', { class: 'liste-modules' },
        MODULES.map((m) => {
          const id = `flag-${m.id}`;
          const hors = !disponible(m);
          return h('li', {},
            h('label', { for: id },
              h('span', { class: 'nom' }, m.titre, m.flag?.experimental ? h('span', { class: 'badge' }, 'expérimental') : null),
              hors ? h('span', { class: 'discret' }, `Profil ${m.profils.map((p) => PROFILS[p].titre).join(', ')}`) : null),
            h('input', {
              id, type: 'checkbox', role: 'switch', class: 'interrupteur', 'data-module': m.id,
              checked: estActif(m), onchange: (ev) => definir(m.id, ev.target.checked)
            }));
        }))),
    h('p', { class: 'discret version' }, `Cave · version ${VERSION}`)
  );
}

for (const m of MODULES) m.init?.(core);
appliquer();
// Retour d'un lien de connexion : laisser Supabase lire le jeton avant que le routeur ne réécrive l'URL.
const retourLien = /access_token=|error_description=/.test(location.hash);
if (retourLien) await sauvegarde.demarrer();
demarrer();
sur('route', rendre);
// Données arrivées d'ailleurs (synchro, import) : l'écran courant se redessine.
sur('donnees', (d) => { if (d.distant || d.import) rendre(); });
sur('flags', rendre);
sur('profil', rendre);
rendre();
if (!retourLien) sauvegarde.demarrer();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
