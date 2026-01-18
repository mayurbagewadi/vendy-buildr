import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SHIPROCKET_API_BASE = "https://apiv2.shiprocket.in/v1/external";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, password, token, data } = await req.json();

    let response;

    switch (action) {
      case "login":
        response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        break;

      case "get_pickup_locations":
        response = await fetch(`${SHIPROCKET_API_BASE}/settings/company/pickup`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        break;

      case "create_order":
        response = await fetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });
        break;

      case "get_couriers":
        const params = new URLSearchParams({
          pickup_postcode: data.pickup_postcode,
          delivery_postcode: data.delivery_postcode,
          weight: data.weight.toString(),
          cod: data.cod ? "1" : "0",
        });
        response = await fetch(
          `${SHIPROCKET_API_BASE}/courier/serviceability/?${params}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        break;

      case "generate_awb":
        response = await fetch(`${SHIPROCKET_API_BASE}/courier/assign/awb`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            shipment_id: data.shipment_id,
            courier_id: data.courier_id,
          }),
        });
        break;

      case "get_tracking":
        response = await fetch(
          `${SHIPROCKET_API_BASE}/courier/track/awb/${data.awb_code}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        break;

      case "request_pickup":
        response = await fetch(`${SHIPROCKET_API_BASE}/courier/generate/pickup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ shipment_id: [data.shipment_id] }),
        });
        break;

      case "cancel_shipment":
        response = await fetch(`${SHIPROCKET_API_BASE}/orders/cancel/shipment/awbs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ awbs: data.awbs }),
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
