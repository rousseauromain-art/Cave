// Point d'entrée : assemble modules, navigation, thème et écran Réglages.
import { MODULES } from './registry.js';
import { VERSION } from './version.js';
import { sur } from './evenements.js';
import { estActif, definir } from './flags.js';
import { appliquer, profilCourant, basculerProfil, changerProfil, PROFILS } from './theme.js';
import { aller, routeCourante, demarrer } from './router.js';
import { h, icone, vider, ajouter } from './ui/dom.js';
import { ICONES } from './ui/icones.js';

const core = { h, icone, ajouter, ICONES, aller, sur, VERSION, profilCourant, basculerProfil };

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
  const route = routeCourante();
  for (const e of ecrans().filter((x) => x.place === 'nav' || x.place === 'centre')) {
    const actif = e.route === route;
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
  actions.append(h('button', {
    type: 'button', class: 'pilule', 'data-test': 'bascule-profil',
    'aria-label': `Passer au profil ${PROFILS[autre].titre}`, onclick: basculerProfil
  }, PROFILS[autre].titre, icone(ICONES.bascule, 14)));
  for (const e of ecrans().filter((x) => x.place === 'entete')) {
    const b = h('a', { href: '#' + e.route, class: 'bouton-rond', 'aria-label': e.titre });
    b.append(icone(e.icone, 20));
    actions.append(b);
  }
}

function rendre() {
  const liste = ecrans();
  const ecran = liste.find((e) => e.route === routeCourante());
  if (!ecran) {
    const premier = liste.find((e) => e.place === 'nav') || liste[0];
    history.replaceState(null, '', '#' + premier.route);
    return rendre();
  }
  rendreEntete(ecran);
  rendreNav();
  const vue = vider(document.getElementById('vue'));
  ecran.rendu(core, vue);
  vue.focus({ preventScroll: true });
}

function rendreReglages(el) {
  const profil = profilCourant();
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
demarrer();
sur('route', rendre);
sur('flags', rendre);
sur('profil', rendre);
rendre();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
