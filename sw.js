/* The HuD Group service worker.
 * Pages: network first, falling back to the last saved copy when offline or very slow.
 * Images and web fonts: served from the saved copy at once, refreshed in the background.
 * Form submissions (POST to Google Apps Script) are never touched.
 * Bump VERSION to force every visitor onto fresh copies. */
const VERSION = 'hud-v1';
const SHELL = ['/apply', '/manifest.webmanifest', '/images/the-hud-group-logo.png', '/images/the-hud-group-logo-dark.png', '/images/icons/icon-192.png'];
const FONT_HOSTS = ['api.fontshare.com', 'cdn.fontshare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function usable(res) { return res && (res.ok || res.type === 'opaque'); }

function networkFirst(request, isPage) {
  return caches.open(VERSION).then((cache) =>
    cache.match(request, { ignoreSearch: isPage }).then((cached) => {
      const fresh = fetch(request).then((res) => {
        if (usable(res)) { cache.put(request, res.clone()); }
        return res;
      });
      if (!cached) {
        const fallback = new URL(request.url).pathname.indexOf('/portal') === 0 ? '/portal' : '/apply';
        return fresh.catch(() => (isPage ? cache.match(fallback) : undefined)).then((res) =>
          res || new Response('You are offline. Please reconnect and try again.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
      }
      // A saved copy exists: give the network 4 seconds, then fall back to it.
      const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), 4000));
      return Promise.race([fresh.catch(() => cached), timeout]);
    })
  );
}

function staleWhileRevalidate(event) {
  return caches.open(VERSION).then((cache) =>
    cache.match(event.request).then((cached) => {
      const fresh = fetch(event.request).then((res) => {
        if (usable(res)) { cache.put(event.request, res.clone()); }
        return res;
      });
      if (cached) { event.waitUntil(fresh.catch(() => null)); return cached; }
      return fresh;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') { return; }
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.indexOf(url.hostname) !== -1;
  if (!sameOrigin && !isFont) { return; }
  if (sameOrigin && (url.pathname.indexOf('/reports/') === 0 || url.pathname === '/sw.js')) { return; }
  if (request.headers.has('range')) { return; }

  if (request.mode === 'navigate') { event.respondWith(networkFirst(request, true)); return; }
  if (isFont || request.destination === 'image' || request.destination === 'font') { event.respondWith(staleWhileRevalidate(event)); return; }
  event.respondWith(networkFirst(request, false));
});
