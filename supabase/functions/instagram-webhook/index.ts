import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Instagram Webhook Edge Function
 *
 * Handles incoming Instagram events (messages, comments, mentions)
 * with SELF-HEALING capability for ID mismatches.
 *
 * PROBLEM: Instagram OAuth returns different IDs than webhooks use
 * - OAuth /me endpoint returns: Instagram-scoped User ID (e.g., 25860852140178848)
 * - Webhook events use: Instagram Business Account ID (e.g., 17841453881910183)
 *
 * SOLUTION: Self-healing auto-discovery
 * - When webhook receives unknown ID, verify against all connected stores
 * - Automatically update store's instagram_business_id when match found
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Webhook verification token - must match Facebook App configuration
const VERIFY_TOKEN = "digitaldukandar_verify_2024";

// Cache for store lookups to avoid repeated DB queries
const storeCache = new Map<string, any>();
const CACHE_TTL = 60000; // 1 minute cache

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ============================================
  // GET: Webhook Verification (Facebook Challenge)
  // ============================================
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("[Webhook Verification]", { mode, token: token?.substring(0, 10) + "..." });

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Webhook Verification] Success");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    } else {
      console.error("[Webhook Verification] Failed - Token mismatch");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // ============================================
  // POST: Receive Instagram Events
  // ============================================
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("[Webhook Event]", JSON.stringify(body, null, 2));

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (body.object === "instagram") {
        for (const entry of body.entry || []) {
          const instagramBusinessId = entry.id;

          // Process messaging events (DMs)
          for (const event of entry.messaging || []) {
            await processMessagingEvent(supabase, instagramBusinessId, event);
          }

          // Process change events (comments, mentions)
          for (const change of entry.changes || []) {
            await processChangeEvent(supabase, instagramBusinessId, change);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[Webhook Error]", error);
      return new Response(JSON.stringify({ error: "Processing error" }), {
        status: 200, // Return 200 to prevent Facebook retries
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

// ============================================
// Find Store with Self-Healing ID Discovery
// ============================================
async function findStoreByInstagramId(supabase: any, instagramBusinessId: string): Promise<any | null> {
  // Check cache first
  const cacheKey = `store_${instagramBusinessId}`;
  const cached = storeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("[Cache Hit] Found store in cache");
    return cached.store;
  }

  // Step 1: Direct lookup by instagram_business_id
  console.log("[Store Lookup] Searching for instagram_business_id:", instagramBusinessId);

  const { data: store, error } = await supabase
    .from("stores")
    .select("id, user_id, instagram_business_id, instagram_access_token, instagram_username, auto_reply_settings, comment_auto_reply_settings")
    .eq("instagram_business_id", instagramBusinessId)
    .eq("instagram_connected", true)
    .single();

  if (store && !error) {
    console.log("[Store Lookup] Found store:", store.id);
    storeCache.set(cacheKey, { store, timestamp: Date.now() });
    return store;
  }

  // Step 2: Self-Healing - Try to find and fix mismatched ID
  console.log("[Self-Healing] No direct match, attempting auto-discovery...");

  const healedStore = await attemptSelfHealing(supabase, instagramBusinessId);

  if (healedStore) {
    storeCache.set(cacheKey, { store: healedStore, timestamp: Date.now() });
    return healedStore;
  }

  console.log("[Store Lookup] No store found for ID:", instagramBusinessId);
  return null;
}

// ============================================
// Self-Healing: Auto-discover and fix ID mismatch
// ============================================
async function attemptSelfHealing(supabase: any, webhookInstagramId: string): Promise<any | null> {
  console.log("[Self-Healing] Checking all connected stores...");

  // Get all stores with Instagram connected
  const { data: connectedStores, error } = await supabase
    .from("stores")
    .select("id, instagram_business_id, instagram_access_token, instagram_username, auto_reply_settings, comment_auto_reply_settings")
    .eq("instagram_connected", true)
    .not("instagram_access_token", "is", null);

  if (error || !connectedStores?.length) {
    console.log("[Self-Healing] No connected stores found");
    return null;
  }

  console.log("[Self-Healing] Found", connectedStores.length, "connected stores to check");

  // For each store, verify if their token can access the webhook's Instagram ID
  for (const store of connectedStores) {
    try {
      // Try to fetch the Instagram account info using the store's token
      // If successful, this token belongs to this Instagram Business Account
      const verifyUrl = `https://graph.instagram.com/${webhookInstagramId}?fields=id,username&access_token=${store.instagram_access_token}`;

      console.log("[Self-Healing] Verifying store:", store.id, "against webhook ID:", webhookInstagramId);

      const response = await fetch(verifyUrl);
      const data = await response.json();

      if (!data.error && data.id) {
        // SUCCESS! This store's token can access this Instagram Business Account
        console.log("[Self-Healing] MATCH FOUND! Store:", store.id, "Username:", data.username);
        console.log("[Self-Healing] Old ID:", store.instagram_business_id, "→ New ID:", webhookInstagramId);

        // Update the store with the correct Instagram Business ID
        const { error: updateError } = await supabase
          .from("stores")
          .update({
            instagram_business_id: webhookInstagramId,
            instagram_username: data.username || store.instagram_username,
          })
          .eq("id", store.id);

        if (updateError) {
          console.error("[Self-Healing] Failed to update store:", updateError);
        } else {
          console.log("[Self-Healing] Successfully updated instagram_business_id for store:", store.id);

          // Return the store with updated ID
          return {
            ...store,
            instagram_business_id: webhookInstagramId,
            instagram_username: data.username || store.instagram_username,
          };
        }
      } else {
        console.log("[Self-Healing] Store", store.id, "token cannot access this Instagram account");
      }
    } catch (err) {
      console.error("[Self-Healing] Error verifying store:", store.id, err);
    }
  }

  console.log("[Self-Healing] No matching store found for webhook ID:", webhookInstagramId);
  return null;
}

// ============================================
// Process Direct Messages
// ============================================
async function processMessagingEvent(supabase: any, instagramBusinessId: string, event: any) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const timestamp = event.timestamp;

  console.log("[DM Event]", { senderId, recipientId, timestamp });

  // Skip echo messages (messages sent by the page itself)
  if (event.message?.is_echo) {
    console.log("[DM Event] Skipping echo message");
    return;
  }

  // Skip non-message events (read receipts, reactions, etc.)
  if (!event.message?.text) {
    console.log("[DM Event] Skipping non-text event");
    return;
  }

  const messageId = event.message.mid;
  const messageText = event.message.text;

  console.log("[DM Event] Message received:", { messageId, messageText: messageText?.substring(0, 50) });

  // Store the incoming message
  await storeMessage(supabase, {
    instagram_id: instagramBusinessId,
    sender_id: senderId,
    recipient_id: recipientId,
    message_id: messageId,
    message_text: messageText,
    timestamp: new Date(timestamp).toISOString(),
    direction: "incoming",
  });

  // Find store and handle auto-reply
  const store = await findStoreByInstagramId(supabase, instagramBusinessId);

  if (!store || !store.instagram_access_token) {
    console.log("[DM Event] No store found or no access token");
    return;
  }

  await handleAutoReply(supabase, store, senderId, messageText);
}

// ============================================
// Process Comments
// ============================================
async function processChangeEvent(supabase: any, instagramBusinessId: string, change: any) {
  const field = change.field;
  const value = change.value;

  console.log("[Change Event]", { field, value });

  if (field === "comments") {
    const commentId = value.id;
    const commentText = value.text;
    const fromId = value.from?.id;
    const fromUsername = value.from?.username;

    console.log("[Comment Event]", { commentId, commentText, fromUsername });

    // Store the comment
    try {
      await supabase.from("instagram_comments").insert({
        instagram_id: instagramBusinessId,
        comment_id: commentId,
        comment_text: commentText,
        from_id: fromId,
        from_username: fromUsername,
        media_id: value.media?.id,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      // Ignore duplicate key errors
      console.log("[Comment Event] Could not store comment (may be duplicate)");
    }

    // Find store and handle auto-reply
    const store = await findStoreByInstagramId(supabase, instagramBusinessId);

    if (!store || !store.instagram_access_token) {
      console.log("[Comment Event] No store found or no access token");
      return;
    }

    await handleCommentAutoReply(supabase, store, commentId, commentText, fromId, instagramBusinessId);
  }

  if (field === "mentions") {
    console.log("[Mention Event]", value);
  }
}

// ============================================
// Store Message in Database
// ============================================
async function storeMessage(supabase: any, messageData: any) {
  try {
    const { data, error } = await supabase
      .from("instagram_messages")
      .insert(messageData)
      .select();

    if (error) {
      console.error("[Store Message] Error:", error);
    } else {
      console.log("[Store Message] Success:", data?.[0]?.id);
    }
  } catch (err) {
    console.error("[Store Message] Exception:", err);
  }
}

// ============================================
// Handle DM Auto-Reply
// ============================================
async function handleAutoReply(supabase: any, store: any, senderId: string, messageText: string) {
  const settings = store.auto_reply_settings || {};

  if (!settings.enabled) {
    console.log("[Auto-Reply] Disabled for this store");
    return;
  }

  // Determine reply message
  let replyMessage = settings.default_message || "Thanks for your message! We'll get back to you soon.";

  // Check keyword rules
  const rules = settings.rules || [];
  const lowerMessage = (messageText || "").toLowerCase();

  for (const rule of rules) {
    const keywords = rule.keywords || [];
    if (keywords.some((keyword: string) => lowerMessage.includes(keyword.toLowerCase()))) {
      replyMessage = rule.reply;
      console.log("[Auto-Reply] Matched keyword rule");
      break;
    }
  }

  // Send auto-reply
  try {
    await sendInstagramMessage(store.instagram_access_token, senderId, replyMessage);

    // Store outgoing message
    await storeMessage(supabase, {
      instagram_id: store.instagram_business_id,
      sender_id: store.instagram_business_id,
      recipient_id: senderId,
      message_text: replyMessage,
      timestamp: new Date().toISOString(),
      direction: "outgoing",
      is_auto_reply: true,
    });

    console.log("[Auto-Reply] Sent:", replyMessage.substring(0, 50));
  } catch (err) {
    console.error("[Auto-Reply] Error:", err);
  }
}

// ============================================
// Handle Comment Auto-Reply
// ============================================
async function handleCommentAutoReply(
  supabase: any,
  store: any,
  commentId: string,
  commentText: string,
  fromId: string,
  instagramBusinessId: string
) {
  // IMPORTANT: Skip if comment is from the store's own account (prevent infinite loop)
  if (fromId === instagramBusinessId || fromId === store.instagram_business_id) {
    console.log("[Comment Auto-Reply] Skipping - comment from own account");
    return;
  }

  const settings = store.comment_auto_reply_settings || {};

  if (!settings.enabled) {
    console.log("[Comment Auto-Reply] Disabled for this store");
    return;
  }

  const replyText = settings.default_reply || "Thanks for your comment!";

  // Skip if comment text matches the auto-reply (additional safety)
  if (commentText === replyText) {
    console.log("[Comment Auto-Reply] Skipping - comment matches reply text");
    return;
  }

  try {
    await replyToComment(store.instagram_access_token, commentId, replyText);
    console.log("[Comment Auto-Reply] Sent");

    // Mark comment as replied
    await supabase
      .from("instagram_comments")
      .update({ replied: true })
      .eq("comment_id", commentId);
  } catch (err) {
    console.error("[Comment Auto-Reply] Error:", err);
  }
}

// ============================================
// Send Instagram Direct Message
// ============================================
async function sendInstagramMessage(accessToken: string, recipientId: string, message: string) {
  const url = "https://graph.instagram.com/v18.0/me/messages";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      access_token: accessToken,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    console.error("[Send Message] Error:", result);
    throw new Error(result.error?.message || "Failed to send message");
  }

  return result;
}

// ============================================
// Reply to Instagram Comment
// ============================================
async function replyToComment(accessToken: string, commentId: string, message: string) {
  const url = `https://graph.instagram.com/v18.0/${commentId}/replies`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message,
      access_token: accessToken,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    console.error("[Reply Comment] Error:", result);
    throw new Error(result.error?.message || "Failed to reply to comment");
  }

  return result;
}
