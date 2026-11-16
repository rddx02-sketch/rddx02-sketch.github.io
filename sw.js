// Kutukan Si Oyen - service worker: game works fully offline after the first launch.
const CACHE = 'si-oyen-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png'];
// Folder this game is served from ('/'). The other games on this site live in their own sub-folders.
const ROOT = new URL('./', self.location).pathname;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // Only clear this game's own old caches; other games on the same site keep theirs.
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('si-oyen-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === location.origin;
  // Path inside this game's folder. Anything in a sub-folder (bola-api/, tokek-malam/, ...) belongs to another game: leave it alone.
  const rel = own && url.pathname.startsWith(ROOT) ? url.pathname.slice(ROOT.length) : null;
  if (own && (rel === null || rel.includes('/'))) return;
  // Game page: try network first (gets updates), fall back to cache when offline.
  if (req.mode === 'navigate') {
    // Only the game page itself is kept for offline play, never privacy.html or terms.html.
    if (rel !== '' && rel !== 'index.html') return;
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // Everything else (icons, Google Fonts): cache first, then network, and remember it.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque') && (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname))) {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy));
    }
    return r;
  })));
});
