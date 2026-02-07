// Debug + test push endpoint

import { getStore } from "@netlify/blobs";
import webpush from "web-push";

export default async (req) => {
  const r = [];

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  r.push("VAPID: " + (pub && priv ? "OK" : "EKSIK!"));

  const now = new Date();
  r.push("UTC: " + now.getUTCHours() + ":" + pad(now.getUTCMinutes()));

  if (!pub || !priv) return json({ results: r });
  webpush.setVapidDetails(process.env.VAPID_EMAIL || "mailto:test@test.com", pub, priv);

  try {
    const store = getStore("softwake-alarms");
    const raw = await store.get("active");

    if (!raw) {
      r.push("KAYIT YOK — önce uygulamadan alarm kaydet");
      return json({ results: r });
    }

    const data = JSON.parse(raw);
    r.push("Alarm sayisi: " + (data.alarms ? data.alarms.length : 0));
    r.push("Guncelleme: " + data.updatedAt);
    r.push("Endpoint: " + (data.subscription ? data.subscription.endpoint.slice(0, 50) + "..." : "YOK"));

    if (data.alarms) {
      data.alarms.forEach(a => {
        r.push("  → id=" + a.id + " UTC=" + a.utcHour + ":" + pad(a.utcMinute) + " enabled=" + a.enabled + " days=" + JSON.stringify(a.days));
      });
    }

    // Test push
    if (data.subscription) {
      try {
        await webpush.sendNotification(
          data.subscription,
          JSON.stringify({ title: "SoftWake Test", body: "Bildirim calisiyor ✓", tag: "softwake-test" })
        );
        r.push("TEST PUSH: GONDERILDI ✓");
      } catch (e) {
        r.push("TEST PUSH HATASI: " + (e.statusCode || "") + " " + e.message);
      }
    }

  } catch (err) {
    r.push("HATA: " + err.message);
  }

  return json({ results: r });
};

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function json(d) { return new Response(JSON.stringify(d, null, 2), { headers: { "Content-Type": "application/json" } }); }
