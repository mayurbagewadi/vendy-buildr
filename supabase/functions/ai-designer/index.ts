import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SETTINGS_ID = "00000000-0000-0000-0000-000000000000";

// ─── UUID validation ─────────────────────────────────────────
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ─── CSS Sanitization (security) ─────────────────────────────
function sanitizeCSS(css: string): { safe: boolean; sanitized: string; blocked: string[] } {
  if (!css || typeof css !== "string") return { safe: true, sanitized: "", blocked: [] };
  const blocked: string[] = [];
  let sanitized = css;
  const dangerousPatterns = [
    { pattern: /javascript\s*:/gi, name: "javascript: URLs" },
    { pattern: /expression\s*\(/gi, name: "expression()" },
    { pattern: /@import/gi, name: "@import" },
    { pattern: /<script/gi, name: "script tags" },
    { pattern: /behavior\s*:/gi, name: "behavior:" },
    { pattern: /binding\s*:/gi, name: "binding:" },
    { pattern: /-moz-binding/gi, name: "-moz-binding" },
    { pattern: /vbscript\s*:/gi, name: "vbscript:" },
    { pattern: /data\s*:\s*text\/html/gi, name: "data:text/html" },
  ];
  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      blocked.push(name);
      sanitized = sanitized.replace(pattern, "/* BLOCKED */");
    }
  }
  return { safe: blocked.length === 0, sanitized, blocked };
}

// ─── Normalize CSS variable keys (strip leading --) ──────────
function normalizeVarKeys(vars: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    result[k.replace(/^--/, "")] = v;
  }
  return result;
}

// ─── Extract JSON from AI response ───────────────────────────
function extractJSON(content: string): any {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  return JSON.parse(content.slice(start, end + 1));
}

// ─── System prompt ────────────────────────────────────────────
function buildSystemPrompt(storeName: string, currentDesign: any): string {
  const currentDesignText = currentDesign
    ? "CURRENT DESIGN (your baseline):\n" + JSON.stringify(currentDesign, null, 2) + "\n\n"
    : "CURRENT DESIGN: Platform defaults (fresh start)\n\n";

  return `You are an expert UI/UX designer for the e-commerce store: ${storeName}.

${currentDesignText}STORE SECTIONS (use these data-ai selectors in css_overrides):
• [data-ai="header"] - Navigation bar
• [data-ai="section-hero"] - Main hero banner
• [data-ai="section-categories"] - Category cards
• [data-ai="section-featured"] - Product grid
• [data-ai="product-card"] - Individual product card
• [data-ai="section-reviews"] - Reviews section
• [data-ai="section-cta"] - Call-to-action banner
• [data-ai="section-footer"] - Footer

CSS VARIABLES (HSL format — no hsl() wrapper, no hex):
• primary — buttons, links, accents, prices
• background — page background
• foreground — main text
• card — card backgrounds
• muted — subtle backgrounds
• muted-foreground — secondary text
• border — dividers and card borders
• radius — border radius (e.g. 0.5rem)

RULES:
1. Respond ONLY with valid JSON. No markdown. Start with { end with }.
2. HSL format only: "217 91% 60%" not "hsl(...)" or "#hex"
3. Variable keys WITHOUT "--": "primary" not "--primary"
4. Only add gradients, shadows, or animations if the user explicitly asked for them.
5. Every item in changes_list MUST have real CSS written for it in the response.
6. changes_list format: "Element — what changed to new value" (plain English, no CSS jargon)

FOR DESIGN CHANGES:
{
  "type": "design",
  "message": "Here is what I changed:",
  "design": {
    "summary": "One sentence describing the overall design",
    "css_variables": { "primary": "217 91% 60%", "background": "0 0% 100%", "foreground": "222 47% 11%", "card": "0 0% 98%", "muted": "210 40% 96%", "muted-foreground": "215 16% 47%", "border": "214 32% 91%", "radius": "0.5rem" },
    "dark_css_variables": { "primary": "217 91% 65%", "background": "222 47% 8%", "foreground": "210 40% 98%", "card": "222 47% 11%", "muted": "217 33% 17%", "muted-foreground": "215 20% 65%", "border": "217 33% 17%" },
    "layout": { "product_grid_cols": "3", "section_padding": "normal" },
    "css_overrides": "[data-ai='section-hero']{ ... }[data-ai='product-card']:hover{ ... }",
    "changes_list": [
      "Product card — border color changed to indigo",
      "Add to cart button — background changed to indigo",
      "Hero section — background color changed to dark navy"
    ]
  }
}

FOR PURE CHAT (no design change):
{ "type": "text", "message": "Your helpful response here" }`;
}

// ─── Main handler ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, store_id, user_id, prompt, design, history_id, messages, package_id, amount, currency } = body;

    // ── get_token_balance ──────────────────────────────────────
    if (action === "get_token_balance") {
      if (!store_id || !isValidUUID(store_id)) {
        return new Response(JSON.stringify({ success: false, error: "Invalid store_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const now = new Date().toISOString();

      // Auto-expire overdue tokens
      await supabase.from("ai_token_purchases").update({ status: "expired" })
        .eq("store_id", store_id).eq("status", "active").lt("expires_at", now).not("expires_at", "is", null);
      await supabase.from("ai_token_purchases").delete()
        .eq("store_id", store_id).eq("status", "expired");

      // Clean up old pending purchases
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      await supabase.from("ai_token_purchases").delete()
        .eq("store_id", store_id).eq("status", "pending").lt("created_at", oneDayAgo);

      const { data: purchases } = await supabase.from("ai_token_purchases")
        .select("tokens_remaining, expires_at")
        .eq("store_id", store_id).eq("status", "active")
        .order("expires_at", { ascending: true, nullsFirst: false });

      const totalRemaining = (purchases || []).reduce((sum: number, p: any) => sum + (p.tokens_remaining || 0), 0);
      const earliestExpiry = purchases && purchases.length > 0 ? purchases[0].expires_at : null;

      return new Response(JSON.stringify({
        success: true,
        tokens_remaining: totalRemaining,
        expires_at: earliestExpiry,
        has_tokens: totalRemaining > 0
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── chat ───────────────────────────────────────────────────
    if (action === "chat") {
      if (!store_id || !isValidUUID(store_id) || !user_id || !isValidUUID(user_id)) {
        return new Response(JSON.stringify({ success: false, error: "Invalid store_id or user_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Missing messages" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const userPrompt = messages[messages.length - 1]?.content || "";

      // Check tokens
      const { data: activePurchases } = await supabase.from("ai_token_purchases")
        .select("id, tokens_remaining, tokens_used")
        .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0)
        .order("expires_at", { ascending: true, nullsFirst: false }).limit(1);

      const activePurchase = activePurchases?.[0];
      if (!activePurchase) {
        return new Response(JSON.stringify({ success: false, error: "No tokens remaining. Please purchase more tokens to continue." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 });
      }

      // Fetch platform settings
      const { data: platformSettings } = await supabase.from("platform_settings")
        .select("openrouter_api_key, openrouter_model").eq("id", SETTINGS_ID).single();

      if (!platformSettings?.openrouter_api_key) {
        return new Response(JSON.stringify({ success: false, error: "AI not configured. Please contact platform support." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      // Fetch store info
      const { data: store } = await supabase.from("stores")
        .select("name, description").eq("id", store_id).single();

      // Fetch current design
      const { data: designState } = await supabase.from("store_design_state")
        .select("current_design").eq("store_id", store_id).maybeSingle();

      const systemPrompt = buildSystemPrompt(store?.name || "Store", designState?.current_design || null);
      const model = (platformSettings.openrouter_model || "moonshotai/kimi-k2").trim();
      const apiKey = platformSettings.openrouter_api_key.trim();

      // Call OpenRouter
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      let aiResponse: Response;
      try {
        aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://yesgive.shop",
            "X-Title": "Vendy Buildr AI Designer",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            max_tokens: 4000,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });
      } catch (error: any) {
        clearTimeout(timeout);
        const errMsg = error.name === "AbortError" ? "Request timed out. Please try again." : "Unable to connect to AI. Please try again in a moment.";
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      clearTimeout(timeout);

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text().catch(() => "");
        console.error("OpenRouter error:", aiResponse.status, errBody);
        return new Response(JSON.stringify({ success: false, error: "Unable to connect to AI. Please try again in a moment." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const aiData = await aiResponse.json();
      const rawContent = aiData.choices?.[0]?.message?.content || "";

      // Parse AI response
      let parsed: any;
      try {
        parsed = extractJSON(rawContent);
      } catch {
        return new Response(JSON.stringify({ success: false, error: "AI returned an invalid response. Please try again." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const responseType = parsed.type || "text";

      // If design response — sanitize CSS, normalize keys
      if (responseType === "design" && parsed.design) {
        const d = parsed.design;

        if (d.css_variables) d.css_variables = normalizeVarKeys(d.css_variables);
        if (d.dark_css_variables) d.dark_css_variables = normalizeVarKeys(d.dark_css_variables);

        if (d.css_overrides) {
          const sanitization = sanitizeCSS(d.css_overrides);
          if (sanitization.blocked.length > 0) {
            console.warn("CSS sanitized, blocked:", sanitization.blocked);
          }
          d.css_overrides = sanitization.sanitized;
        }

        // Deduct 1 token
        await supabase.from("ai_token_purchases").update({
          tokens_remaining: activePurchase.tokens_remaining - 1,
          tokens_used: activePurchase.tokens_used + 1,
          updated_at: new Date().toISOString(),
        }).eq("id", activePurchase.id);

        // Save to history
        const { data: historyRow } = await supabase.from("ai_designer_history").insert({
          store_id,
          user_id,
          prompt: userPrompt,
          ai_response: {
            summary: d.summary,
            changes_list: d.changes_list,
            layout: d.layout,
            css_variables: d.css_variables,
          },
          ai_css_overrides: d.css_overrides || null,
          tokens_used: 1,
          applied: false,
        }).select("id").single();

        // Get updated token balance
        const { data: updatedPurchases } = await supabase.from("ai_token_purchases")
          .select("tokens_remaining")
          .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0);

        const tokensRemaining = (updatedPurchases || []).reduce((sum: number, p: any) => sum + p.tokens_remaining, 0);

        return new Response(JSON.stringify({
          success: true,
          type: "design",
          message: parsed.message || "Here is what I changed:",
          design: d,
          history_id: historyRow?.id || null,
          tokens_remaining: tokensRemaining,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Text response — no token charge
      return new Response(JSON.stringify({
        success: true,
        type: "text",
        message: parsed.message || rawContent,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── generate_design (treated same as chat with single message) ──
    if (action === "generate_design") {
      if (!store_id || !user_id || !prompt) {
        return new Response(JSON.stringify({ success: false, error: "Missing required fields" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      const genMessages = [{ role: "user", content: prompt }];

      const { data: genPurchases } = await supabase.from("ai_token_purchases")
        .select("id, tokens_remaining, tokens_used")
        .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0)
        .order("expires_at", { ascending: true, nullsFirst: false }).limit(1);
      const genPurchase = genPurchases?.[0];
      if (!genPurchase) {
        return new Response(JSON.stringify({ success: false, error: "No tokens remaining. Please purchase more tokens to continue." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 });
      }

      const { data: genSettings } = await supabase.from("platform_settings")
        .select("openrouter_api_key, openrouter_model").eq("id", SETTINGS_ID).single();
      if (!genSettings?.openrouter_api_key) {
        return new Response(JSON.stringify({ success: false, error: "AI not configured. Please contact platform support." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const { data: genStore } = await supabase.from("stores").select("name").eq("id", store_id).single();
      const { data: genDesignState } = await supabase.from("store_design_state").select("current_design").eq("store_id", store_id).maybeSingle();
      const genSystemPrompt = buildSystemPrompt(genStore?.name || "Store", genDesignState?.current_design || null);

      const genController = new AbortController();
      const genTimeout = setTimeout(() => genController.abort(), 45000);

      let genAIResponse: Response;
      try {
        genAIResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + genSettings.openrouter_api_key.trim(),
            "Content-Type": "application/json",
            "HTTP-Referer": "https://yesgive.shop",
            "X-Title": "Vendy Buildr AI Designer",
          },
          body: JSON.stringify({
            model: (genSettings.openrouter_model || "moonshotai/kimi-k2").trim(),
            messages: [{ role: "system", content: genSystemPrompt }, ...genMessages],
            max_tokens: 4000,
            temperature: 0.7,
          }),
          signal: genController.signal,
        });
      } catch (error: any) {
        clearTimeout(genTimeout);
        const errMsg = error.name === "AbortError" ? "Request timed out. Please try again." : "Unable to connect to AI. Please try again in a moment.";
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      clearTimeout(genTimeout);

      if (!genAIResponse.ok) {
        const errBody = await genAIResponse.text().catch(() => "");
        console.error("OpenRouter error (generate):", genAIResponse.status, errBody);
        return new Response(JSON.stringify({ success: false, error: "Unable to connect to AI. Please try again in a moment." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const genData = await genAIResponse.json();
      const genContent = genData.choices?.[0]?.message?.content || "";
      let genParsed: any;
      try { genParsed = extractJSON(genContent); } catch {
        return new Response(JSON.stringify({ success: false, error: "AI returned an invalid response. Please try again." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      if (genParsed.type === "design" && genParsed.design) {
        const d = genParsed.design;
        if (d.css_variables) d.css_variables = normalizeVarKeys(d.css_variables);
        if (d.dark_css_variables) d.dark_css_variables = normalizeVarKeys(d.dark_css_variables);
        if (d.css_overrides) { const s = sanitizeCSS(d.css_overrides); d.css_overrides = s.sanitized; }

        await supabase.from("ai_token_purchases").update({
          tokens_remaining: genPurchase.tokens_remaining - 1,
          tokens_used: genPurchase.tokens_used + 1,
          updated_at: new Date().toISOString(),
        }).eq("id", genPurchase.id);

        const { data: genHistoryRow } = await supabase.from("ai_designer_history").insert({
          store_id, user_id, prompt,
          ai_response: { summary: d.summary, changes_list: d.changes_list, layout: d.layout, css_variables: d.css_variables },
          ai_css_overrides: d.css_overrides || null, tokens_used: 1, applied: false,
        }).select("id").single();

        const { data: genUpdated } = await supabase.from("ai_token_purchases").select("tokens_remaining")
          .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0);
        const genTokensLeft = (genUpdated || []).reduce((s: number, p: any) => s + p.tokens_remaining, 0);

        return new Response(JSON.stringify({
          success: true, type: "design",
          message: genParsed.message || "Here is what I changed:",
          design: d, history_id: genHistoryRow?.id || null, tokens_remaining: genTokensLeft,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, type: "text", message: genParsed.message || genContent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── apply_design ───────────────────────────────────────────
    if (action === "apply_design") {
      if (!store_id || !design) {
        return new Response(JSON.stringify({ success: false, error: "Missing store_id or design" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      // Sanitize CSS before applying
      if (design.css_overrides) {
        const sanitization = sanitizeCSS(design.css_overrides);
        if (sanitization.blocked.length > 0) console.warn("CSS blocked on apply:", sanitization.blocked);
        design.css_overrides = sanitization.sanitized;
      }

      const now = new Date().toISOString();
      await supabase.from("store_design_state").upsert({
        store_id,
        current_design: design,
        last_applied_at: now,
        updated_at: now,
      }, { onConflict: "store_id" });

      if (history_id) {
        await supabase.from("ai_designer_history").update({ applied: true }).eq("id", history_id);
      }

      return new Response(JSON.stringify({ success: true, message: "Design applied to your live store" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── reset_design ───────────────────────────────────────────
    if (action === "reset_design") {
      if (!store_id) {
        return new Response(JSON.stringify({ success: false, error: "Missing store_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      await supabase.from("store_design_state").delete().eq("store_id", store_id);
      return new Response(JSON.stringify({ success: true, message: "Store design reset to platform default" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── create_payment_order ───────────────────────────────────
    if (action === "create_payment_order") {
      if (!amount || !currency || !package_id) {
        return new Response(JSON.stringify({ success: false, error: "Missing amount, currency, or package_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const { data: platformSettings } = await supabase.from("platform_settings")
        .select("razorpay_key_id, razorpay_key_secret").eq("id", SETTINGS_ID).single();

      if (!platformSettings?.razorpay_key_id || !platformSettings?.razorpay_key_secret) {
        return new Response(JSON.stringify({ success: false, error: "Payment not configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const basicAuth = btoa(platformSettings.razorpay_key_id + ":" + platformSettings.razorpay_key_secret);
      const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Authorization": "Basic " + basicAuth, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency,
          receipt: "ai_tok_" + Date.now().toString().slice(-10),
          notes: { type: "ai_tokens", package_id, store_id }
        })
      });

      if (!razorpayResponse.ok) {
        console.error("Razorpay error:", await razorpayResponse.text().catch(() => ""));
        return new Response(JSON.stringify({ success: false, error: "Unable to process payment. Please try again." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const razorpayOrder = await razorpayResponse.json();
      return new Response(JSON.stringify({
        success: true,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        razorpay_key_id: platformSettings.razorpay_key_id
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action: " + action }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });

  } catch (error: any) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ success: false, error: "Something went wrong. Please try again later." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
