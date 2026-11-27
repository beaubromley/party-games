// Offline support: serve from cache immediately, refresh the cache in the background.
const CACHE = 'party-v25';
const FILES = ['/', '/forehead.html', '/draw.html', '/watch.html', '/watch.js', '/cast.js', '/play.html', '/style.css', '/app.js', '/game.js', '/draw.js', '/play.js', '/ui.js', '/canvas.js', '/words.js', '/teams.js', '/topics.js', '/face.js', '/party-ui.js', '/sound.js', '/wake.js', '/textsize.js', '/pull.js', '/save.js', '/decks.json', '/manifest.webmanifest', '/icon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const key = url.pathname; // invite links differ only by query string
  const fresh = fetch(e.request).then(async res => {
    if (res.ok) await (await caches.open(CACHE)).put(key, res.clone());
    return res;
  });
  e.waitUntil(fresh.catch(() => {}));
  e.respondWith(caches.match(key).then(hit => hit || fresh));
});
