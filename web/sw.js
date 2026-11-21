/* Permet d'ouvrir le calendrier sans connexion internet.
   Avec internet, la dernière version publiée est toujours chargée (mises à jour automatiques). */
const CACHE = 'calendrier-arrose';
const FICHIERS = ['./', 'index.html', 'manifest.webmanifest', 'icones/icone-192.png', 'icones/icone-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // Google : jamais en cache
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((rep) => { if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); } return rep; })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
