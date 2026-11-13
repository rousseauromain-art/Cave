// Service worker : l'app s'ouvre hors ligne. Réseau d'abord (mises à jour immédiates), cache en secours.
const VERSION = '0.10.0'; // aligné sur core/version.js (vérifié par les tests)
const CACHE = `cave-${VERSION}`;
const COQUILLE = [
  './', './index.html', './manifest.webmanifest',
  './themes/tokens.css', './themes/vin.css', './themes/spiritueux.css', './themes/composants.css',
  './core/app.js', './core/registry.js', './core/router.js', './core/flags.js', './core/theme.js',
  './core/kv.js', './core/evenements.js', './core/version.js', './core/config.js',
  './core/schema.js', './core/fusion.js', './core/store.js', './core/sync.js', './core/supabase.js', './core/sauvegarde.js',
  './core/inventaire.js', './core/photos.js', './core/import-v9.js', './core/cles.js', './core/import-whisky.js', './core/import-photos.js', './core/identification.js', './data/apogee.json',
  './core/ui/dom.js', './core/ui/icones.js', './core/ui/a-venir.js', './core/ui/badges.js', './core/ui/radar.js', './core/ui/toast.js', './core/ui/profils.js', './core/ui/etagere.js', './core/rangements.js', './core/ui/courbe.js', './core/apogee.js',
  './data/styles.js', './data/drapeaux.js', './data/filtres.js', './data/pays.js',
  './modules/ce-soir/module.js', './modules/cave/module.js',
  './modules/cave/liste.js', './modules/cave/tuile.js', './modules/cave/fiche.js', './modules/cave/formulaire.js', './modules/cave/stock.js', './modules/scanner/module.js',
  './modules/degustations/module.js', './modules/degustations/calcul.js', './modules/degustations/ble.js', './modules/degustations/donnees.js', './modules/myoeno-spiritueux/module.js', './modules/rangements/module.js', './modules/aide/module.js', './modules/diagnostic/module.js',
  './modules/montrouge/module.js', './modules/montrouge/ble.js', './modules/montrouge/protocole.js',
  './icons/icone.svg', './icons/icone-192.png', './icons/icone-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((k) => k.startsWith('cave-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const memeOrigine = new URL(req.url).origin === location.origin;
  // Polices et bibliothèque Supabase mises en cache pour démarrer hors ligne ; l'API Supabase n'est jamais mise en cache.
  const externe = /(^fonts\.(googleapis|gstatic)\.com|^cdn\.jsdelivr\.net)$/.test(new URL(req.url).hostname);
  if (!memeOrigine && !externe) return;
  e.respondWith(
    fetch(req).then((rep) => {
      if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
      return rep;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
