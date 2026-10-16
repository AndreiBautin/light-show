// Offline support for the installed app. Hand-written rather than generated:
// there is nothing to precache but the shell, and a precache manifest is the
// usual way a worker bricks itself (see docs/ARCHITECTURE.md).
//
// Updates apply on their own (skipWaiting + claim). A screensaver loses nothing
// if the next load runs new code, so there is no "update available" prompt.

const CACHE = 'light-show-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // The page: always try for the newest, fall back to the cached shell offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable(response)) event.waitUntil(storeShell(response.clone()));
          return response;
        })
        .catch(() => caches.match('./').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Assets are content-hashed, so a cached copy is always the right one.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (cacheable(response)) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});

/** Only complete, same-origin successes: never an error page, a redirect or an opaque body. */
function cacheable(response) {
  return response.ok && response.status === 200 && response.type === 'basic';
}

/**
 * Cache the new page, then drop hashed assets it no longer references, so
 * every deploy does not leave the previous build's bundle behind forever.
 */
async function storeShell(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  await cache.put('./', response);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    const file = path.slice(path.lastIndexOf('/') + 1);
    if (path.includes('/assets/') && !html.includes(file)) await cache.delete(req);
  }
}
