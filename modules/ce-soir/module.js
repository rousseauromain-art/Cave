// Ce soir : quoi ouvrir (déclin d'abord, puis apogée), et préparation du service (aération Aveine, température).
import { ICONES } from '../../core/ui/icones.js';
import { inventaire, produitEnrichi, nomComplet } from '../../core/inventaire.js';
import { PHASES, SERVICE, MODELES, PREFERENCES, aerationPour, reglagesService, enregistrerReglagesService } from '../../core/apogee.js';
import { tuile } from '../cave/tuile.js';

const ORDRE_PHASE = { declin: 0, apogee: 1, jeunesse: 3 };

async function ecran(core, el) {
  const { h } = core;
  const profil = core.profilCourant();
  const tous = (await inventaire(core.store, profil)).filter((p) => p.stock > 0);
  if (!tous.length) {
    el.append(h('p', { class: 'vide' }, 'Rien en stock pour l’instant. Ajoutez des bouteilles dans la Cave.'));
    return;
  }
  const groupe = (titre, sousTitre, liste) => (liste.length ? h('section', { class: 'groupe-ce-soir' },
    h('h2', {}, titre, h('span', { class: 'discret' }, ` · ${liste.length}`)),
    sousTitre ? h('p', { class: 'discret' }, sousTitre) : null,
    h('div', { class: 'matrice' }, liste.slice(0, 9).map((p) => tuile(core, p)))) : null);

  if (profil === 'spiritueux') {
    const entamees = tous.filter((p) => p.bouteilles.some((b) => b.etat === 'ouverte'))
      .sort((a, b) => Math.min(...a.bouteilles.map((x) => x.niveau ?? 100)) - Math.min(...b.bouteilles.map((x) => x.niveau ?? 100)));
    core.ajouter(el, [
      groupe('Bouteilles entamées', 'Les plus basses d’abord : à finir avant qu’elles ne s’éventent.', entamees),
      groupe('Le reste de la collection', null, tous.filter((p) => !entamees.includes(p)))
    ]);
    return;
  }
  const tries = [...tous].sort((a, b) => (ORDRE_PHASE[a.phase] ?? 2) - (ORDRE_PHASE[b.phase] ?? 2) || (a.apogee?.fin ?? 9999) - (b.apogee?.fin ?? 9999));
  core.ajouter(el, [
    groupe('À boire sans attendre', 'Plateau passé : le fruit s’efface.', tries.filter((p) => p.phase === 'declin')),
    groupe('À leur apogée', 'Le bon moment.', tries.filter((p) => p.phase === 'apogee')),
    groupe('Apogée inconnue', 'Ajoutez millésime et appellation pour les classer.', tries.filter((p) => !p.phase)),
    groupe('Encore jeunes', 'Patience, ou une longue aération.', tries.filter((p) => p.phase === 'jeunesse'))
  ]);
}

async function ecranServir(core, el, { id }) {
  const { h } = core;
  const p = await produitEnrichi(core.store, id);
  if (!p) { el.append(h('p', {}, 'Vin introuvable.')); return; }
  core.titre('Servir');
  const r = reglagesService();
  const heures = aerationPour(p);
  const temp = SERVICE[p.style];
  const heure = h('input', { type: 'time', value: '20:00', 'aria-label': 'Heure de service' });
  const debut = h('strong', { class: 'grand-chiffre' });
  const maj = () => {
    const [hh, mm] = heure.value.split(':').map(Number);
    const d = new Date(); d.setHours(hh - heures, mm, 0, 0);
    debut.textContent = heures ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'au moment de servir';
  };
  heure.addEventListener('input', maj);
  maj();
  el.append(
    h('section', { class: 'carte service' },
      h('h2', {}, nomComplet(p)),
      h('p', { class: 'discret' }, [p.styleInfo?.titre, p.phase ? PHASES[p.phase] : null, p.mesure ? `tanins ${p.mesure.tanins}` : 'sans mesure MyOeno'].filter(Boolean).join(' · ')),
      h('div', { class: 'service-ligne' }, h('span', {}, 'Aération'), h('strong', { class: 'grand-chiffre' }, heures ? `${heures} h` : 'aucune')),
      h('div', { class: 'service-ligne' }, h('span', {}, 'Température'), h('strong', { class: 'grand-chiffre' }, temp ? `${temp[0]}–${temp[1]} °C` : '—')),
      h('label', { class: 'service-ligne' }, h('span', {}, 'Servir à'), heure),
      h('div', { class: 'service-ligne' }, h('span', {}, heures ? 'Lancer l’Aveine à' : 'Ouvrir'), debut),
      h('p', { class: 'discret' }, `Réglez ${heures} h sur l’${MODELES[r.modele].titre.split(' (')[0]} (réglage manuel ; le pilotage Bluetooth viendra plus tard).`)),
    h('a', { href: `#/fiche/${p.id}`, class: 'bouton' }, 'Retour à la fiche'));
}

function reglages(core, el) {
  const { h } = core;
  const r = reglagesService();
  const message = h('p', { class: 'message', role: 'status' });
  const form = h('form', { class: 'formulaire', 'data-carte': 'service' },
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Aérateur'),
      h('select', { name: 'modele' }, Object.entries(MODELES).map(([k, m]) => h('option', { value: k, selected: r.modele === k }, m.titre)))),
    h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Durée d’aération'),
      h('select', { name: 'preference' }, Object.entries(PREFERENCES).map(([k, t]) => h('option', { value: k, selected: Number(r.preference) === Number(k) }, t)))),
    message);
  form.addEventListener('change', () => {
    enregistrerReglagesService(Object.fromEntries(new FormData(form)));
    message.textContent = 'Enregistré.';
  });
  el.append(h('section', { class: 'carte' }, h('h2', {}, 'Service et aération'), form));
}

export default {
  id: 'ce-soir',
  titre: 'Ce soir (apogée, aération)',
  flag: { defaut: true, experimental: false },
  ecrans: [
    { route: '/ce-soir', titre: 'Ce soir', icone: ICONES.verre, place: 'nav', ordre: 10, rendu: ecran },
    { route: '/servir/:id', titre: 'Servir', onglet: '/ce-soir', rendu: ecranServir }
  ],
  reglages,
  tables: ['produits', 'bouteilles']
};
