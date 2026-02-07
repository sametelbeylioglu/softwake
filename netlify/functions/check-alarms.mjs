// Her dakika çalışan scheduled function
// Alarm saati gelen abonelere push notification gönderir

import { getStore } from "@netlify/blobs";
import webpush from "web-push";

// VAPID ayarları (environment variables'dan)
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
  const todayStr = now.toISOString().slice(0, 10);

  console.log(`[check-alarms] Kontrol: ${currentH}:${currentM} UTC`);

  // Tüm abonelikleri tara
  const { blobs } = await store.list();

  for (const blob of blobs) {
    try {
      const raw = await store.get(blob.key);
      if (!raw) continue;

      const data = JSON.parse(raw);
      const { subscription, alarms } = data;

      if (!subscription || !alarms || alarms.length === 0) continue;

      for (const alarm of alarms) {
        if (!alarm.enabled) continue;

        // Saat/dakika eşleşmesi (alarm UTC offset ile gönderilir)
        if (alarm.utcHour !== currentH || alarm.utcMinute !== currentM) continue;

        // Bugün zaten gönderildi mi?
        const sentKey = `sent_${alarm.id}_${todayStr}`;
        if (data[sentKey]) continue;

        // Gün kontrolü
        const currentDay = now.getUTCDay(); // 0=Pazar
        if (alarm.days && alarm.days.length > 0) {
          if (!alarm.days.includes(currentDay)) continue;
        }

        // Push gönder!
        console.log(`[check-alarms] Alarm tetiklendi: ${alarm.id}`);

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

          // Gönderildi olarak işaretle
          data[sentKey] = true;

          // Tek seferlik alarmı kapat
          if (!alarm.days || alarm.days.length === 0) {
            alarm.enabled = false;
          }

          await store.set(blob.key, JSON.stringify(data));

          console.log(`[check-alarms] Push gönderildi: ${alarm.id}`);
        } catch (pushErr) {
          console.error(`[check-alarms] Push hatası:`, pushErr.statusCode || pushErr.message);

          // 410 Gone = subscription artık geçerli değil → sil
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await store.delete(blob.key);
            console.log(`[check-alarms] Geçersiz subscription silindi: ${blob.key}`);
          }
        }
      }
    } catch (err) {
      console.error(`[check-alarms] Blob işleme hatası:`, err.message);
    }
  }

  console.log("[check-alarms] Tamamlandı");
};

// Her dakika çalış
export const config = {
  schedule: "* * * * *"
};
