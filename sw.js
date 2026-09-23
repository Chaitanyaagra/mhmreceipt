/* ==========================================================================
   MHMRWS Portal — minimal service worker
   Network-first for the app shell: always tries to fetch the latest file
   first, and only falls back to the cached copy if the network request
   fails (offline / flaky connection). This matters because this app is
   actively being updated — a cache-first strategy would keep showing
   residents an old version even after you deploy fixes.
   Bump CACHE_NAME on any future structural change to force a clean cache.
   ========================================================================== */

const CACHE_NAME = 'mhmrws-shell-v72';
const SHELL_FILES = [
  './',
  './index.html',
  './admin.html',
  './guard.html',
  './staff.html',
  './styles.css',
  './firebase-config.js',
  './app-common.js',
  './avatar-placeholder.js',
  './jspdf.umd.min.js',
  './qrcode.local.js',
  './premium.js',
  './chart.umd.min.js',
  './jszip.min.js',
  './xlsx.full.min.js',
  './ui-a11y.js',
  './install-prompt.js',
  './back-button-handler.js',
  './update-banner.js',
  './manifest.json',
  './manifest-admin.json',
  './manifest-guard.json',
  './manifest-staff.json',
  './logo-data.js',
  './logo.webp',
  './i18n.js',
  './tower-plan.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
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
  // Three strategies, chosen per file type, tuned for speed on weak mobile
  // networks (the old "network-first for everything" made every file wait
  // on the network on every single visit, which felt very slow).
  //
  // 1) IMAGES and VENDORED LIBRARIES (jspdf, xlsx, chart, jszip, qrcode)
  //    -> cache-first. Their contents never change for a given filename
  //    (a new photo = new name; a library is a fixed file), so serving
  //    straight from cache is instant and always correct. These libraries
  //    are ~1.6 MB together — not re-fetching them on every visit is the
  //    single biggest speed win.
  //
  // 2) APP CODE + MARKUP (html, css, our own .js) -> stale-while-revalidate.
  //    Serve the cached copy immediately (fast), AND fetch a fresh copy in
  //    the background to update the cache for next time. Residents get an
  //    instant load; a deployed fix reaches them on their very next visit
  //    (one visit later than network-first, but without the per-visit wait).
  //
  // 3) Anything else falls through to the same stale-while-revalidate.
  // --------------------------------------------------------------------
  const isImage = /\.(webp|jpg|jpeg|png|gif|svg|ico)$/i.test(url.pathname);
  const isVendorLib = /\.(min|umd\.min)\.js$/i.test(url.pathname) || /qrcode\.local\.js$/i.test(url.pathname);

  if (isImage || isVendorLib) {
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

  // Stale-while-revalidate: return cache now (if present), refresh in bg.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline: fall back to whatever we had
      // If we have a cached copy, serve it instantly and let the network
      // update happen in the background; otherwise wait for the network.
      return cached || networkFetch;
    })
  );
});
