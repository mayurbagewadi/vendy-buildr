// Customer "My Order" lookup.
//
// Customers have no login, so a store's customer proves who they are with the
// phone number + delivery pincode used at checkout. Both must match the same
// order. The orders table stays closed to the public; this function reads it
// with the service role and returns only customer-safe fields, with phone and
// address partly hidden.
//
// Abuse protection (attempt log in customer_order_lookup_attempts):
//   - per phone (inside one store): max FAILED_LIMIT failed lookups per hour
//   - per IP (best effort, behind proxy): max IP_LIMIT lookups per 15 minutes
//
// Online orders whose payment is still pending or failed are returned too;
// the page labels them so the customer knows they are not being processed.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FAILED_LIMIT = 10;
const FAILED_WINDOW_MINUTES = 60;
const IP_LIMIT = 30;
const IP_WINDOW_MINUTES = 15;
const MAX_ORDERS = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

// Accepts "9876543210", "+91 98765 43210", "09876543210" → "9876543210"
function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

function maskPhone(phone: string): string {
  const digits = normalizePhone(phone);
  if (digits.length < 4) return "XXXXXXXXXX";
  return `${digits.slice(0, 2)}XXXXXX${digits.slice(-2)}`;
}

// Hide the start of the address (house / flat / street) and keep only the
// last part (usually locality / city) so the customer can recognise it.
function maskAddress(address: unknown): string {
  const text = cleanText(address);
  if (!text) return "";
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return `•••• ${parts.slice(-2).join(", ")}`;
  return text.length > 12 ? `•••• ${text.slice(-12).trim()}` : "••••";
}

function firstName(name: unknown): string {
  return cleanText(name).split(" ")[0] || "";
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeItems(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).map((item: any) => ({
    name: cleanText(item?.productName ?? item?.name ?? "Item"),
    variant: item?.variant ? cleanText(item.variant) : null,
    price: toNumber(item?.price),
    quantity: Math.max(0, Math.floor(toNumber(item?.quantity))),
    image: item?.productImage ?? item?.image ?? null,
  }));
}

// Only link to courier websites. Platform /track/ links are skipped because
// the tracking events are already shown inline on the My Order page.
function externalTrackingUrl(url: unknown): string | null {
  const text = cleanText(url);
  if (!/^https:\/\//i.test(text)) return null;
  if (/\/track\//i.test(text) && !/delhivery\.com/i.test(text)) return null;
  return text;
}

function normalizeStatus(value: unknown): string {
  return cleanText(value).replace(/_/g, " ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const storeId = cleanText(body?.store_id);
    const phone = normalizePhone(body?.phone);
    const pincode = cleanText(body?.pincode);

    if (!UUID_RE.test(storeId)) {
      return jsonResponse({ error: "Invalid store" }, 400);
    }
    if (!PHONE_RE.test(phone)) {
      return jsonResponse({ error: "Enter a valid 10-digit phone number" }, 400);
    }
    if (!PINCODE_RE.test(pincode)) {
      return jsonResponse({ error: "Enter a valid 6-digit PIN code" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const phoneHash = await sha256(`${storeId}:${phone}`);
    const clientIp = getClientIp(req);
    const ipHash = clientIp ? await sha256(`ip:${clientIp}`) : null;

    // ── Rate limits ────────────────────────────────────────────────────────
    const failedCutoff = new Date(Date.now() - FAILED_WINDOW_MINUTES * 60_000).toISOString();
    const { count: failedCount, error: failedCountError } = await supabase
      .from("customer_order_lookup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("phone_hash", phoneHash)
      .eq("success", false)
      .gte("created_at", failedCutoff);
    if (failedCountError) throw failedCountError;

    if ((failedCount || 0) >= FAILED_LIMIT) {
      console.warn("customer-order-lookup: phone rate limit hit", { storeId });
      return jsonResponse({ error: "Too many attempts. Please try again after some time." }, 429);
    }

    if (ipHash) {
      const ipCutoff = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000).toISOString();
      const { count: ipCount, error: ipCountError } = await supabase
        .from("customer_order_lookup_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", ipCutoff);
      if (ipCountError) throw ipCountError;

      if ((ipCount || 0) >= IP_LIMIT) {
        console.warn("customer-order-lookup: ip rate limit hit", { storeId });
        return jsonResponse({ error: "Too many attempts. Please try again after some time." }, 429);
      }
    }

    // ── Orders: phone + pincode must both match, inside this store only ─────
    const phoneVariants = [phone, `+91${phone}`, `91${phone}`, `+91 ${phone}`, `0${phone}`];
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        created_at,
        status,
        payment_method,
        payment_status,
        payment_gateway,
        items,
        subtotal,
        discount_amount,
        coupon_code,
        delivery_charge,
        gst_enabled,
        gst_show_on_summary,
        gst_rate,
        gst_amount,
        taxable_amount,
        total,
        delivery_time,
        customer_name,
        customer_phone,
        delivery_address,
        delivery_pincode,
        courier_name,
        awb_code,
        shipping_status,
        tracking_url
      `)
      .eq("store_id", storeId)
      .in("customer_phone", phoneVariants)
      .eq("delivery_pincode", pincode)
      .order("created_at", { ascending: false })
      .limit(MAX_ORDERS);
    if (ordersError) throw ordersError;

    // Unpaid (awaiting_payment) and failed online orders are included on
    // purpose — the My Order page shows them with a clear payment message.
    const visibleOrders = orders || [];

    await supabase.from("customer_order_lookup_attempts").insert({
      store_id: storeId,
      phone_hash: phoneHash,
      ip_hash: ipHash,
      success: visibleOrders.length > 0,
    });

    if (visibleOrders.length === 0) {
      return jsonResponse({ orders: [] });
    }

    // ── Shipment tracking events (Delhivery shipments) ─────────────────────
    const orderIds = visibleOrders.map((o: any) => o.id);
    const { data: shipments, error: shipmentsError } = await supabase
      .from("shipments")
      .select("id, order_id, provider, awb, status, tracking_url")
      .in("order_id", orderIds);
    if (shipmentsError) console.error("customer-order-lookup: shipments read failed", shipmentsError.message);

    const shipmentByOrder = new Map<string, any>();
    for (const s of shipments || []) shipmentByOrder.set(s.order_id, s);

    const shipmentIds = (shipments || []).map((s: any) => s.id);
    const eventsByShipment = new Map<string, any[]>();
    if (shipmentIds.length > 0) {
      const { data: events, error: eventsError } = await supabase
        .from("shipment_events")
        .select("shipment_id, status, location, message, happened_at, created_at")
        .in("shipment_id", shipmentIds)
        .order("happened_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (eventsError) console.error("customer-order-lookup: events read failed", eventsError.message);

      for (const e of events || []) {
        const list = eventsByShipment.get(e.shipment_id) || [];
        if (list.length < 8) list.push(e);
        eventsByShipment.set(e.shipment_id, list);
      }
    }

    const result = visibleOrders.map((o: any) => {
      const shipment = shipmentByOrder.get(o.id);
      const awb = cleanText(shipment?.awb || o.awb_code) || null;
      const trackingLink = shipment?.provider === "delhivery" && awb
        ? `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`
        : externalTrackingUrl(shipment?.tracking_url || o.tracking_url);

      return {
        order_number: o.order_number,
        created_at: o.created_at,
        status: cleanText(o.status) || "new",
        payment_method: cleanText(o.payment_method),
        payment_status: cleanText(o.payment_status) || null,
        payment_gateway: cleanText(o.payment_gateway) || null,
        items: sanitizeItems(o.items),
        subtotal: toNumber(o.subtotal),
        discount_amount: toNumber(o.discount_amount),
        coupon_code: o.coupon_code || null,
        delivery_charge: toNumber(o.delivery_charge),
        gst_enabled: o.gst_enabled === true,
        gst_show_on_summary: o.gst_show_on_summary !== false,
        gst_rate: toNumber(o.gst_rate),
        gst_amount: toNumber(o.gst_amount),
        taxable_amount: toNumber(o.taxable_amount),
        total: toNumber(o.total),
        delivery_time: o.delivery_time || null,
        customer_first_name: firstName(o.customer_name),
        phone_masked: maskPhone(o.customer_phone),
        address_masked: maskAddress(o.delivery_address),
        pincode: o.delivery_pincode || null,
        shipping: {
          courier_name: cleanText(o.courier_name || shipment?.provider) || null,
          awb,
          status: cleanText(shipment?.status || o.shipping_status) || null,
          tracking_link: trackingLink,
          events: (shipment ? eventsByShipment.get(shipment.id) || [] : []).map((e: any) => ({
            status_label: normalizeStatus(e.status),
            location: e.location || null,
            message: e.message || null,
            happened_at: e.happened_at || e.created_at,
          })),
        },
      };
    });

    return jsonResponse({ orders: result });
  } catch (error: any) {
    console.error("customer-order-lookup error:", error?.message || error);
    return jsonResponse({ error: "Unable to load orders. Please try again." }, 500);
  }
});
