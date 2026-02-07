// Alarm aboneliğini kaydet / güncelle
// Her zaman tek bir kayıt tutulur (eski abonelikler silinir)

import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { subscription, alarms, deviceId } = body;

    if (!subscription || !subscription.endpoint) {
      return new Response(JSON.stringify({ error: "Missing subscription" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const store = getStore("softwake-alarms");

    // Eski tüm kayıtları sil (temiz başla)
    try {
      const { blobs } = await store.list();
      for (const blob of blobs) {
        await store.delete(blob.key);
      }
    } catch (e) {
      // silme hatası kritik değil
    }

    // Tek kayıt olarak yaz
    const key = "active";
    const record = {
      subscription,
      alarms: alarms || [],
      deviceId: deviceId || "unknown",
      updatedAt: new Date().toISOString()
    };

    await store.set(key, JSON.stringify(record));

    const alarmCount = (alarms || []).length;
    console.log("[subscribe] Kayıt:", alarmCount, "alarm, endpoint:", subscription.endpoint.slice(0, 40));

    return new Response(JSON.stringify({ ok: true, receivedAlarms: alarmCount }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    console.error("[subscribe] Hata:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
