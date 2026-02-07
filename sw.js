// SoftWake Service Worker — Offline destek + PWA

var CACHE_NAME = 'softwake-v1';
var ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/store.js',
  '/js/engine.js',
  '/js/picker.js',
  '/js/app.js',
  '/manifest.json'
];

// Kurulum — dosyaları önbelleğe al
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktifleşme — eski önbellekleri temizle
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — önce cache, yoksa network
self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request);
    })
  );
});
