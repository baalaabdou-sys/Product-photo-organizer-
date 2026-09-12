/**
 * Offline support for the Abderrahmane Family Tree.
 *
 * The app shell is precached so the archive opens with no network at all.
 * Family data never travels through here — it lives in IndexedDB on the
 * device, which is what makes the app genuinely offline-first rather than
 * merely cache-assisted.
 */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // A single missing file must not fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: network first so a deployed update is picked up, falling
  // back to the cached shell the moment the network is unavailable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(SHELL).then((c) => c.put('./index.html', copy));
          return response;
        })
        .catch(async () =>
          (await caches.match('./index.html'))
          ?? (await caches.match('./'))
          ?? Response.error()),
    );
    return;
  }

  // Build assets are content-hashed, so cache-first is always correct.
  if (sameOrigin && /\/assets\/.+\.(js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }

  // Fonts and other cross-origin GETs: serve from cache, refresh in the
  // background, and never let a failure surface as a broken page.
  if (!sameOrigin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit ?? fetch(request).catch(() => Response.error())),
  );
});

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      void cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit ?? (await network) ?? Response.error();
}

// The page asks for the new version to take over after an update.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});
