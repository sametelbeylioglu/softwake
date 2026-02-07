/* ═══════════════════════════════════════════════
   PushManager — Web Push Notification yönetimi
   ═══════════════════════════════════════════════ */

var PushManager = (function () {
  'use strict';

  var VAPID_PUBLIC_KEY = 'BDfJT06cPx1KMKC34NAYEG0aZwSkLuBaKUGMUwxUPT6CONVeA25wAJ1MdAgB05QeKTxSuN3DUMgIvsgwVI5g9So';

  var subscription = null;
  var isSupported = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  var statusCallback = null;

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
      report('Push desteklenmiyor');
      return null;
    }

    try {
      var registration = await navigator.serviceWorker.ready;
      report('Service Worker hazır');

      // Mevcut subscription?
      subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        var permission = await Notification.requestPermission();
        report('Bildirim izni: ' + permission);

        if (permission !== 'granted') {
          return null;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        report('Push aboneliği oluşturuldu ✓');
      } else {
        report('Mevcut push aboneliği bulundu ✓');
      }

      return subscription;

    } catch (err) {
      report('Push hatası: ' + err.message);
      return null;
    }
  }

  // ── Alarm verilerini sunucuya gönder ──

  async function syncAlarms(alarms) {
    if (!subscription) {
      subscription = await subscribe();
    }
    if (!subscription) {
      report('Abonelik yok, senkronizasyon yapılamadı');
      return false;
    }

    var tzOffset = new Date().getTimezoneOffset();
    var utcAlarms = alarms.map(function (a) {
      var totalMinutes = a.hour * 60 + a.minute - tzOffset;
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
      // Netlify Functions varsayılan yolu
      var response = await fetch('/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          alarms: utcAlarms
        })
      });

      if (!response.ok) {
        var errText = await response.text();
        report('Sunucu hatası: ' + response.status + ' — ' + errText);
        return false;
      }

      var result = await response.json();
      report('Alarmlar sunucuya kaydedildi ✓');
      return result.ok;

    } catch (err) {
      report('Senkronizasyon hatası: ' + err.message);
      return false;
    }
  }

  function supported() {
    return isSupported;
  }

  function onStatus(fn) {
    statusCallback = fn;
  }

  function report(msg) {
    console.log('[Push] ' + msg);
    if (statusCallback) statusCallback(msg);
  }

  return {
    subscribe: subscribe,
    syncAlarms: syncAlarms,
    supported: supported,
    onStatus: onStatus
  };

})();
