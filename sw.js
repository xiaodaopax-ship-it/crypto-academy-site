// Offline support: serve from cache, refresh cache in the background (stale-while-revalidate).
const CACHE = 'crypto-academy-v1';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.json', './icon.svg',
  './icon-180.png', './icon-192.png', './icon-512.png',
  './js/lessons-1.js', './js/lessons-2.js', './js/lessons-easy.js', './js/glossary.js',
  './js/calc.js', './js/questions.js', './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const fresh = fetch(e.request)
          .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
          .catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
