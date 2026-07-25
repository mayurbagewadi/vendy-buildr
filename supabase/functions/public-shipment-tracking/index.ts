import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeAwb(value: unknown): string {
  return cleanText(value).replace(/[^\w-]/g, "").slice(0, 64);
}

function normalizeStatus(value: unknown): string {
  return cleanText(value || "manifested").replace(/_/g, " ");
}

function officialTrackingUrl(awb: string): string {
  return `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`;
}

function customerTrackingUrl(store: any, awb: string): string {
  const encodedAwb = encodeURIComponent(awb);
  const customDomain = cleanText(store?.custom_domain);
  if (customDomain && store?.custom_domain_verified) {
    return `https://${customDomain}/track/${encodedAwb}`;
  }

  const subdomain = cleanText(store?.subdomain);
  if (subdomain) {
    return `https://${subdomain}.digitaldukandar.in/track/${encodedAwb}`;
  }

  const slug = cleanText(store?.slug);
  if (slug) {
    return `https://digitaldukandar.in/${encodeURIComponent(slug)}/track/${encodedAwb}`;
  }

  return officialTrackingUrl(awb);
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
    const awb = normalizeAwb(body?.awb);
    const storeId = cleanText(body?.store_id);

    if (!awb) {
      return jsonResponse({ error: "AWB is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let shipmentQuery = supabase
      .from("shipments")
      .select(`
        id,
        store_id,
        provider,
        awb,
        status,
        tracking_url,
        last_synced_at,
        updated_at,
        orders (
          order_number,
          created_at
        ),
        stores (
          id,
          name,
          slug,
          subdomain,
          custom_domain,
          custom_domain_verified,
          logo_url
        )
      `)
      .eq("provider", "delhivery")
      .eq("awb", awb);

    if (storeId) {
      shipmentQuery = shipmentQuery.eq("store_id", storeId);
    }

    const { data: shipment, error: shipmentError } = await shipmentQuery.maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment) {
      return jsonResponse({ error: "Shipment not found" }, 404);
    }

    const { data: events, error: eventsError } = await supabase
      .from("shipment_events")
      .select("status, location, message, happened_at, created_at")
      .eq("shipment_id", shipment.id)
      .order("happened_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(8);

    if (eventsError) throw eventsError;

    const order = Array.isArray(shipment.orders) ? shipment.orders[0] : shipment.orders;
    const store = Array.isArray(shipment.stores) ? shipment.stores[0] : shipment.stores;

    return jsonResponse({
      shipment: {
        provider: shipment.provider,
        awb: shipment.awb,
        status: shipment.status,
        status_label: normalizeStatus(shipment.status),
        customer_tracking_url: customerTrackingUrl(store, shipment.awb),
        official_tracking_url: officialTrackingUrl(shipment.awb),
        last_synced_at: shipment.last_synced_at || shipment.updated_at,
        order_number: order?.order_number || null,
        order_date: order?.created_at || null,
        store: store
          ? {
              name: store.name,
              slug: store.slug,
              logo_url: store.logo_url,
            }
          : null,
        events: (events || []).map((event: any) => ({
          status: event.status,
          status_label: normalizeStatus(event.status),
          location: event.location,
          message: event.message,
          happened_at: event.happened_at || event.created_at,
        })),
      },
    });
  } catch (error: any) {
    return jsonResponse({ error: error.message || "Unable to load tracking" }, 500);
  }
});
