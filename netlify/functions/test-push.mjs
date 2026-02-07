// Debug endpoint — tüm verileri göster + test push gönder
// GET /.netlify/functions/test-push

import { getStore } from "@netlify/blobs";
import webpush from "web-push";

export default async (req) => {
  const results = [];

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || "mailto:test@example.com";

  results.push("VAPID_PUBLIC: " + (pub ? "OK" : "YOK!"));
  results.push("VAPID_PRIVATE: " + (priv ? "OK" : "YOK!"));

  if (!pub || !priv) {
    return json({ results });
  }

  webpush.setVapidDetails(email, pub, priv);

  const now = new Date();
  results.push("UTC simdi: " + now.getUTCHours() + ":" + pad(now.getUTCMinutes()));

  try {
    const store = getStore("softwake-alarms");
    const { blobs } = await store.list();
    results.push("Toplam blob: " + blobs.length);

    let pushSent = false;

    for (let i = 0; i < blobs.length; i++) {
      const raw = await store.get(blobs[i].key);
      if (!raw) continue;

      const data = JSON.parse(raw);
      results.push("--- Blob " + (i + 1) + " ---");
      results.push("  Key: " + blobs[i].key);
      results.push("  Alarm sayisi: " + (data.alarms ? data.alarms.length : 0));
      results.push("  Guncelleme: " + data.updatedAt);
      results.push("  Endpoint: " + (data.subscription ? data.subscription.endpoint.slice(0, 60) + "..." : "YOK"));

      if (data.alarms && data.alarms.length > 0) {
        data.alarms.forEach(function (a) {
          results.push("  Alarm: id=" + a.id + " UTC=" + a.utcHour + ":" + pad(a.utcMinute) + " enabled=" + a.enabled + " days=" + JSON.stringify(a.days));
        });
      }

      // Her blob icin test push gonder
      if (data.subscription && !pushSent) {
        try {
          await webpush.sendNotification(
            data.subscription,
            JSON.stringify({
              title: "SoftWake Test",
              body: "Bildirim calisiyor! Saat: " + now.getUTCHours() + ":" + pad(now.getUTCMinutes()) + " UTC",
              tag: "softwake-test"
            })
          );
          results.push("  PUSH GONDERILDI ✓");
          pushSent = true;
        } catch (pushErr) {
          results.push("  PUSH HATASI: " + (pushErr.statusCode || "") + " " + pushErr.message);
        }
      }
    }

    if (!pushSent) {
      results.push("HICBIR ABONELIGE PUSH GONDERILEMEDI");
    }

  } catch (err) {
    results.push("HATA: " + err.message);
  }

  return json({ results });
};

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function json(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
