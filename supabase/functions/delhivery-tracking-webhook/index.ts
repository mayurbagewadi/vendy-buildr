import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-delhivery-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, max = 256): string {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function normalizeShipmentStatus(value: unknown): string {
  const status = String(value || "").toLowerCase();
  if (status.includes("delivered")) return "delivered";
  if (status.includes("out for delivery") || status === "ofd") return "out_for_delivery";
  if (status.includes("rto")) return "rto_initiated";
  if (status.includes("return")) return "returned";
  if (status.includes("picked")) return "picked_up";
  if (status.includes("transit") || status.includes("dispatched") || status.includes("shipped")) return "in_transit";
  if (status.includes("manifest")) return "manifested";
  if (status.includes("fail") || status.includes("ndr")) return "failed";
  if (status.includes("cancel")) return "cancelled";
  return "manifested";
}

function verifyWebhookSecret(req: Request): boolean {
  const expected = Deno.env.get("DELHIVERY_WEBHOOK_SECRET")?.trim();
  if (!expected || expected.length < 16) return false;

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const candidates = [
    req.headers.get("x-delhivery-webhook-secret"),
    req.headers.get("x-webhook-secret"),
    bearer,
    new URL(req.url).searchParams.get("secret"),
  ].map((value) => value?.trim()).filter(Boolean);

  return candidates.some((value) => value === expected);
}

function getShipmentPayloads(payload: any): any[] {
  if (Array.isArray(payload)) return payload.flatMap(getShipmentPayloads);
  if (!payload || typeof payload !== "object") return [];
  if (payload.Shipment) return getShipmentPayloads(payload.Shipment);
  if (Array.isArray(payload.ShipmentData)) return payload.ShipmentData.flatMap(getShipmentPayloads);
  if (payload.AWB || payload.waybill || payload.wbn || payload.Status) return [payload];
  return [];
}

function parseScan(scan: any) {
  const statusPayload = scan?.Status || {};
  const awb = firstNonEmpty(scan?.AWB, scan?.awb, scan?.waybill, scan?.wbn);
  const providerStatus = firstNonEmpty(statusPayload.Status, statusPayload.status, scan?.status);
  const normalizedStatus = normalizeShipmentStatus(providerStatus);
  const location = firstNonEmpty(statusPayload.StatusLocation, statusPayload.location, scan?.location);
  const message = firstNonEmpty(statusPayload.Instructions, statusPayload.Status, scan?.instructions, providerStatus);
  const happenedAt = firstNonEmpty(statusPayload.StatusDateTime, statusPayload.status_date_time, scan?.status_date_time, scan?.updated_at) || new Date().toISOString();
  const eventKey = [awb, normalizedStatus, happenedAt, location, message].join("|").slice(0, 512);

  return { awb, normalizedStatus, providerStatus, location, message, happenedAt, eventKey };
}

async function processScan(supabase: any, payload: any) {
  const scan = parseScan(payload);
  if (!scan.awb) {
    await supabase.from("shipping_webhook_events").insert({
      provider: "delhivery",
      processed: false,
      error: "Missing AWB in webhook payload",
      raw_payload: payload,
    });
    return { processed: false, error: "Missing AWB" };
  }

  const { data: shipment, error: shipmentError } = await supabase
    .from("shipments")
    .select("id, store_id, order_id, status")
    .eq("provider", "delhivery")
    .eq("awb", scan.awb)
    .maybeSingle();

  if (shipmentError) throw shipmentError;

  if (!shipment) {
    await supabase.from("shipping_webhook_events").insert({
      provider: "delhivery",
      awb: scan.awb,
      event_status: scan.normalizedStatus,
      event_key: scan.eventKey,
      processed: false,
      error: "Shipment not found",
      raw_payload: payload,
    });
    return { processed: false, error: "Shipment not found", awb: scan.awb };
  }

  const { data: updatedShipment, error: updateError } = await supabase
    .from("shipments")
    .update({
      status: scan.normalizedStatus,
      last_synced_at: new Date().toISOString(),
      last_error: null,
      raw_response: payload,
      cancelled_at: scan.normalizedStatus === "cancelled" ? new Date().toISOString() : undefined,
    })
    .eq("id", shipment.id)
    .select("id, store_id, order_id")
    .single();

  if (updateError) throw updateError;

  await supabase.from("shipment_events").upsert(
    {
      shipment_id: shipment.id,
      status: scan.normalizedStatus,
      location: scan.location || null,
      message: scan.message || null,
      happened_at: scan.happenedAt,
      raw_event: payload,
      event_key: scan.eventKey,
    },
    { onConflict: "shipment_id,event_key" },
  );

  await supabase
    .from("orders")
    .update({
      shipping_status: scan.normalizedStatus,
      status: scan.normalizedStatus === "delivered"
        ? "delivered"
        : scan.normalizedStatus === "cancelled"
          ? "cancelled"
          : "processing",
    })
    .eq("id", shipment.order_id);

  await supabase.from("shipping_webhook_events").insert({
    provider: "delhivery",
    store_id: updatedShipment.store_id,
    shipment_id: updatedShipment.id,
    awb: scan.awb,
    event_status: scan.normalizedStatus,
    event_key: scan.eventKey,
    processed: true,
    processed_at: new Date().toISOString(),
    raw_payload: payload,
  });

  return { processed: true, awb: scan.awb, status: scan.normalizedStatus };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!verifyWebhookSecret(req)) {
    return jsonResponse({ error: "Unauthorized webhook" }, 401);
  }

  try {
    const payload = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const scans = getShipmentPayloads(payload);
    if (scans.length === 0) {
      await supabase.from("shipping_webhook_events").insert({
        provider: "delhivery",
        processed: false,
        error: "No shipment scans found",
        raw_payload: payload,
      });
      return jsonResponse({ success: true, processed: 0 });
    }

    const results = [];
    for (const scan of scans) {
      results.push(await processScan(supabase, scan));
    }

    return jsonResponse({ success: true, processed: results.filter((item) => item.processed).length, results });
  } catch (error: any) {
    return jsonResponse({ error: error.message || "Webhook processing failed" }, 500);
  }
});
