// Alarm aboneliğini kaydet / güncelle
// POST /api/subscribe
// Body: { subscription: PushSubscription, alarms: Alarm[] }

import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { subscription, alarms } = body;

    if (!subscription || !subscription.endpoint) {
      return new Response("Missing subscription", { status: 400 });
    }

    const store = getStore("softwake-alarms");

    // Subscription endpoint'i key olarak kullan (URL-safe hash)
    const key = btoa(subscription.endpoint).replace(/[/+=]/g, "_").slice(0, 64);

    await store.set(key, JSON.stringify({
      subscription,
      alarms: alarms || [],
      updatedAt: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ ok: true }), {
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

// CORS preflight
export const config = {
  path: "/api/subscribe",
  method: ["POST", "OPTIONS"]
};
