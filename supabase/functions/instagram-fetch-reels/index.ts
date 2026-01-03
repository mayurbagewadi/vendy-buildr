import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Instagram Fetch Reels Edge Function
 *
 * Fetches Instagram Reels from connected accounts and caches them.
 * Also supports extracting embed data from manual reel URLs.
 *
 * Endpoints:
 * - GET ?store_id=xxx - Fetch reels for a store (from cache or API)
 * - POST ?action=refresh&store_id=xxx - Force refresh from Instagram API
 * - POST ?action=extract&url=xxx - Extract embed data from reel URL
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL = 3600000; // 1 hour cache

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const action = url.searchParams.get("action");
    const storeId = url.searchParams.get("store_id");

    // ============================================
    // ACTION: Extract embed data from manual URL
    // ============================================
    if (action === "extract") {
      const reelUrl = url.searchParams.get("url");
      if (!reelUrl) {
        return jsonResponse({ error: "url parameter required" }, 400);
      }
      const embedData = await extractReelEmbed(reelUrl);
      return jsonResponse(embedData);
    }

    // ============================================
    // GET: Fetch reels for store (from cache)
    // ============================================
    if (req.method === "GET" && storeId) {
      const reels = await getReelsForStore(supabase, storeId);
      return jsonResponse({ success: true, reels });
    }

    // ============================================
    // POST: Refresh reels from Instagram API
    // ============================================
    if (req.method === "POST" && action === "refresh" && storeId) {
      const result = await refreshReelsFromInstagram(supabase, storeId);
      return jsonResponse(result);
    }

    return jsonResponse({ error: "Invalid request" }, 400);

  } catch (error) {
    console.error("[Instagram Reels Error]", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

/**
 * Get reels for a store (cached + manual combined)
 */
async function getReelsForStore(supabase: any, storeId: string) {
  // Get store settings
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("instagram_reels_settings, instagram_business_id, instagram_access_token, instagram_connected")
    .eq("id", storeId)
    .single();

  if (storeError || !store) {
    console.log("[Get Reels] Store not found:", storeId);
    return [];
  }

  const settings = store.instagram_reels_settings || {};
  if (!settings.enabled) {
    return [];
  }

  const maxReels = settings.max_reels || 6;
  const displayMode = settings.display_mode || "auto";
  let reels: any[] = [];

  // Get auto-fetched reels from cache
  if (displayMode === "auto" || displayMode === "both") {
    // Check if cache is stale and Instagram is connected
    if (store.instagram_connected && store.instagram_access_token) {
      const { data: cachedReels } = await supabase
        .from("instagram_reels_cache")
        .select("*")
        .eq("store_id", storeId)
        .order("timestamp", { ascending: false })
        .limit(maxReels);

      if (cachedReels && cachedReels.length > 0) {
        // Check if cache is fresh
        const lastFetch = new Date(cachedReels[0].fetched_at).getTime();
        if (Date.now() - lastFetch > CACHE_TTL) {
          // Cache is stale, trigger background refresh
          console.log("[Get Reels] Cache stale, triggering refresh");
          // Don't await - let it run in background
          refreshReelsFromInstagram(supabase, storeId).catch(console.error);
        }
        reels = cachedReels.map(formatCachedReel);
      } else {
        // No cache, try to fetch
        console.log("[Get Reels] No cache, fetching from Instagram");
        await refreshReelsFromInstagram(supabase, storeId);
        const { data: freshReels } = await supabase
          .from("instagram_reels_cache")
          .select("*")
          .eq("store_id", storeId)
          .order("timestamp", { ascending: false })
          .limit(maxReels);
        reels = (freshReels || []).map(formatCachedReel);
      }
    }
  }

  // Add manual reels
  if (displayMode === "manual" || displayMode === "both") {
    const manualReels = settings.manual_reels || [];
    const formattedManual = manualReels.map((r: any) => ({
      id: r.url,
      type: "manual",
      permalink: r.url,
      thumbnail_url: r.thumbnail_url || null,
      caption: r.caption || "",
      added_at: r.added_at,
    }));

    if (displayMode === "manual") {
      reels = formattedManual;
    } else {
      // Combine and limit
      reels = [...reels, ...formattedManual];
    }
  }

  return reels.slice(0, maxReels);
}

/**
 * Refresh reels from Instagram API
 */
async function refreshReelsFromInstagram(supabase: any, storeId: string) {
  console.log("[Refresh Reels] Starting for store:", storeId);

  // Get store with Instagram credentials
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("instagram_business_id, instagram_access_token, instagram_connected")
    .eq("id", storeId)
    .single();

  if (storeError || !store) {
    return { success: false, error: "Store not found" };
  }

  if (!store.instagram_connected || !store.instagram_access_token) {
    return { success: false, error: "Instagram not connected" };
  }

  try {
    // Fetch media from Instagram Graph API
    // We fetch all media types and filter for reels
    const mediaUrl = `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,media_product_type&limit=50&access_token=${store.instagram_access_token}`;

    console.log("[Refresh Reels] Fetching from Instagram API");
    const response = await fetch(mediaUrl);
    const data = await response.json();

    if (data.error) {
      console.error("[Refresh Reels] Instagram API error:", data.error);
      return { success: false, error: data.error.message };
    }

    const mediaItems = data.data || [];
    console.log("[Refresh Reels] Fetched", mediaItems.length, "media items");

    // Filter for reels (VIDEO type with REELS product type) and regular videos
    const reels = mediaItems.filter((item: any) =>
      item.media_type === "VIDEO" &&
      (item.media_product_type === "REELS" || item.media_product_type === "FEED")
    );

    console.log("[Refresh Reels] Found", reels.length, "reels/videos");

    // Delete old cache for this store
    await supabase
      .from("instagram_reels_cache")
      .delete()
      .eq("store_id", storeId);

    // Insert new reels into cache
    if (reels.length > 0) {
      const cacheData = reels.map((reel: any) => ({
        store_id: storeId,
        instagram_id: store.instagram_business_id,
        media_id: reel.id,
        media_type: reel.media_product_type || reel.media_type,
        media_url: reel.media_url || null,
        thumbnail_url: reel.thumbnail_url || null,
        permalink: reel.permalink,
        caption: reel.caption || null,
        timestamp: reel.timestamp ? new Date(reel.timestamp).toISOString() : null,
        fetched_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("instagram_reels_cache")
        .insert(cacheData);

      if (insertError) {
        console.error("[Refresh Reels] Insert error:", insertError);
        return { success: false, error: "Failed to cache reels" };
      }
    }

    console.log("[Refresh Reels] Successfully cached", reels.length, "reels");
    return { success: true, count: reels.length };

  } catch (error) {
    console.error("[Refresh Reels] Fetch error:", error);
    return { success: false, error: "Failed to fetch from Instagram" };
  }
}

/**
 * Extract embed data from a reel URL using Instagram oEmbed
 */
async function extractReelEmbed(reelUrl: string) {
  try {
    // Validate URL format
    if (!reelUrl.includes("instagram.com/reel/") && !reelUrl.includes("instagram.com/p/")) {
      return { success: false, error: "Invalid Instagram URL. Use format: https://www.instagram.com/reel/xxx" };
    }

    // Use Instagram oEmbed API (no auth required for public posts)
    const oEmbedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(reelUrl)}&access_token=${Deno.env.get("INSTAGRAM_APP_ID")}|${Deno.env.get("INSTAGRAM_APP_SECRET")}`;

    const response = await fetch(oEmbedUrl);
    const data = await response.json();

    if (data.error) {
      // oEmbed might not work, return basic data
      return {
        success: true,
        data: {
          url: reelUrl,
          thumbnail_url: null,
          author_name: null,
          title: null,
        }
      };
    }

    return {
      success: true,
      data: {
        url: reelUrl,
        thumbnail_url: data.thumbnail_url || null,
        author_name: data.author_name || null,
        title: data.title || null,
        html: data.html || null,
      }
    };

  } catch (error) {
    console.error("[Extract Embed] Error:", error);
    return { success: false, error: "Failed to extract embed data" };
  }
}

/**
 * Format cached reel for response
 */
function formatCachedReel(reel: any) {
  return {
    id: reel.media_id,
    type: reel.media_type,
    media_url: reel.media_url,
    thumbnail_url: reel.thumbnail_url,
    permalink: reel.permalink,
    caption: reel.caption,
    timestamp: reel.timestamp,
  };
}

/**
 * Helper to return JSON response
 */
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
