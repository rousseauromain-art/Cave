// Labo Bluetooth du casier Montrouge : explorer le GATT, journaliser et décoder le flux, composer et envoyer
// des trames, dérouler des tests guidés (état des rangées, rejeu, hypothèses LED, balayage des types).
import { remplacer } from '../../core/ui/dom.js';
import { creerDecodeur, lireTrame, encoderTrame, TYPES_CONNUS, hexa, lireHexa, detailTrame } from './protocole.js';

const SERVICE = '569a1101-b87f-490c-92cb-11ba5ea5167c';
const NOMS = ['CAVEASY', 'Caveasy', 'caveasy', 'CavEasy', 'Montrouge'];
const CLE_JOURNAL = 'labo-montrouge-journal';
const MAX = 2000;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const heure = () => new Date().toLocaleTimeString('fr-FR', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0');
const nomType = (t) => TYPES_CONNUS[t] || 'inconnu';
const court = (uuid) => uuid.slice(4, 8);

function chargerJournal() {
  try { return JSON.parse(localStorage.getItem(CLE_JOURNAL)) || []; } catch { return []; }
}
function sauverJournal(l) {
  try { localStorage.setItem(CLE_JOURNAL, JSON.stringify(l.slice(-MAX))); } catch { /* stockage indisponible : journal en mémoire */ }
}

// Session : survit à la navigation (la connexion BLE aussi).
const session = { appareil: null, caracs: [], dernierEnvoi: null, derniereRecue: null, compteurs: new Map(), arret: false, test: null };

export async function ecranLabo(core, el) {
  const { h } = core;
  let lignes = chargerJournal();
  const journal = h('ol', { class: 'journal labo-journal', 'aria-live': 'polite' });
  const statut = h('p', { class: 'message-ble', role: 'status' });
  const listeCaracs = h('div', { class: 'labo-caracs' });
  const tableau = h('div', { class: 'labo-tableau' });
  const zoneTest = h('div', { class: 'labo-test' });

  function noter(type, texte) {
    lignes.push(`${heure()}  ${type.padEnd(6)} ${texte}`);
    if (lignes.length > MAX) lignes = lignes.slice(-MAX);
    sauverJournal(lignes);
    dessinerJournal();
  }
  function dessinerJournal() {
    remplacer(journal, ...lignes.slice(-200).reverse().map((l) => h('li', { class: /ÉCRIT|NOTE/.test(l.slice(14, 20)) ? 'marque' : '' }, l)));
  }
  function dessinerTableau() {
    const l = [...session.compteurs.values()].sort((a, b) => a.adresse - b.adresse || a.type - b.type);
    remplacer(tableau, l.length ? h('table', {},
      h('thead', {}, h('tr', {}, ['Adr.', 'Type', 'Nom', 'Nb', 'Dernières données'].map((t) => h('th', {}, t)))),
      h('tbody', {}, l.map((x) => h('tr', {}, h('td', {}, String(x.adresse)), h('td', {}, `0x${x.type.toString(16).padStart(2, '0')}`), h('td', {}, nomType(x.type)),
        h('td', {}, String(x.n)), h('td', { class: 'mono' }, hexa(x.donnees) || '—')))))
      : h('p', { class: 'discret' }, 'Aucune trame reçue pour l’instant.'));
  }

  // Trames décodées : journal, compteurs par (adresse, type), corrélation avec le dernier envoi (< 1,5 s).
  const decoder = creerDecodeur((f) => {
    const t = lireTrame(f);
    if (!t.valide) { noter('INVAL', hexa(f)); return; }
    session.derniereRecue = t;
    const cle = `${t.adresse}-${t.type}`;
    const c = session.compteurs.get(cle) || { adresse: t.adresse, type: t.type, n: 0, donnees: [] };
    c.n++; c.donnees = t.donnees;
    session.compteurs.set(cle, c);
    const suite = session.dernierEnvoi && Date.now() - session.dernierEnvoi.quand < 1500 ? `  ↩ ${Date.now() - session.dernierEnvoi.quand} ms après ${session.dernierEnvoi.texte}` : '';
    const detail = detailTrame(t);
    noter('TRAME', `adr ${t.adresse} · type 0x${t.type.toString(16).padStart(2, '0')} (${nomType(t.type)}) · ${hexa(t.donnees) || '—'}${detail ? `\n${' '.repeat(21)}→ ${detail}` : ''}${suite}`);
    dessinerTableau();
  });

  async function connecter(tous) {
    if (!(navigator.bluetooth && isSecureContext)) { statut.textContent = 'Bluetooth indisponible : Chrome sur Android, site en HTTPS.'; return; }
    try {
      statut.textContent = 'Recherche du casier…';
      const optionalServices = [SERVICE, 0x180a, 0x180f];
      session.appareil = await navigator.bluetooth.requestDevice(tous ? { acceptAllDevices: true, optionalServices }
        : { filters: [...NOMS.map((n) => ({ namePrefix: n })), { services: [SERVICE] }], optionalServices });
      session.appareil.addEventListener('gattserverdisconnected', () => { noter('INFO', '— déconnecté'); statut.textContent = 'Déconnecté.'; dessinerCaracs(); });
      const serveur = await session.appareil.gatt.connect();
      noter('INFO', `— connecté à ${session.appareil.name || '?'}`);
      session.caracs = [];
      for (const s of await serveur.getPrimaryServices()) {
        try { for (const c of await s.getCharacteristics()) session.caracs.push(c); } catch { /* service fermé */ }
      }
      for (const c of session.caracs) {
        const p = c.properties;
        noter('GATT', `${c.uuid} : ${['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => p[k]).join(', ')}`);
        if (p.read) try { const v = await c.readValue(); noter('LU', `${court(c.uuid)} : ${hexa(new Uint8Array(v.buffer))}`); } catch { noter('LU', `${court(c.uuid)} : lecture refusée`); }
        if (p.notify || p.indicate) {
          c.addEventListener('characteristicvaluechanged', (e) => {
            const o = new Uint8Array(e.target.value.buffer, e.target.value.byteOffset, e.target.value.byteLength);
            noter('NOTIF', `${court(c.uuid)} : ${hexa(o)}`);
            decoder(o);
          });
          try { await c.startNotifications(); } catch (e) { noter('INFO', `abonnement ${court(c.uuid)} refusé : ${e.message}`); }
        }
      }
      statut.textContent = `Connecté : ${session.caracs.length} caractéristique(s), dont ${ecrivables().length} en écriture.`;
      dessinerCaracs();
    } catch (e) {
      statut.textContent = `Connexion impossible : ${e.message}`;
    }
  }

  const ecrivables = () => session.caracs.filter((c) => c.properties.write || c.properties.writeWithoutResponse);
  const choixCarac = h('select', { 'aria-label': 'Caractéristique d’écriture' });
  function dessinerCaracs() {
    const ok = session.appareil?.gatt.connected;
    remplacer(listeCaracs, ok ? h('ul', { class: 'liste-simple mono' }, session.caracs.map((c) => h('li', {}, `${c.uuid} · ${['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => c.properties[k]).join(', ')}`))) : null);
    remplacer(choixCarac, ...ecrivables().map((c) => h('option', { value: c.uuid }, `${court(c.uuid)} (${c.properties.write ? 'avec réponse' : 'sans réponse'})`)));
  }

  // Une seule opération GATT à la fois (sinon « GATT operation already in progress »).
  let file = Promise.resolve();
  const envoyer = (octets, texte, uuid = null) => (file = file.then(() => ecrire(octets, texte, uuid), () => ecrire(octets, texte, uuid)));
  async function ecrire(octets, texte, uuid) {
    const c = ecrivables().find((x) => x.uuid === (uuid || choixCarac.value)) || ecrivables()[0];
    if (!c || !session.appareil?.gatt.connected) { statut.textContent = 'Connectez d’abord le casier (aucune caractéristique en écriture).'; return false; }
    const v = Uint8Array.from(octets);
    try {
      if (c.properties.write && !sansReponse.checked) await c.writeValueWithResponse(v); else await c.writeValueWithoutResponse(v);
      session.dernierEnvoi = { quand: Date.now(), texte };
      noter('ÉCRIT', `${court(c.uuid)} : ${hexa(v)}  [${texte}]`);
      return true;
    } catch (e) {
      noter('ERREUR', `écriture ${court(c.uuid)} : ${e.message}`);
      return false;
    }
  }
  const envoyerTrame = (adresse, type, donnees, uuid) => envoyer(encoderTrame(adresse, type, donnees), `adr ${adresse} type 0x${type.toString(16).padStart(2, '0')} ${hexa(donnees)}`.trim(), uuid);

  // Composeur : trame du protocole (somme et échappement calculés) ou octets bruts.
  const mode = h('select', { 'aria-label': 'Mode d’envoi' }, h('option', { value: 'trame' }, 'Trame du protocole'), h('option', { value: 'brut' }, 'Octets bruts'));
  const adresse = h('input', { type: 'number', min: '0', max: '255', value: '1', inputmode: 'numeric', 'aria-label': 'Adresse (rangée)' });
  const type = h('input', { value: '00', 'aria-label': 'Type (hexa)', class: 'mono' });
  const donnees = h('input', { value: '', placeholder: 'ex. 01 00', 'aria-label': 'Données (hexa)', class: 'mono' });
  const sansReponse = h('input', { type: 'checkbox', 'aria-label': 'Écrire sans réponse' });
  const apercu = h('code', { class: 'mono apercu-trame' });
  const octetsCompose = () => (mode.value === 'brut' ? lireHexa(donnees.value) : encoderTrame(Number(adresse.value) || 0, lireHexa(type.value)[0] ?? 0, lireHexa(donnees.value)));
  const majApercu = () => { apercu.textContent = hexa(octetsCompose()) || '—'; adresse.disabled = type.disabled = mode.value === 'brut'; };
  for (const e of [mode, adresse, type, donnees]) e.addEventListener('input', majApercu);
  majApercu();

  // Tests guidés.
  async function derouler(titre, etapes, { pause = 1200, reaction = false, partout = false } = {}) {
    if (session.test) { statut.textContent = `Un test est déjà en cours (« ${session.test} ») : arrêtez-le d'abord.`; return; }
    session.test = titre;
    session.arret = false;
    boutonsTests.forEach((b) => { b.disabled = true; });
    noter('NOTE', `### Test « ${titre} » (${etapes.length} envois)`);
    for (let i = 0; i < etapes.length && !session.arret; i++) {
      const [a, t, d] = etapes[i];
      remplacer(zoneTest, h('p', {}, `${titre} : ${i + 1}/${etapes.length} — adr ${a}, type 0x${t.toString(16).padStart(2, '0')}, ${hexa(d) || 'sans données'}`),
        h('div', { class: 'boutons' },
          reaction ? h('button', { type: 'button', class: 'bouton principal', onclick: () => noter('NOTE', `### RÉACTION observée sur ${session.dernierEnvoi?.texte}`) }, 'Ça a réagi !') : null,
          h('button', { type: 'button', class: 'bouton', onclick: () => { session.arret = true; } }, 'Arrêter')));
      // « partout » : la même trame sur chaque caractéristique d'écriture (2001, 2003…).
      const cibles = partout ? ecrivables().map((c) => c.uuid) : [null];
      let ok = true;
      for (const u of cibles) { ok = (await envoyerTrame(a, t, d, u)) && ok; await attendre(partout ? pause : 0); }
      if (!ok && !partout) break;
      if (!partout) await attendre(pause);
    }
    session.test = null;
    boutonsTests.forEach((b) => { b.disabled = false; });
    noter('NOTE', `### Fin du test « ${titre} »${session.arret ? ' (arrêté)' : ''}`);
    remplacer(zoneTest, h('p', { class: 'discret' }, `Test « ${titre} » terminé. Les réponses sont marquées ↩ dans le journal.`));
  }
  const rangeeTest = h('input', { type: 'number', min: '1', max: '8', value: '1', inputmode: 'numeric', 'aria-label': 'Rangée testée' });
  const placeTest = h('input', { type: 'number', min: '1', max: '8', value: '1', inputmode: 'numeric', 'aria-label': 'Emplacement testé' });
  const r = () => Math.max(1, Math.min(8, Number(rangeeTest.value) || 1));
  const bit = () => 1 << (Math.max(1, Math.min(8, Number(placeTest.value) || 1)) - 1);
  const TESTS = [
    { titre: 'Chaque voie d’écriture', aide: 'Rejoue la dernière trame reçue puis une demande d’état, sur CHAQUE caractéristique d’écriture (2001 puis 2003…). Si le casier relaie, la trame réapparaît dans le flux.', partout: true, pause: 1500,
      etapes: () => [...(session.derniereRecue ? [[session.derniereRecue.adresse, session.derniereRecue.type, session.derniereRecue.donnees]] : []), [r(), 0x00, []], [r(), 0x00, [0x3b]]] },
    { titre: 'État des rangées', aide: 'Type 0x00 vers les rangées 1 à 8, comme le ferait la passerelle. Sans risque : simple demande.', etapes: () => [1, 2, 3, 4, 5, 6, 7, 8].map((a) => [a, 0x00, []]) },
    { titre: 'Rejouer la dernière trame reçue', aide: 'Renvoie telle quelle la dernière trame valide reçue (voir si le casier l’accepte en entrée).', etapes: () => (session.derniereRecue ? [[session.derniereRecue.adresse, session.derniereRecue.type, session.derniereRecue.donnees]] : []) },
    { titre: 'Hypothèses LED', aide: 'Types 0x41 à 0x4F (voisins de 0x45) avec le masque de l’emplacement choisi, 2 s entre chaque. Regardez la clayette et touchez « Ça a réagi ! ».', reaction: true, pause: 2000,
      etapes: () => Array.from({ length: 15 }, (_, i) => 0x41 + i).filter((t) => t !== 0x45).flatMap((t) => [[r(), t, [bit()]], [r(), t, [bit(), bit()]]]) },
    { titre: 'Balayage des types', aide: 'Types 0x00 à 0x3F sans données vers la rangée choisie, pour repérer ceux qui répondent (↩). À lancer après les tests ci-dessus.', pause: 700,
      etapes: () => Array.from({ length: 64 }, (_, t) => [r(), t, []]) }
  ];

  const boutonsTests = [];
  const note = h('input', { placeholder: 'ex. je pose une bouteille en R3-E2', 'aria-label': 'Note pour le journal' });
  const exporter = () => {
    const url = URL.createObjectURL(new Blob([lignes.join('\n')], { type: 'text/plain' }));
    const a = h('a', { href: url, download: `montrouge-journal-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  let viderConfirme = false;

  el.append(
    h('section', { class: 'carte' },
      h('h2', {}, 'Labo Bluetooth du casier'),
      h('p', { class: 'discret' }, 'Pour découvrir les commandes inconnues (LED de la clayette…). Tout ce qui passe est journalisé ; exportez le journal pour l’analyser.'),
      h('div', { class: 'boutons' },
        h('button', { type: 'button', class: 'bouton principal', onclick: () => connecter(false) }, 'Connecter le casier'),
        h('button', { type: 'button', class: 'bouton', onclick: () => connecter(true) }, 'Tous les appareils'),
        h('button', { type: 'button', class: 'bouton', onclick: () => session.appareil?.gatt.connected && session.appareil.gatt.disconnect() }, 'Déconnecter')),
      statut, listeCaracs),
    h('section', { class: 'carte' },
      h('h2', {}, 'Tests guidés'),
      h('p', { class: 'avertissement' }, 'Écrire des trames inconnues peut modifier le comportement du casier. Commencez par « État des rangées » et « Rejouer », une rangée vide de préférence.'),
      h('div', { class: 'ligne-champs' }, h('label', {}, 'Rangée ', rangeeTest), h('label', {}, 'Emplacement ', placeTest)),
      h('ul', { class: 'liste-tests' }, TESTS.map((t, i) => h('li', {},
        boutonsTests[i] = h('button', { type: 'button', class: 'bouton', onclick: () => derouler(t.titre, t.etapes(), t) }, t.titre),
        h('span', { class: 'discret' }, t.aide)))),
      zoneTest),
    h('section', { class: 'carte' },
      h('h2', {}, 'Composer une trame'),
      h('div', { class: 'ligne-champs' }, mode, h('label', {}, 'Adr. ', adresse), h('label', {}, 'Type ', type)),
      h('label', { class: 'champ' }, h('span', { class: 'libelle' }, 'Données (hexa)'), donnees),
      h('p', {}, 'Envoyé : ', apercu),
      h('div', { class: 'ligne-champs' }, choixCarac, h('label', {}, sansReponse, ' sans réponse')),
      h('button', { type: 'button', class: 'bouton principal', onclick: () => envoyer(octetsCompose(), mode.value === 'brut' ? 'brut' : `adr ${adresse.value} type 0x${type.value} ${donnees.value}`.trim()) }, 'Envoyer')),
    h('section', { class: 'carte' }, h('h2', {}, 'Trames reçues'), tableau),
    h('section', { class: 'carte' },
      h('h2', {}, 'Journal'),
      h('div', { class: 'ligne-lien' }, note, h('button', { type: 'button', class: 'bouton', onclick: () => { if (note.value.trim()) { noter('NOTE', `### ${note.value.trim()}`); note.value = ''; } } }, 'Noter')),
      h('div', { class: 'boutons' },
        h('button', { type: 'button', class: 'bouton', onclick: exporter }, 'Exporter (.txt)'),
        h('button', {
          type: 'button', class: 'bouton', onclick: (e) => {
            if (!viderConfirme) { viderConfirme = true; e.currentTarget.textContent = 'Confirmer : vider ?'; return; }
            lignes = []; sauverJournal(lignes); dessinerJournal(); viderConfirme = false; e.currentTarget.textContent = 'Vider';
          }
        }, 'Vider')),
      journal)
  );
  dessinerJournal();
  dessinerTableau();
  dessinerCaracs();
}
