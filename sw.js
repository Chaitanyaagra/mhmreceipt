/* ==========================================================================
   MHMRWS Portal — minimal service worker
   Network-first for the app shell: always tries to fetch the latest file
   first, and only falls back to the cached copy if the network request
   fails (offline / flaky connection). This matters because this app is
   actively being updated — a cache-first strategy would keep showing
   residents an old version even after you deploy fixes.
   Bump CACHE_NAME on any future structural change to force a clean cache.
   ========================================================================== */

const CACHE_NAME = 'mhmrws-shell-v5';
const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './firebase-config.js',
  './app-common.js',
  './manifest.json',
  './logo-data.js',
  './i18n.js',
  './tower-plan.js',
  './icon-192.png',
  './favicon-32.png'
];

self.addEventListener('install', (event) => {
  // cache.addAll() is all-or-nothing: one 404 anywhere in SHELL_FILES and the
  // whole install rejects, leaving the app with no offline fallback at all and
  // nothing in the console to say why. Cache each file on its own instead, so
  // a single missing asset costs exactly that one asset.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        SHELL_FILES.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] could not cache', url, err))
        )
      ))
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

  // --------------------------------------------------------------------
  // Two strategies, chosen per file type.
  //
  // IMAGES -> cache-first. They are ~59% of the page weight and their
  // contents never change (a new photo means a new filename), so serving
  // them straight from cache is both instant and always correct.
  //
  // EVERYTHING ELSE (html, css, js) -> network-first with cache fallback.
  // A cache-first strategy here would be faster on repeat visits, but it
  // also means a freshly deployed fix does not reach residents until their
  // second visit. For a portal that is still being changed regularly, an
  // update that silently fails to appear is far more costly than a few
  // hundred milliseconds, so correctness wins. Offline still works: the
  // cached copy is served whenever the network request fails.
  // --------------------------------------------------------------------
  const isImage = /\.(webp|jpg|jpeg|png|gif|svg|ico)$/i.test(url.pathname);

  if (isImage) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

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
