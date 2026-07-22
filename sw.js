/* ==========================================================================
   MHMRWS Portal — minimal service worker
   Caches the static app shell so the portal still opens (read-only) with a
   flaky connection. Never touches Firebase/Google API calls — those always
   go straight to the network, since cached data would be stale/wrong.
   ========================================================================== */

const CACHE_NAME = 'mhmrws-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './firebase-config.js',
  './app-common.js',
  './manifest.json',
  './assets/logo-mark.png',
  './assets/icon-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for the app shell.
  // Firebase, Google APIs, and CDN scripts always go straight to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline fallback
      return cached || network;
    })
  );
});
