// Alarm aboneliğini kaydet / güncelle
// POST /.netlify/functions/subscribe

import { getStore } from "@netlify/blobs";

export default async (req) => {
  // CORS preflight
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
    const { subscription, alarms } = body;

    if (!subscription || !subscription.endpoint) {
      return new Response(JSON.stringify({ error: "Missing subscription" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const store = getStore("softwake-alarms");

    // Subscription endpoint'i key olarak kullan
    const key = Buffer.from(subscription.endpoint).toString("base64url").slice(0, 64);

    const record = {
      subscription,
      alarms: alarms || [],
      updatedAt: new Date().toISOString()
    };

    await store.set(key, JSON.stringify(record));

    const alarmCount = (alarms || []).length;
    console.log("[subscribe] Kayıt başarılı:", key, "alarm sayısı:", alarmCount, "body keys:", Object.keys(body));

    return new Response(JSON.stringify({ ok: true, key, receivedAlarms: alarmCount }), {
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
