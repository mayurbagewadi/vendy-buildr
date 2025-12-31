import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Your verify token - CHANGE THIS to match what you enter in Facebook Dashboard
const VERIFY_TOKEN = "digitaldukandar_verify_2024";

serve(async (req) => {
  // Handle CORS preflight
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

    console.log("Webhook verification request:", { mode, token, challenge });

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully!");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    } else {
      console.error("Webhook verification failed. Token mismatch.");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // ============================================
  // POST: Receive Instagram Messages/Events
  // ============================================
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Received webhook event:", JSON.stringify(body, null, 2));

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Process Instagram messaging events
      if (body.object === "instagram") {
        for (const entry of body.entry || []) {
          const instagramId = entry.id;
          const time = entry.time;

          // Process messaging events
          for (const messagingEvent of entry.messaging || []) {
            await processMessagingEvent(supabase, instagramId, messagingEvent);
          }

          // Process changes (comments, mentions, etc.)
          for (const change of entry.changes || []) {
            await processChangeEvent(supabase, instagramId, change);
          }
        }
      }

      // Always respond with 200 OK to acknowledge receipt
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      // Still return 200 to prevent Facebook from retrying
      return new Response(JSON.stringify({ error: "Processing error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

// ============================================
// Process Direct Messages
// ============================================
async function processMessagingEvent(supabase: any, instagramId: string, event: any) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const timestamp = event.timestamp;

  console.log("Processing messaging event:", { senderId, recipientId, timestamp });

  // Handle incoming message
  if (event.message) {
    const message = event.message;
    const messageId = message.mid;
    const messageText = message.text;

    console.log("Received message:", { messageId, messageText, senderId });

    // Store message in database
    await storeMessage(supabase, {
      instagram_id: instagramId,
      sender_id: senderId,
      recipient_id: recipientId,
      message_id: messageId,
      message_text: messageText,
      timestamp: new Date(timestamp).toISOString(),
      direction: "incoming",
    });

    // Check for auto-reply rules and send response
    await handleAutoReply(supabase, instagramId, senderId, messageText);
  }

  // Handle message reactions
  if (event.reaction) {
    console.log("Received reaction:", event.reaction);
  }

  // Handle message read receipts
  if (event.read) {
    console.log("Message read:", event.read);
  }
}

// ============================================
// Process Comments, Mentions, etc.
// ============================================
async function processChangeEvent(supabase: any, instagramId: string, change: any) {
  const field = change.field;
  const value = change.value;

  console.log("Processing change event:", { field, value });

  if (field === "comments") {
    // Handle new comment
    const commentId = value.id;
    const commentText = value.text;
    const fromId = value.from?.id;
    const fromUsername = value.from?.username;

    console.log("New comment:", { commentId, commentText, fromUsername });

    // Store comment
    await supabase.from("instagram_comments").insert({
      instagram_id: instagramId,
      comment_id: commentId,
      comment_text: commentText,
      from_id: fromId,
      from_username: fromUsername,
      created_at: new Date().toISOString(),
    }).select();

    // Check for auto-reply to comments
    await handleCommentAutoReply(supabase, instagramId, commentId, commentText, fromId);
  }

  if (field === "mentions") {
    console.log("New mention:", value);
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
      console.error("Error storing message:", error);
    } else {
      console.log("Message stored:", data);
    }
  } catch (err) {
    console.error("Database error:", err);
  }
}

// ============================================
// Handle Auto-Reply for DMs
// ============================================
async function handleAutoReply(supabase: any, instagramId: string, senderId: string, messageText: string) {
  try {
    // Get store by Instagram ID
    const { data: store } = await supabase
      .from("stores")
      .select("id, user_id, instagram_access_token, auto_reply_settings")
      .eq("instagram_business_id", instagramId)
      .single();

    if (!store || !store.instagram_access_token) {
      console.log("No store found or no access token");
      return;
    }

    const autoReplySettings = store.auto_reply_settings || {};

    // Check if auto-reply is enabled
    if (!autoReplySettings.enabled) {
      console.log("Auto-reply is disabled");
      return;
    }

    // Find matching auto-reply rule
    const rules = autoReplySettings.rules || [];
    let replyMessage = autoReplySettings.default_message || "Thanks for your message! We'll get back to you soon.";

    for (const rule of rules) {
      const keywords = rule.keywords || [];
      const lowerMessage = messageText.toLowerCase();

      if (keywords.some((keyword: string) => lowerMessage.includes(keyword.toLowerCase()))) {
        replyMessage = rule.reply;
        break;
      }
    }

    // Send auto-reply
    await sendInstagramMessage(store.instagram_access_token, senderId, replyMessage);

    // Store outgoing message
    await storeMessage(supabase, {
      instagram_id: instagramId,
      sender_id: instagramId,
      recipient_id: senderId,
      message_text: replyMessage,
      timestamp: new Date().toISOString(),
      direction: "outgoing",
      is_auto_reply: true,
    });

    console.log("Auto-reply sent:", replyMessage);
  } catch (err) {
    console.error("Auto-reply error:", err);
  }
}

// ============================================
// Handle Auto-Reply for Comments
// ============================================
async function handleCommentAutoReply(supabase: any, instagramId: string, commentId: string, commentText: string, fromId: string) {
  try {
    // Get store by Instagram ID
    const { data: store } = await supabase
      .from("stores")
      .select("id, instagram_access_token, comment_auto_reply_settings")
      .eq("instagram_business_id", instagramId)
      .single();

    if (!store || !store.instagram_access_token) {
      return;
    }

    const settings = store.comment_auto_reply_settings || {};

    if (!settings.enabled) {
      return;
    }

    // Reply to comment
    const replyText = settings.default_reply || "Thanks for your comment!";
    await replyToComment(store.instagram_access_token, commentId, replyText);

    console.log("Comment auto-reply sent");
  } catch (err) {
    console.error("Comment auto-reply error:", err);
  }
}

// ============================================
// Send Instagram Direct Message
// ============================================
async function sendInstagramMessage(accessToken: string, recipientId: string, message: string) {
  const url = `https://graph.instagram.com/v18.0/me/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      access_token: accessToken,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Error sending message:", result);
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: message,
      access_token: accessToken,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Error replying to comment:", result);
    throw new Error(result.error?.message || "Failed to reply to comment");
  }

  return result;
}
