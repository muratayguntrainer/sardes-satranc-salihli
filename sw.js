// Sardes Satranç: çevrimdışı çalışması için basit servis çalışanı.
// Sayfa açılışlarında önce ağ denenir (hep güncel sürüm), ağ yoksa önbellek kullanılır.
var CACHE = 'sardes-satranc-v1';
var SHELL = ['oyna.html', 'oyna.css', 'engine.js', 'game.js', 'worker.js', 'manifest.webmanifest',
  'logo.jpg', 'icons/icon-192.png', 'icons/icon-512.png',
  'pieces/wK.svg', 'pieces/wQ.svg', 'pieces/wR.svg', 'pieces/wB.svg', 'pieces/wN.svg', 'pieces/wP.svg',
  'pieces/bK.svg', 'pieces/bQ.svg', 'pieces/bR.svg', 'pieces/bB.svg', 'pieces/bN.svg', 'pieces/bP.svg'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // yazı tipleri vb. doğrudan ağdan
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req).then(function (hit) { return hit || caches.match('oyna.html'); }); })
  );
});
