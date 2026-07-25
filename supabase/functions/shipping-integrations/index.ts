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

type Provider = "delhivery";
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

function normalizeToken(token: string): string {
  return token.replace(/^Token\s+/i, "").trim();
}

function normalizeEnvironment(environment: unknown): Environment {
  return environment === "staging" ? "staging" : "production";
}

function getCredentialSecret(): string {
  const secret = Deno.env.get("SHIPPING_CREDENTIALS_KEY");
  if (!secret || secret.trim().length < 32) {
    throw new Error("SHIPPING_CREDENTIALS_KEY must be set to at least 32 characters");
  }
  return secret.trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = getCredentialSecret();
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)),
  );
  return bytesToBase64(iv) + "." + bytesToBase64(encrypted);
}

async function decryptSecret(value: string): Promise<string> {
  const [ivBase64, encryptedBase64] = value.split(".");
  if (!ivBase64 || !encryptedBase64) throw new Error("Invalid encrypted credential");
  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
    key,
    base64ToBytes(encryptedBase64),
  );
  return new TextDecoder().decode(decrypted);
}

function sanitizeIntegration(row: any) {
  return {
    id: row.id,
    store_id: row.store_id,
    provider: row.provider,
    environment: row.environment,
    display_name: row.display_name,
    token_last4: row.token_last4,
    auth_scheme: row.auth_scheme,
    client_name: row.client_name,
    pickup_location: row.pickup_location,
    enabled: row.enabled,
    status: row.status,
    last_tested_at: row.last_tested_at,
    last_error: row.last_error,
    settings: row.settings || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function testDelhiveryToken(token: string, environment: Environment) {
  const url = new URL("/c/api/pin-codes/json/", DELHIVERY_BASE_URLS[environment]);
  url.searchParams.set("filter_codes", "110001");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Token " + token,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }

    if (response.status === 401) {
      return { success: false, error: "Invalid Delhivery API token", details: body };
    }

    if (!response.ok) {
      return {
        success: false,
        error: body?.error || body?.detail || "Delhivery test request failed",
        details: body,
      };
    }

    return { success: true, details: body };
  } catch (error: any) {
    return {
      success: false,
      error: error?.name === "AbortError" ? "Delhivery test request timed out" : error.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return jsonResponse({ error: "Missing authorization token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResult?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const action = body?.action;
    const storeId = body?.store_id;

    if (!storeId || !isValidUUID(storeId)) {
      return jsonResponse({ error: "Valid store_id is required" }, 400);
    }

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .eq("user_id", userResult.user.id)
      .single();

    if (storeError || !store) {
      return jsonResponse({ error: "Store not found" }, 404);
    }

    if (action === "get_integrations") {
      const { data, error } = await supabase
        .from("store_shipping_integrations")
        .select("*")
        .eq("store_id", storeId)
        .order("provider");

      if (error) throw error;
      return jsonResponse({ integrations: (data || []).map(sanitizeIntegration) });
    }

    if (action === "save_delhivery_token") {
      const rawApiToken = body?.api_token;
      if (!rawApiToken || typeof rawApiToken !== "string") {
        return jsonResponse({ error: "Delhivery API token is required" }, 400);
      }

      const apiToken = normalizeToken(rawApiToken);
      if (apiToken.length < 8 || apiToken.length > 256) {
        return jsonResponse({ error: "Delhivery API token length looks invalid" }, 400);
      }

      const environment = normalizeEnvironment(body?.environment);
      const testResult = await testDelhiveryToken(apiToken, environment);
      if (!testResult.success) {
        return jsonResponse({ error: testResult.error, details: testResult.details }, 400);
      }

      const encryptedToken = await encryptSecret(apiToken);
      const tokenLast4 = apiToken.slice(-4);

      const { data, error } = await supabase
        .from("store_shipping_integrations")
        .upsert(
          {
            store_id: storeId,
            provider: "delhivery" satisfies Provider,
            environment,
            display_name: "Delhivery",
            encrypted_api_token: encryptedToken,
            token_last4: tokenLast4,
            auth_scheme: "Token",
            client_name: body?.client_name?.trim() || null,
            pickup_location: body?.pickup_location?.trim() || null,
            enabled: true,
            status: "connected",
            last_tested_at: new Date().toISOString(),
            last_error: null,
            settings: {},
          },
          { onConflict: "store_id,provider" },
        )
        .select("*")
        .single();

      if (error) throw error;
      return jsonResponse({ integration: sanitizeIntegration(data) });
    }

    if (action === "test_provider") {
      const provider = body?.provider;
      if (provider !== "delhivery") return jsonResponse({ error: "Unsupported provider" }, 400);

      const { data: integration, error } = await supabase
        .from("store_shipping_integrations")
        .select("*")
        .eq("store_id", storeId)
        .eq("provider", provider)
        .single();

      if (error || !integration?.encrypted_api_token) {
        return jsonResponse({ error: "Delhivery is not connected" }, 404);
      }

      const apiToken = await decryptSecret(integration.encrypted_api_token);
      const environment = normalizeEnvironment(integration.environment);
      const testResult = await testDelhiveryToken(apiToken, environment);

      const { data, error: updateError } = await supabase
        .from("store_shipping_integrations")
        .update({
          status: testResult.success ? "connected" : "invalid",
          last_tested_at: new Date().toISOString(),
          last_error: testResult.success ? null : testResult.error,
        })
        .eq("id", integration.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      if (!testResult.success) {
        return jsonResponse({ error: testResult.error, integration: sanitizeIntegration(data) }, 400);
      }

      return jsonResponse({ integration: sanitizeIntegration(data), details: testResult.details });
    }

    if (action === "toggle_provider") {
      const provider = body?.provider;
      if (provider !== "delhivery") return jsonResponse({ error: "Unsupported provider" }, 400);

      const enabled = Boolean(body?.enabled);
      const { data, error } = await supabase
        .from("store_shipping_integrations")
        .update({
          enabled,
          status: enabled ? "connected" : "disabled",
        })
        .eq("store_id", storeId)
        .eq("provider", provider)
        .select("*")
        .single();

      if (error) throw error;
      return jsonResponse({ integration: sanitizeIntegration(data) });
    }

    if (action === "disconnect_provider") {
      const provider = body?.provider;
      if (provider !== "delhivery") return jsonResponse({ error: "Unsupported provider" }, 400);

      const { error } = await supabase
        .from("store_shipping_integrations")
        .delete()
        .eq("store_id", storeId)
        .eq("provider", provider);

      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error: any) {
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
