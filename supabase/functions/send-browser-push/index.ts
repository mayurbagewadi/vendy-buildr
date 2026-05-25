import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const createServiceClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

const createUserClient = (authorization: string | null) =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: authorization ? { Authorization: authorization } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

const configureWebPush = () => {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@digitaldukandar.in";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return publicKey;
};

const getOwnedStore = async (serviceClient: any, userId: string) => {
  const { data: store, error } = await serviceClient
    .from("stores")
    .select("id, name, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!store) throw new Error("Store not found for this user.");
  return store;
};

const sendToSubscription = async (subscription: any, payload: Record<string, unknown>) => {
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload),
    { TTL: 60 * 60 },
  );
};

const sendEvent = async (serviceClient: any, eventId: string) => {
  configureWebPush();

  const { data: event, error: eventError } = await serviceClient
    .from("notification_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError || !event) throw new Error(eventError?.message || "Notification event not found.");

  const { data: preferences } = await serviceClient
    .from("notification_preferences")
    .select("*")
    .eq("store_id", event.store_id)
    .eq("user_id", event.user_id)
    .maybeSingle();

  if (preferences?.browser_push_enabled === false) {
    await serviceClient.from("notification_events").update({ delivery_status: "skipped" }).eq("id", event.id);
    return { success: true, sent: 0, skipped: true };
  }

  if (
    (event.type === "new_order" && preferences?.new_order_enabled === false) ||
    (event.type === "paid_order" && preferences?.paid_order_enabled === false) ||
    (event.type === "low_stock" && preferences?.low_stock_enabled === false)
  ) {
    await serviceClient.from("notification_events").update({ delivery_status: "skipped" }).eq("id", event.id);
    return { success: true, sent: 0, skipped: true };
  }

  const { data: subscriptions, error: subsError } = await serviceClient
    .from("browser_push_subscriptions")
    .select("*")
    .eq("store_id", event.store_id)
    .eq("user_id", event.user_id)
    .is("disabled_at", null);

  if (subsError) throw subsError;
  if (!subscriptions?.length) {
    await serviceClient.from("notification_events").update({ delivery_status: "skipped" }).eq("id", event.id);
    return { success: true, sent: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;

  await Promise.all(subscriptions.map(async (subscription: any) => {
    try {
      await sendToSubscription(subscription, {
        eventId: event.id,
        title: event.title,
        body: event.body,
        url: event.action_url || "/admin/orders",
        tag: event.event_key,
        requireInteraction: event.type === "new_order" || event.type === "paid_order",
      });

      sent += 1;
      await serviceClient
        .from("browser_push_subscriptions")
        .update({ failure_count: 0, last_seen_at: new Date().toISOString() })
        .eq("id", subscription.id);
      await serviceClient.from("notification_delivery_logs").insert({
        notification_event_id: event.id,
        subscription_id: subscription.id,
        status: "sent",
      });
    } catch (error: any) {
      failed += 1;
      const nextFailures = (subscription.failure_count || 0) + 1;
      await serviceClient
        .from("browser_push_subscriptions")
        .update({
          failure_count: nextFailures,
          disabled_at: nextFailures >= 3 ? new Date().toISOString() : null,
        })
        .eq("id", subscription.id);
      await serviceClient.from("notification_delivery_logs").insert({
        notification_event_id: event.id,
        subscription_id: subscription.id,
        status: "failed",
        error_message: error?.message || "Push send failed",
      });
    }
  }));

  await serviceClient
    .from("notification_events")
    .update({
      delivered_at: sent > 0 ? new Date().toISOString() : null,
      delivery_status: sent > 0 && failed === 0 ? "sent" : sent > 0 ? "partial" : "failed",
    })
    .eq("id", event.id);

  return { success: true, sent, failed };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceClient = createServiceClient();
    const body = await req.json();
    const action = body?.action;

    if (action === "get_public_key") {
      return jsonResponse({ publicKey: configureWebPush() });
    }

    if (action === "send_event") {
      const expectedSecret = Deno.env.get("BROWSER_PUSH_INTERNAL_SECRET");
      if (!expectedSecret || req.headers.get("x-internal-secret") !== expectedSecret) {
        return jsonResponse({ success: false, error: "Unauthorized" }, 401);
      }
      if (!body.eventId) return jsonResponse({ success: false, error: "eventId is required" }, 400);
      return jsonResponse(await sendEvent(serviceClient, body.eventId));
    }

    const authorization = req.headers.get("Authorization");
    const userClient = createUserClient(authorization);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

    const store = await getOwnedStore(serviceClient, user.id);

    if (action === "upsert_subscription") {
      const subscription = body.subscription;
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return jsonResponse({ success: false, error: "Invalid push subscription" }, 400);
      }

      const userAgent = String(body.userAgent || "").slice(0, 600);
      const deviceLabel = userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser";

      const { error } = await serviceClient
        .from("browser_push_subscriptions")
        .upsert({
          store_id: store.id,
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent,
          device_label: deviceLabel,
          disabled_at: null,
          failure_count: 0,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: "endpoint" });

      if (error) throw error;

      await serviceClient
        .from("notification_preferences")
        .upsert({
          store_id: store.id,
          user_id: user.id,
          browser_push_enabled: true,
          new_order_enabled: true,
          paid_order_enabled: true,
        }, { onConflict: "store_id,user_id" });

      return jsonResponse({ success: true });
    }

    if (action === "remove_subscription") {
      if (!body.endpoint) return jsonResponse({ success: false, error: "endpoint is required" }, 400);

      const { error } = await serviceClient
        .from("browser_push_subscriptions")
        .update({ disabled_at: new Date().toISOString() })
        .eq("endpoint", body.endpoint)
        .eq("user_id", user.id)
        .eq("store_id", store.id);

      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (action === "send_test") {
      const eventKey = `test:${store.id}:${user.id}:${Date.now()}`;
      const { data: event, error } = await serviceClient
        .from("notification_events")
        .insert({
          store_id: store.id,
          user_id: user.id,
          event_key: eventKey,
          type: "test",
          title: "Browser notifications are working",
          body: `${store.name || "Your store"} will alert you here when orders arrive.`,
          action_url: "/admin/settings/notifications",
          metadata: { source: "manual_test" },
        })
        .select("id")
        .single();

      if (error || !event) throw new Error(error?.message || "Could not create test notification");
      return jsonResponse(await sendEvent(serviceClient, event.id));
    }

    return jsonResponse({ success: false, error: "Unknown action" }, 400);
  } catch (error: any) {
    console.error("[send-browser-push] failed:", error);
    return jsonResponse({ success: false, error: error?.message || "Unknown error" }, 400);
  }
});
