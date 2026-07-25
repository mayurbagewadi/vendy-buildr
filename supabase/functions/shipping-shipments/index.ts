import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DELHIVERY_BASE_URLS = {
  production: "https://track.delhivery.com",
  staging: "https://staging-express.delhivery.com",
} as const;

type Environment = keyof typeof DELHIVERY_BASE_URLS;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getCredentialSecret(): string {
  const secret = Deno.env.get("SHIPPING_CREDENTIALS_KEY");
  if (!secret || secret.trim().length < 32) {
    throw new Error("SHIPPING_CREDENTIALS_KEY must be set to at least 32 characters");
  }
  return secret.trim();
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(getCredentialSecret()));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["decrypt"]);
}

async function decryptSecret(value: string): Promise<string> {
  const [ivBase64, encryptedBase64] = value.split(".");
  if (!ivBase64 || !encryptedBase64) throw new Error("Invalid encrypted credential");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
    await getEncryptionKey(),
    base64ToBytes(encryptedBase64),
  );
  return new TextDecoder().decode(decrypted);
}

function normalizeEnvironment(environment: unknown): Environment {
  return environment === "staging" ? "staging" : "production";
}

function normalizePincode(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function cleanText(value: unknown, fallback = ""): string {
  return String(value || fallback)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 256);
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function isCOD(paymentMethod: unknown): boolean {
  const method = String(paymentMethod || "").toLowerCase();
  return method === "cod" || method.includes("cash on delivery");
}

function getItems(order: any): any[] {
  return Array.isArray(order.items) ? order.items.filter((item) => item && typeof item === "object") : [];
}

function getQuantity(order: any): number {
  return getItems(order).reduce((sum, item) => sum + Number(item.quantity || 1), 0) || 1;
}

function getProductsDescription(order: any): string {
  const names = getItems(order)
    .map((item) => cleanText(item.productName || item.name || item.product_name))
    .filter(Boolean);
  return (names.join(", ") || "Store order").slice(0, 256);
}

function extractWaybill(result: any): string | null {
  const pkg = Array.isArray(result?.packages) ? result.packages[0] : null;
  return (
    cleanText(pkg?.waybill) ||
    cleanText(pkg?.wbn) ||
    cleanText(pkg?.awb) ||
    cleanText(result?.waybill) ||
    cleanText(result?.wbn) ||
    cleanText(result?.awb) ||
    cleanText(result?.upload_wbn) ||
    null
  );
}

function extractProviderError(result: any): string {
  const pkg = Array.isArray(result?.packages) ? result.packages[0] : null;
  return (
    cleanText(pkg?.remarks) ||
    cleanText(pkg?.remark) ||
    cleanText(pkg?.error) ||
    cleanText(result?.rmk) ||
    cleanText(result?.error) ||
    cleanText(result?.message) ||
    "Delhivery shipment creation failed"
  );
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

function sanitizeShipment(row: any) {
  return {
    id: row.id,
    order_id: row.order_id,
    provider: row.provider,
    awb: row.awb,
    status: row.status,
    tracking_url: row.tracking_url,
    last_synced_at: row.last_synced_at,
    last_error: row.last_error,
  };
}

async function enforceRateLimit(
  supabase: any,
  storeId: string,
  userId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
) {
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await supabase
    .from("shipping_action_logs")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", cutoff);

  if (error) throw error;
  if ((count || 0) >= maxRequests) {
    return false;
  }

  await supabase.from("shipping_action_logs").insert({
    store_id: storeId,
    user_id: userId,
    action,
  });
  return true;
}

async function checkServiceability(apiToken: string, baseUrl: string, pincode: string) {
  const url = new URL("/c/api/pin-codes/json/", baseUrl);
  url.searchParams.set("filter_codes", pincode);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: "Token " + apiToken,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || body?.detail || "Delhivery pincode serviceability check failed");
  }

  if (Array.isArray(body?.delivery_codes) && body.delivery_codes.length === 0) {
    throw new Error(`Delhivery does not service delivery pincode ${pincode}`);
  }

  return body;
}

async function createDelhiveryOrder(apiToken: string, baseUrl: string, payload: Record<string, unknown>) {
  const body = new URLSearchParams();
  body.set("format", "json");
  body.set("data", JSON.stringify(payload));

  const response = await fetch(new URL("/api/cmu/create.json", baseUrl).toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Token " + apiToken,
    },
    body,
  });

  const text = await response.text();
  let result: any = null;
  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = { raw: text };
  }

  if (!response.ok) {
    throw new Error(extractProviderError(result));
  }

  const pkg = Array.isArray(result?.packages) ? result.packages[0] : null;
  const packageFailed = String(pkg?.status || "").toLowerCase() === "fail";
  if (result?.success === false || packageFailed) {
    throw new Error(extractProviderError(result));
  }

  return result;
}

function buildDelhiveryPayload(order: any, store: any, integration: any) {
  const pincode = normalizePincode(order.delivery_pincode);
  const storePincode = normalizePincode(store.postal_code);
  const cod = isCOD(order.payment_method);
  const sellerName = cleanText(store.name || integration.client_name || "Store");
  const sellerAddress = firstNonEmpty(store.street_address, store.address, store.city, sellerName);

  return {
    shipments: [
      {
        client: cleanText(integration.client_name),
        name: cleanText(order.customer_name, "Customer"),
        add: cleanText(order.delivery_address),
        pin: pincode,
        city: cleanText(order.delivery_city || ""),
        state: cleanText(order.delivery_state || ""),
        country: "India",
        phone: cleanText(order.customer_phone),
        order: cleanText(order.order_number || order.id),
        payment_mode: cod ? "COD" : "Pre-paid",
        products_desc: getProductsDescription(order),
        cod_amount: cod ? Number(order.total || 0) : 0,
        order_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 10),
        total_amount: Number(order.total || 0),
        seller_name: sellerName,
        seller_add: sellerAddress,
        seller_inv: cleanText(order.order_number || order.id),
        quantity: getQuantity(order),
        shipment_width: Number(store.package_breadth || 10),
        shipment_height: Number(store.package_height || 10),
        shipment_length: Number(store.package_length || 10),
        weight: Number(store.package_weight || 0.5),
        shipping_mode: "Surface",
        address_type: "home",
        return_name: sellerName,
        return_add: sellerAddress,
        return_city: cleanText(store.city || ""),
        return_state: cleanText(store.state || ""),
        return_country: cleanText(store.country || "India"),
        return_pin: storePincode || undefined,
        return_phone: cleanText(store.business_phone || store.whatsapp_number || ""),
      },
    ],
    pickup_location: {
      name: cleanText(integration.pickup_location),
    },
  };
}

async function loadOwnedOrderContext(supabase: any, userId: string, orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found");
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, user_id, name, business_phone, business_email, whatsapp_number, address, street_address, city, state, country, postal_code, package_length, package_breadth, package_height, package_weight")
    .eq("id", order.store_id)
    .eq("user_id", userId)
    .single();

  if (storeError || !store) {
    throw new Error("Order not found for this store");
  }

  return { order, store };
}

async function loadDelhiveryIntegration(supabase: any, storeId: string) {
  const { data: integration, error } = await supabase
    .from("store_shipping_integrations")
    .select("*")
    .eq("store_id", storeId)
    .eq("provider", "delhivery")
    .single();

  if (error || !integration) throw new Error("Delhivery is not connected");
  if (!integration.enabled || integration.status !== "connected") throw new Error("Delhivery is disabled or invalid");
  if (!integration.encrypted_api_token) throw new Error("Delhivery API token is missing");
  if (!cleanText(integration.client_name)) throw new Error("Delhivery client name is required");
  if (!cleanText(integration.pickup_location)) throw new Error("Delhivery pickup location name is required");

  return integration;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authToken = getBearerToken(req);
    if (!authToken) return jsonResponse({ error: "Missing authorization token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: userResult, error: userError } = await supabase.auth.getUser(authToken);
    if (userError || !userResult?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const action = body?.action;
    const orderId = body?.order_id;

    if (!orderId || !isValidUUID(orderId)) {
      return jsonResponse({ error: "Valid order_id is required" }, 400);
    }

    const { order, store } = await loadOwnedOrderContext(supabase, userResult.user.id, orderId);
    const integration = await loadDelhiveryIntegration(supabase, store.id);
    const apiToken = await decryptSecret(integration.encrypted_api_token);
    const environment = normalizeEnvironment(integration.environment);
    const baseUrl = DELHIVERY_BASE_URLS[environment];

    if (action === "create_delhivery_shipment") {
      const allowed = await enforceRateLimit(supabase, store.id, userResult.user.id, action, 8, 60);
      if (!allowed) return jsonResponse({ error: "Too many shipment creation attempts. Try again in a minute." }, 429);

      const { data: existing } = await supabase
        .from("shipments")
        .select("*")
        .eq("order_id", orderId)
        .eq("provider", "delhivery")
        .maybeSingle();

      if (existing?.awb) {
        return jsonResponse({ shipment: sanitizeShipment(existing), reused: true });
      }

      const deliveryPincode = normalizePincode(order.delivery_pincode);
      if (deliveryPincode.length !== 6) {
        throw new Error("Order delivery pincode must be 6 digits before creating a Delhivery shipment");
      }
      if (!cleanText(order.customer_phone) || !cleanText(order.delivery_address)) {
        throw new Error("Order phone and delivery address are required before creating a Delhivery shipment");
      }

      await checkServiceability(apiToken, baseUrl, deliveryPincode);
      const payload = buildDelhiveryPayload(order, store, integration);
      const result = await createDelhiveryOrder(apiToken, baseUrl, payload);
      const awb = extractWaybill(result);
      if (!awb) {
        throw new Error("Delhivery did not return an AWB number");
      }

      const trackingUrl = `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`;
      const shipmentRecord = {
        store_id: store.id,
        order_id: orderId,
        provider: "delhivery",
        external_order_id: cleanText(order.order_number || order.id),
        external_shipment_id: awb,
        awb,
        status: "manifested",
        tracking_url: trackingUrl,
        raw_response: result,
        idempotency_key: `${orderId}:delhivery:v1`,
        created_by: userResult.user.id,
        last_error: null,
      };

      const { data: shipment, error: shipmentError } = await supabase
        .from("shipments")
        .upsert(shipmentRecord, { onConflict: "order_id,provider" })
        .select("*")
        .single();

      if (shipmentError) throw shipmentError;

      await supabase.from("shipment_events").insert({
        shipment_id: shipment.id,
        status: "manifested",
        message: "Shipment manifested in Delhivery",
        raw_event: result,
      });

      await supabase
        .from("orders")
        .update({
          awb_code: awb,
          courier_name: "Delhivery",
          shipping_status: "manifested",
          tracking_url: trackingUrl,
          status: "processing",
        })
        .eq("id", orderId);

      return jsonResponse({ shipment: sanitizeShipment(shipment) });
    }

    if (action === "refresh_delhivery_tracking") {
      const allowed = await enforceRateLimit(supabase, store.id, userResult.user.id, action, 20, 60);
      if (!allowed) return jsonResponse({ error: "Too many tracking refreshes. Try again in a minute." }, 429);

      const { data: shipment, error: shipmentError } = await supabase
        .from("shipments")
        .select("*")
        .eq("order_id", orderId)
        .eq("provider", "delhivery")
        .single();

      if (shipmentError || !shipment?.awb) {
        throw new Error("No Delhivery shipment found for this order");
      }

      if (shipment.last_synced_at && Date.now() - new Date(shipment.last_synced_at).getTime() < 120000) {
        return jsonResponse({ shipment: sanitizeShipment(shipment), cached: true });
      }

      const url = new URL("/api/v1/packages/json/", baseUrl);
      url.searchParams.set("waybill", shipment.awb);
      url.searchParams.set("token", apiToken);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const tracking = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(tracking?.error || tracking?.detail || "Delhivery tracking request failed");
      }

      const providerShipment = tracking?.ShipmentData?.[0]?.Shipment || tracking?.Shipment || {};
      const statusPayload = providerShipment?.Status || tracking?.Status || {};
      const providerStatus = firstNonEmpty(statusPayload.Status, statusPayload.status, providerShipment.Status);
      const normalizedStatus = normalizeShipmentStatus(providerStatus);
      const happenedAt = statusPayload.StatusDateTime || statusPayload.status_date_time || new Date().toISOString();

      const { data: updatedShipment, error: updateError } = await supabase
        .from("shipments")
        .update({
          status: normalizedStatus,
          last_synced_at: new Date().toISOString(),
          last_error: null,
          raw_response: tracking,
        })
        .eq("id", shipment.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      await supabase.from("shipment_events").insert({
        shipment_id: shipment.id,
        status: normalizedStatus,
        location: cleanText(statusPayload.StatusLocation || statusPayload.location),
        message: firstNonEmpty(statusPayload.Instructions, statusPayload.Status, providerStatus),
        happened_at: happenedAt,
        raw_event: statusPayload || tracking,
      });

      await supabase
        .from("orders")
        .update({
          shipping_status: normalizedStatus,
          status: normalizedStatus === "delivered" ? "delivered" : order.status === "new" ? "processing" : order.status,
          tracking_url: shipment.tracking_url,
        })
        .eq("id", orderId);

      return jsonResponse({ shipment: sanitizeShipment(updatedShipment) });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error: any) {
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
