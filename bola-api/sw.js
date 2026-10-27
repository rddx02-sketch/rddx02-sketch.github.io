// Bola Api Arena - service worker: game tetap bisa dibuka offline (mode lokal) setelah pertama kali dimuat.
const CACHE = 'bola-api-v1';
const CORE = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png',
  'js/util.js', 'js/data.js', 'js/sim.js', 'js/ai.js', 'js/render.js', 'js/chars.js', 'js/arena.js', 'js/fx.js', 'js/cine.js', 'js/audio.js',
  'js/narrator.js', 'js/input.js', 'js/net.js', 'js/ui.js', 'js/layout.js', 'js/game.js', 'js/main.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/supabase\.co$/.test(url.hostname)) return; // realtime online: jangan di-cache
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  const own = url.origin === location.origin;
  // berkas game sendiri: jaringan dulu (dapat pembaruan), cadangan cache; pustaka CDN: cache dulu
  if (own) {
    e.respondWith(fetch(req).then(r => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque') && /(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)$/.test(url.hostname)) {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy));
    }
    return r;
  })));
});
