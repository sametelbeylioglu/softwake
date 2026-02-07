/* ═══════════════════════════════════════════════
   PushManager — Web Push Notification yönetimi
   
   Alarm arka planda (ekran kapalı) bile bildirim
   gönderebilmek için push subscription yönetir.
   ═══════════════════════════════════════════════ */

var PushManager = (function () {
  'use strict';

  // VAPID Public Key (generate-vapid-keys ile üretildi)
  var VAPID_PUBLIC_KEY = 'BDfJT06cPx1KMKC34NAYEG0aZwSkLuBaKUGMUwxUPT6CONVeA25wAJ1MdAgB05QeKTxSuN3DUMgIvsgwVI5g9So';

  var subscription = null;
  var isSupported = ('serviceWorker' in navigator) && ('PushManager' in window);

  // ── VAPID key'i Uint8Array'e çevir ──

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // ── Push'a abone ol ──

  async function subscribe() {
    if (!isSupported) {
      console.warn('[Push] Bu tarayıcı push notification desteklemiyor');
      return null;
    }

    try {
      // Service Worker hazır mı?
      var registration = await navigator.serviceWorker.ready;

      // Mevcut subscription var mı?
      subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Bildirim izni iste
        var permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('[Push] Bildirim izni reddedildi');
          return null;
        }

        // Yeni subscription oluştur
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        console.log('[Push] Abone olundu');
      }

      return subscription;

    } catch (err) {
      console.error('[Push] Abonelik hatası:', err);
      return null;
    }
  }

  // ── Alarm verilerini sunucuya gönder ──

  async function syncAlarms(alarms) {
    if (!subscription) {
      subscription = await subscribe();
    }
    if (!subscription) return false;

    // Alarm saatlerini UTC'ye çevir
    var tzOffset = new Date().getTimezoneOffset(); // dakika cinsinden (Türkiye: -180)
    var utcAlarms = alarms.map(function (a) {
      var totalMinutes = a.hour * 60 + a.minute - tzOffset;
      // Negatif veya 24 saati aşan değerleri düzelt
      if (totalMinutes < 0) totalMinutes += 1440;
      if (totalMinutes >= 1440) totalMinutes -= 1440;

      return {
        id: a.id,
        utcHour: Math.floor(totalMinutes / 60),
        utcMinute: totalMinutes % 60,
        days: a.days || [],
        enabled: a.enabled !== false,
        startDate: a.startDate
      };
    });

    try {
      var response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          alarms: utcAlarms
        })
      });

      var result = await response.json();
      console.log('[Push] Alarmlar senkronize edildi:', result);
      return result.ok;

    } catch (err) {
      console.error('[Push] Senkronizasyon hatası:', err);
      return false;
    }
  }

  // ── Destek kontrolü ──

  function supported() {
    return isSupported;
  }

  return {
    subscribe: subscribe,
    syncAlarms: syncAlarms,
    supported: supported
  };

})();
