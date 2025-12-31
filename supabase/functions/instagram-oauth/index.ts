import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get these from Supabase secrets
const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID")!;
const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Redirect URI - must match what's configured in Facebook App
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/instagram-oauth`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    // ============================================
    // Step 1: Initiate OAuth - Redirect to Instagram
    // ============================================
    if (url.searchParams.get("action") === "connect") {
      const storeId = url.searchParams.get("store_id");

      if (!storeId) {
        return new Response(JSON.stringify({ error: "store_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Instagram OAuth URL
      const authUrl = new URL("https://www.instagram.com/oauth/authorize");
      authUrl.searchParams.set("client_id", INSTAGRAM_APP_ID);
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", storeId); // Pass store_id in state

      return Response.redirect(authUrl.toString(), 302);
    }

    // ============================================
    // Step 2: OAuth Callback - Exchange code for token
    // ============================================
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // store_id
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error, url.searchParams.get("error_description"));
      return redirectWithMessage("error", "Instagram authorization was denied");
    }

    if (code && state) {
      const storeId = state;

      // Exchange code for short-lived token
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
      console.log("Token response:", tokenData);

      if (tokenData.error_message) {
        console.error("Token error:", tokenData);
        return redirectWithMessage("error", tokenData.error_message);
      }

      const shortLivedToken = tokenData.access_token;
      const instagramUserId = tokenData.user_id;

      // Exchange for long-lived token (60 days)
      const longLivedResponse = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
      );

      const longLivedData = await longLivedResponse.json();
      console.log("Long-lived token response:", longLivedData);

      const longLivedToken = longLivedData.access_token || shortLivedToken;
      const expiresIn = longLivedData.expires_in || 5184000; // 60 days default

      // Calculate expiry date
      const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Get Instagram Business Account info
      const userResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username,account_type,name&access_token=${longLivedToken}`
      );
      const userData = await userResponse.json();
      console.log("User data:", userData);

      // Save to database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error: updateError } = await supabase
        .from("stores")
        .update({
          instagram_business_id: instagramUserId.toString(),
          instagram_access_token: longLivedToken,
          instagram_token_expiry: tokenExpiry,
          instagram_username: userData.username || null,
          instagram_connected: true,
        })
        .eq("id", storeId);

      if (updateError) {
        console.error("Database update error:", updateError);
        return redirectWithMessage("error", "Failed to save Instagram connection");
      }

      console.log("Instagram connected successfully for store:", storeId);
      return redirectWithMessage("success", "Instagram connected successfully!");
    }

    // ============================================
    // Step 3: Refresh Token (called before expiry)
    // ============================================
    if (url.searchParams.get("action") === "refresh") {
      const storeId = url.searchParams.get("store_id");

      if (!storeId) {
        return new Response(JSON.stringify({ error: "store_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get current token
      const { data: store, error: fetchError } = await supabase
        .from("stores")
        .select("instagram_access_token")
        .eq("id", storeId)
        .single();

      if (fetchError || !store?.instagram_access_token) {
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
        return new Response(JSON.stringify({ error: refreshData.error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

      // Update database
      await supabase
        .from("stores")
        .update({
          instagram_access_token: refreshData.access_token,
          instagram_token_expiry: newExpiry,
        })
        .eq("id", storeId);

      return new Response(JSON.stringify({ success: true, expires_at: newExpiry }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // Step 4: Disconnect Instagram
    // ============================================
    if (url.searchParams.get("action") === "disconnect") {
      const storeId = url.searchParams.get("store_id");

      if (!storeId) {
        return new Response(JSON.stringify({ error: "store_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      await supabase
        .from("stores")
        .update({
          instagram_business_id: null,
          instagram_access_token: null,
          instagram_token_expiry: null,
          instagram_username: null,
          instagram_connected: false,
        })
        .eq("id", storeId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper function to redirect with message
function redirectWithMessage(status: string, message: string) {
  const baseUrl = Deno.env.get("FRONTEND_URL") || "https://digitaldukandar.in";
  const redirectUrl = `${baseUrl}/admin/growth/instagram?status=${status}&message=${encodeURIComponent(message)}`;
  return Response.redirect(redirectUrl, 302);
}
