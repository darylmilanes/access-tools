const CACHE = 'miniapps-shell-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './pwa.js',
  './manifest.webmanifest'
];

// Install: pre-cache shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: HTML = network-first with offline fallback; assets = cache-first
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigation requests (HTML)
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match('./index.html');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Static assets: cache-first; allow caching Google Fonts if present
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const sameOrigin = url.origin === location.origin;
      const isFont = /fonts.(googleapis|gstatic).com/.test(url.host);
      if (sameOrigin || isFont) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return cached; // last resort
    }
  })());
});
