/* ==========================================================================
   MHMRWS Portal — minimal service worker
   Network-first for the app shell: always tries to fetch the latest file
   first, and only falls back to the cached copy if the network request
   fails (offline / flaky connection). This matters because this app is
   actively being updated — a cache-first strategy would keep showing
   residents an old version even after you deploy fixes.
   Bump CACHE_NAME on any future structural change to force a clean cache.
   ========================================================================== */

const CACHE_NAME = 'mhmrws-shell-v3';
const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './firebase-config.js',
  './app-common.js',
  './manifest.json',
  './logo-data.js',
  './i18n.js',
  './icon-192.png',
  './favicon-32.png'
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
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // offline fallback only
  );
});
