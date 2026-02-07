// SoftWake Service Worker — Offline + Push Notification

var CACHE_NAME = 'softwake-v5';
var ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/store.js',
  '/js/engine.js',
  '/js/picker.js',
  '/js/push.js',
  '/js/app.js',
  '/manifest.json'
];

// ── Kurulum — dosyaları önbelleğe al ──

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Aktifleşme — eski önbellekleri temizle ──

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

// ── Fetch — önce network, yoksa cache (her zaman güncel) ──

self.addEventListener('fetch', function (e) {
  // API ve function isteklerini cache'leme
  if (e.request.url.includes('/.netlify/') || e.request.url.includes('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(function (response) {
        // Başarılıysa cache'i güncelle
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, clone);
        });
        return response;
      })
      .catch(function () {
        // Offline ise cache'ten sun
        return caches.match(e.request);
      })
  );
});

// ══════════════════════════════════════════
// PUSH NOTIFICATION — arka plan bildirim
// ══════════════════════════════════════════

self.addEventListener('push', function (e) {
  var data = {
    title: 'SoftWake',
    body: 'Yumuşak uyanış zamanı ☀️',
    tag: 'softwake-alarm'
  };

  if (e.data) {
    try {
      data = Object.assign(data, e.data.json());
    } catch (err) {
      // JSON parse hatası — varsayılanları kullan
    }
  }

  var options = {
    body: data.body,
    tag: data.tag,
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    vibrate: [200, 100, 200, 100, 200], // titreşim deseni
    requireInteraction: true, // kullanıcı kapatana kadar kal
    actions: [
      { action: 'open', title: 'Aç' },
      { action: 'dismiss', title: 'Kapat' }
    ],
    data: {
      alarmId: data.alarmId,
      url: '/'
    }
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Bildirime tıklandığında ──

self.addEventListener('notificationclick', function (e) {
  e.notification.close();

  if (e.action === 'dismiss') return;

  // Uygulama açık mı kontrol et, açıksa odaklan, değilse aç
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clients) {
        // Açık pencere varsa odaklan ve alarm başlat mesajı gönder
        for (var i = 0; i < clients.length; i++) {
          if (clients[i].url.includes(self.registration.scope)) {
            clients[i].focus();
            clients[i].postMessage({
              type: 'ALARM_TRIGGERED',
              alarmId: e.notification.data.alarmId
            });
            return;
          }
        }
        // Açık pencere yoksa yeni pencere aç
        return self.clients.openWindow('/?alarm=triggered');
      })
  );
});
