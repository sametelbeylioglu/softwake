// Test endpoint — anında push notification göndermeyi dener
// GET /.netlify/functions/test-push

import { getStore } from "@netlify/blobs";
import webpush from "web-push";

export default async (req) => {
  const results = [];

  // 1. VAPID keys kontrol
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || "mailto:test@example.com";

  results.push("VAPID_PUBLIC_KEY: " + (pub ? "VAR (" + pub.slice(0, 10) + "...)" : "YOK!"));
  results.push("VAPID_PRIVATE_KEY: " + (priv ? "VAR" : "YOK!"));

  if (!pub || !priv) {
    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  webpush.setVapidDetails(email, pub, priv);

  // 2. Blob store kontrol
  try {
    const store = getStore("softwake-alarms");
    const { blobs } = await store.list();
    results.push("Blob sayısı: " + blobs.length);

    if (blobs.length === 0) {
      results.push("HİÇ ABONELİK YOK — alarm kaydet ve tekrar dene");
      return new Response(JSON.stringify({ results }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. İlk aboneliğe test push gönder
    for (const blob of blobs) {
      const raw = await store.get(blob.key);
      if (!raw) continue;

      const data = JSON.parse(raw);
      results.push("Abonelik bulundu, alarm sayısı: " + (data.alarms || []).length);
      results.push("Güncelleme: " + data.updatedAt);

      // Alarm detayları
      if (data.alarms) {
        data.alarms.forEach(function (a) {
          results.push("  Alarm " + a.id + ": UTC " + a.utcHour + ":" + a.utcMinute + " enabled=" + a.enabled + " days=" + JSON.stringify(a.days));
        });
      }

      // Şu anki UTC saat
      var now = new Date();
      results.push("Şu an UTC: " + now.getUTCHours() + ":" + now.getUTCMinutes());

      // Test push gönder
      try {
        await webpush.sendNotification(
          data.subscription,
          JSON.stringify({
            title: "SoftWake Test",
            body: "Push notification çalışıyor! ✓",
            tag: "softwake-test"
          })
        );
        results.push("PUSH GÖNDERİLDİ ✓");
      } catch (pushErr) {
        results.push("PUSH HATASI: " + pushErr.statusCode + " — " + pushErr.message);
        results.push("Body: " + (pushErr.body || "yok"));
      }

      break; // sadece ilk aboneliği test et
    }

  } catch (err) {
    results.push("BLOB HATASI: " + err.message);
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
};
