// Her dakika çalışır — alarm saati gelen aboneye push gönderir

import { getStore } from "@netlify/blobs";
import webpush from "web-push";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:softwake@example.com";

export default async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error("[check-alarms] VAPID keys eksik!");
    return;
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

  const store = getStore("softwake-alarms");
  const now = new Date();
  const currentH = now.getUTCHours();
  const currentM = now.getUTCMinutes();
  const currentDay = now.getUTCDay();
  const todayStr = now.toISOString().slice(0, 10);

  console.log(`[check-alarms] ${currentH}:${currentM < 10 ? '0' : ''}${currentM} UTC, gün: ${currentDay}`);

  try {
    const raw = await store.get("active");
    if (!raw) {
      console.log("[check-alarms] Kayıt yok");
      return;
    }

    const data = JSON.parse(raw);
    const { subscription, alarms } = data;

    if (!subscription || !alarms || alarms.length === 0) {
      console.log("[check-alarms] Subscription veya alarm yok");
      return;
    }

    console.log(`[check-alarms] ${alarms.length} alarm kontrol ediliyor`);

    let updated = false;

    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      if (alarm.utcHour !== currentH || alarm.utcMinute !== currentM) continue;

      // Bugün zaten gönderildi mi?
      const sentKey = `sent_${alarm.id}_${todayStr}`;
      if (data[sentKey]) continue;

      // Gün kontrolü
      if (alarm.days && alarm.days.length > 0) {
        if (!alarm.days.includes(currentDay)) continue;
      }

      // Push gönder!
      console.log(`[check-alarms] ALARM! id=${alarm.id} UTC=${alarm.utcHour}:${alarm.utcMinute}`);

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: "SoftWake",
            body: "Yumuşak uyanış zamanı ☀️",
            tag: "softwake-alarm",
            alarmId: alarm.id
          })
        );

        console.log(`[check-alarms] Push gönderildi ✓`);
        data[sentKey] = true;
        updated = true;

        // Tek seferlik alarmı kapat
        if (!alarm.days || alarm.days.length === 0) {
          alarm.enabled = false;
          updated = true;
        }

      } catch (pushErr) {
        console.error(`[check-alarms] Push hatası: ${pushErr.statusCode} ${pushErr.message}`);
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          await store.delete("active");
          console.log("[check-alarms] Geçersiz subscription silindi");
          return;
        }
      }
    }

    if (updated) {
      await store.set("active", JSON.stringify(data));
    }

  } catch (err) {
    console.error("[check-alarms] Hata:", err.message);
  }
};

export const config = {
  schedule: "* * * * *"
};
