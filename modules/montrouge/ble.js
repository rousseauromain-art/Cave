// Connexion au casier Montrouge : abonnement à toutes les caractéristiques « notify » du service, flux décodé.
import { creerDecodeur, lireTrame } from './protocole.js';

const SERVICE = '569a1101-b87f-490c-92cb-11ba5ea5167c';
const NOMS = ['CAVEASY', 'Caveasy', 'caveasy', 'CavEasy', 'Montrouge'];

export function creerCasier({ surRangee = () => {}, surStatut = () => {}, journal = () => {} } = {}) {
  let appareil = null;
  const stats = { valides: 0, invalides: 0 };
  const decoder = creerDecodeur((f) => {
    const t = lireTrame(f);
    if (!t.valide) { stats.invalides++; journal(`trame invalide ${f.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`); return; }
    stats.valides++;
    if (t.type === 0x45 && t.donnees.length >= 1) surRangee(t.adresse, t.donnees[0]);
  });

  return {
    stats,
    connecte: () => !!appareil?.gatt.connected,
    async connecter(tous = false) {
      if (!(navigator.bluetooth && isSecureContext)) throw new Error('Bluetooth indisponible : utilisez Chrome sur Android (site en HTTPS).');
      surStatut('recherche');
      appareil = await navigator.bluetooth.requestDevice(tous
        ? { acceptAllDevices: true, optionalServices: [SERVICE] }
        : { filters: [...NOMS.map((n) => ({ namePrefix: n })), { services: [SERVICE] }], optionalServices: [SERVICE] });
      appareil.addEventListener('gattserverdisconnected', () => surStatut('deconnecte'));
      surStatut('connexion');
      const serveur = await appareil.gatt.connect();
      const service = await serveur.getPrimaryService(SERVICE);
      let abonnements = 0;
      for (const c of await service.getCharacteristics()) {
        if (!(c.properties.notify || c.properties.indicate)) continue;
        c.addEventListener('characteristicvaluechanged', (e) => decoder(new Uint8Array(e.target.value.buffer, e.target.value.byteOffset, e.target.value.byteLength)));
        try { await c.startNotifications(); abonnements++; } catch (e) { journal(`abonnement refusé : ${e.message}`); }
      }
      if (!abonnements) throw new Error('le casier n’envoie aucune donnée (abonnement refusé)');
      surStatut('connecte');
      return appareil.name || 'Casier';
    },
    deconnecter() { if (appareil?.gatt.connected) appareil.gatt.disconnect(); }
  };
}
