// Offline support: serve from cache immediately, refresh the cache in the background.
const CACHE = 'forehead-v1';
const FILES = ['/', '/style.css', '/app.js', '/game.js', '/decks.json', '/manifest.webmanifest', '/icon-180.png', '/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const fresh = fetch(e.request).then(async res => {
    if (res.ok) await (await caches.open(CACHE)).put(e.request, res.clone());
    return res;
  });
  e.waitUntil(fresh.catch(() => {}));
  e.respondWith(caches.match(e.request).then(hit => hit || fresh));
});
