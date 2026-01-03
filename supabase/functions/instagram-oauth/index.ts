import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Instagram OAuth Edge Function
 *
 * Handles Instagram Business Login OAuth flow:
 * - Connect: Initiates OAuth redirect to Instagram
 * - Callback: Exchanges code for token and saves to database
 * - Refresh: Refreshes expiring tokens
 * - Disconnect: Removes Instagram connection
 *
 * IMPORTANT: Uses userData.id from /me API (not tokenData.user_id)
 * because webhook events use the Instagram Business Account ID,
 * which is different from the OAuth user_id.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Environment variables from Supabase secrets
const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID")!;
const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://digitaldukandar.in";

// Redirect URI - must EXACTLY match Facebook App configuration
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/instagram-oauth`;

// OAuth scopes for Instagram Business
const OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    const action = url.searchParams.get("action");

    // ============================================
    // ACTION: Connect - Initiate OAuth Flow
    // ============================================
    if (action === "connect") {
      return handleConnect(url);
    }

    // ============================================
    // ACTION: Refresh Token
    // ============================================
    if (action === "refresh") {
      return await handleRefreshToken(url);
    }

    // ============================================
    // ACTION: Disconnect Instagram
    // ============================================
    if (action === "disconnect") {
      return await handleDisconnect(url);
    }

    // ============================================
    // ACTION: Deauthorize Callback (from Facebook)
    // ============================================
    if (action === "deauthorize") {
      return handleDeauthorize(req);
    }

    // ============================================
    // ACTION: Data Deletion Request (from Facebook)
    // ============================================
    if (action === "delete-data") {
      return handleDataDeletion(req);
    }

    // ============================================
    // OAuth Callback - Exchange code for token
    // ============================================
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("[OAuth Error]", error, url.searchParams.get("error_description"));
      return redirectWithMessage("error", "Instagram authorization was denied");
    }

    if (code && state) {
      return await handleOAuthCallback(code, state);
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[Unhandled Error]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Initiates OAuth flow by redirecting to Instagram authorization
 */
function handleConnect(url: URL): Response {
  const storeId = url.searchParams.get("store_id");

  if (!storeId) {
    return new Response(JSON.stringify({ error: "store_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[Connect] Initiating OAuth for store:", storeId);

  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", INSTAGRAM_APP_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", OAUTH_SCOPES);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", storeId);

  return Response.redirect(authUrl.toString(), 302);
}

/**
 * Handles OAuth callback - exchanges code for token and saves connection
 */
async function handleOAuthCallback(code: string, storeId: string): Promise<Response> {
  console.log("[OAuth Callback] Processing for store:", storeId);

  // Step 1: Exchange authorization code for short-lived token
  console.log("[Step 1] Exchanging code for short-lived token");
  const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code: code,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error_message || tokenData.error) {
    console.error("[Token Exchange Error]", tokenData);
    return redirectWithMessage("error", tokenData.error_message || "Failed to get access token");
  }

  const shortLivedToken = tokenData.access_token;
  console.log("[Step 1 Complete] Got short-lived token, OAuth user_id:", tokenData.user_id);

  // Step 2: Exchange for long-lived token (60 days validity)
  console.log("[Step 2] Exchanging for long-lived token");
  const longLivedResponse = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
  );

  const longLivedData = await longLivedResponse.json();

  if (longLivedData.error) {
    console.error("[Long-lived Token Error]", longLivedData);
    // Continue with short-lived token if long-lived fails
  }

  const accessToken = longLivedData.access_token || shortLivedToken;
  const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  console.log("[Step 2 Complete] Token expires:", tokenExpiry);

  // Step 3: Get Instagram Business Account info from /me endpoint
  // CRITICAL: This returns the correct instagram_business_id that webhooks use
  console.log("[Step 3] Fetching Instagram Business Account info from /me");
  const userResponse = await fetch(
    `https://graph.instagram.com/me?fields=id,username,account_type,name&access_token=${accessToken}`
  );

  const userData = await userResponse.json();

  if (userData.error) {
    console.error("[User Data Error]", userData);
    return redirectWithMessage("error", "Failed to get Instagram account info");
  }

  // IMPORTANT: Use userData.id (Instagram Business Account ID), NOT tokenData.user_id
  // The webhook events use this ID to identify the account
  const instagramBusinessId = userData.id;
  const instagramUsername = userData.username;

  console.log("[Step 3 Complete] Instagram Business Account:", {
    id: instagramBusinessId,
    username: instagramUsername,
    accountType: userData.account_type,
    // Log both IDs to show the difference
    oauthUserId: tokenData.user_id,
    businessAccountId: userData.id,
  });

  // Validate that we got the business account ID
  if (!instagramBusinessId) {
    console.error("[Validation Error] No Instagram Business Account ID received");
    return redirectWithMessage("error", "Could not retrieve Instagram Business Account ID");
  }

  // Step 4: Save to database
  console.log("[Step 4] Saving to database");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error: updateError } = await supabase
    .from("stores")
    .update({
      instagram_business_id: instagramBusinessId.toString(),
      instagram_access_token: accessToken,
      instagram_token_expiry: tokenExpiry,
      instagram_username: instagramUsername || null,
      instagram_connected: true,
    })
    .eq("id", storeId);

  if (updateError) {
    console.error("[Database Error]", updateError);
    return redirectWithMessage("error", "Failed to save Instagram connection");
  }

  console.log("[Success] Instagram connected for store:", storeId, "Business ID:", instagramBusinessId);
  return redirectWithMessage("success", "Instagram connected successfully!");
}

/**
 * Refreshes an expiring access token
 */
async function handleRefreshToken(url: URL): Promise<Response> {
  const storeId = url.searchParams.get("store_id");

  if (!storeId) {
    return new Response(JSON.stringify({ error: "store_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[Refresh] Refreshing token for store:", storeId);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get current token
  const { data: store, error: fetchError } = await supabase
    .from("stores")
    .select("instagram_access_token")
    .eq("id", storeId)
    .single();

  if (fetchError || !store?.instagram_access_token) {
    console.error("[Refresh Error] No token found:", fetchError);
    return new Response(JSON.stringify({ error: "No token found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Refresh the token
  const refreshResponse = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${store.instagram_access_token}`
  );

  const refreshData = await refreshResponse.json();

  if (refreshData.error) {
    console.error("[Refresh Error]", refreshData);
    return new Response(JSON.stringify({ error: refreshData.error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  // Update database
  const { error: updateError } = await supabase
    .from("stores")
    .update({
      instagram_access_token: refreshData.access_token,
      instagram_token_expiry: newExpiry,
    })
    .eq("id", storeId);

  if (updateError) {
    console.error("[Refresh DB Error]", updateError);
  }

  console.log("[Refresh Success] New expiry:", newExpiry);
  return new Response(JSON.stringify({ success: true, expires_at: newExpiry }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Disconnects Instagram from a store
 */
async function handleDisconnect(url: URL): Promise<Response> {
  const storeId = url.searchParams.get("store_id");

  if (!storeId) {
    return new Response(JSON.stringify({ error: "store_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[Disconnect] Disconnecting Instagram for store:", storeId);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error: updateError } = await supabase
    .from("stores")
    .update({
      instagram_business_id: null,
      instagram_access_token: null,
      instagram_token_expiry: null,
      instagram_username: null,
      instagram_connected: false,
    })
    .eq("id", storeId);

  if (updateError) {
    console.error("[Disconnect Error]", updateError);
  }

  console.log("[Disconnect Success]");
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Handles deauthorization callback from Facebook
 * Called when user removes the app from their Instagram settings
 */
async function handleDeauthorize(req: Request): Promise<Response> {
  console.log("[Deauthorize] Received deauthorization callback");

  try {
    const body = await req.json();
    console.log("[Deauthorize] Payload:", body);

    // Facebook sends signed_request with user_id
    // In production, you should verify the signed_request and remove the user's data

  } catch (err) {
    console.error("[Deauthorize Error]", err);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Handles data deletion request callback from Facebook
 * Required for GDPR/CCPA compliance
 */
async function handleDataDeletion(req: Request): Promise<Response> {
  console.log("[Data Deletion] Received data deletion request");

  try {
    const body = await req.json();
    console.log("[Data Deletion] Payload:", body);

    // Facebook requires a confirmation_code and a URL to check deletion status
    // In production, implement actual data deletion and tracking

    const confirmationCode = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const statusUrl = `${FRONTEND_URL}/data-deletion-status?code=${confirmationCode}`;

    return new Response(JSON.stringify({
      url: statusUrl,
      confirmation_code: confirmationCode
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[Data Deletion Error]", err);
    return new Response(JSON.stringify({ error: "Processing error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

/**
 * Helper function to redirect with status message
 */
function redirectWithMessage(status: string, message: string): Response {
  const redirectUrl = `${FRONTEND_URL}/admin/growth/instagram?status=${status}&message=${encodeURIComponent(message)}`;
  return Response.redirect(redirectUrl, 302);
}
