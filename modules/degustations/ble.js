// Connexion Bluetooth au scanner MyOeno (repris de la v9.3 fonctionnelle) :
// pas de lecture initiale, abonnement aux notifications en 4 essais, sinon lecture toutes les 0,8 s.
import { lireTrame } from './calcul.js';

const SVC_SCAN = 'f92158cd-26d2-4afc-8746-44bc9d7cc527';
const CH_SCAN = 'e5042891-e937-48c5-8471-c8322ab7e81f';
const SVC_BAT = 0x180f, CH_BAT = 0x2a19;
const NOMS = ['MyOeno', 'MYOENO', 'myoeno', 'Myoeno', 'MyOneo', 'Oeno', 'OENO', 'oeno', 'Scanner'];

const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const hex = (dv) => [...new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)].map((b) => b.toString(16).padStart(2, '0')).join(' ');

export function bluetoothDisponible() {
  return !!(typeof navigator !== 'undefined' && navigator.bluetooth && isSecureContext);
}

export function creerScanner({ surEtat = () => {}, surMesure = () => {}, surBatterie = () => {}, surStatut = () => {}, journal = () => {} } = {}) {
  let appareil = null, minuterie = null;

  async function connecter(tous = false) {
    if (!bluetoothDisponible()) throw new Error('Bluetooth indisponible : utilisez Chrome sur Android (site en HTTPS).');
    surStatut('recherche');
    appareil = await navigator.bluetooth.requestDevice(tous
      ? { acceptAllDevices: true, optionalServices: [SVC_BAT, SVC_SCAN] }
      : { filters: [...NOMS.map((n) => ({ namePrefix: n })), { services: [SVC_SCAN] }], optionalServices: [SVC_BAT, SVC_SCAN] });
    journal(`appareil « ${appareil.name || 'sans nom'} »`);
    appareil.addEventListener('gattserverdisconnected', () => { clearInterval(minuterie); surStatut('deconnecte'); });
    surStatut('connexion');
    const serveur = await appareil.gatt.connect();
    try {
      const bc = await (await serveur.getPrimaryService(SVC_BAT)).getCharacteristic(CH_BAT);
      surBatterie((await bc.readValue()).getUint8(0));
    } catch (e) { journal(`batterie illisible : ${e.message}`); }
    const ch = await (await serveur.getPrimaryService(SVC_SCAN)).getCharacteristic(CH_SCAN);
    const recevoir = (dv) => {
      journal(`trame ${hex(dv)}`);
      const t = lireTrame(dv);
      if (!t) return;
      if (t.brut) surMesure(t);
      else surEtat(t.etat);
    };
    ch.addEventListener('characteristicvaluechanged', (e) => recevoir(e.target.value));
    let abonne = false;
    for (let i = 1; i <= 4 && !abonne; i++) {
      await pause(400 * i);
      try { await ch.startNotifications(); abonne = true; } catch (e) { journal(`abonnement refusé (essai ${i}/4) : ${e.message}`); }
    }
    clearInterval(minuterie);
    if (!abonne) {
      journal('notifications indisponibles : lecture périodique');
      let dernier = '';
      minuterie = setInterval(async () => {
        if (!appareil?.gatt.connected) return clearInterval(minuterie);
        try { const v = await ch.readValue(), x = hex(v); if (x !== dernier) { dernier = x; recevoir(v); } } catch { /* trame suivante */ }
      }, 800);
    }
    surStatut('connecte');
  }

  return {
    connecter,
    deconnecter() { clearInterval(minuterie); if (appareil?.gatt.connected) appareil.gatt.disconnect(); },
    connecte: () => !!appareil?.gatt.connected
  };
}
