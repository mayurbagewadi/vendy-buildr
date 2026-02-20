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
  // Clean up common model mistakes BEFORE parsing
  let cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  const raw = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(raw);
  } catch {
    // Strip control characters and retry
    const sanitized = raw.replace(/[\u0000-\u001F\u007F]/g, " ");
    return JSON.parse(sanitized);
  }
}

// ─── Validate and fix AI response ────────────────────────────
function validateAndFixResponse(parsed: any, userPrompt: string): any {
  const msg = (parsed.message || "").trim();

  // Case 1: AI double-encoded JSON inside message field
  // e.g., {"type":"text","message":"{\"type\":\"design\",...}"}
  if (parsed.type === "text" && msg.startsWith("{") && msg.includes('"type"')) {
    try {
      const innerParsed = JSON.parse(msg);
      if (innerParsed.type === "design" && innerParsed.design) {
        console.log("DEBUG: Extracted double-encoded design from message");
        return innerParsed;
      }
    } catch {
      // Not valid JSON, continue to other checks
    }
  }

  // Case 2: AI returned design description as text with [Design proposed:] pattern
  const designIndicators = [
    "[design proposed:",
    "[design:",
    "```css",
    "css_variables",
    "here is the design",
    "i'll implement",
    "implementing",
    "here's what i",
    "i've created",
    "i have created"
  ];

  const msgLower = msg.toLowerCase();
  const isDesignLikeText = parsed.type === "text" &&
    designIndicators.some(indicator => msgLower.includes(indicator));

  if (isDesignLikeText) {
    console.log("DEBUG: Detected design-like text, returning clarification");
    return {
      type: "text",
      message: "I couldn't generate the design properly. Could you please describe what specific changes you'd like? For example: 'Make the header blue' or 'Change button colors to green'."
    };
  }

  // If it's a valid design response, ensure required fields exist
  if (parsed.type === "design" && parsed.design) {
    if (!parsed.design.css_variables) parsed.design.css_variables = {};
    if (!parsed.design.changes_list) parsed.design.changes_list = [];
    if (!parsed.design.summary) parsed.design.summary = "Design update";
  }

  return parsed;
}

// ─── System prompt ────────────────────────────────────────────
function buildSystemPrompt(storeName: string, currentDesign: any, theme: string = "light"): string {
  const currentDesignText = currentDesign
    ? "CURRENT DESIGN (your baseline — preserve everything not mentioned in the request):\n" + JSON.stringify(currentDesign, null, 2) + "\n\n"
    : "CURRENT DESIGN: Platform defaults (fresh start — full creative freedom)\n\n";

  return `### ROLE
You are a Headless Design System Engine for: ${storeName}
You output ONLY raw JSON data. NEVER output conversational text, markdown, or preamble.
If output is invalid JSON, you have FAILED.

### CURRENT MODE: ${theme.toUpperCase()}
${theme === "dark" ? "Design for dark mode: deep backgrounds, light text, glowing accents" : "Design for light mode: bright backgrounds, vibrant accents, high contrast"}

${currentDesignText}
### INTENT DETECTION (DO FIRST)
IF input is vague: "yes", "ok", "5", "sure", "hmm", "" or single word
  RETURN ONLY: {"type":"text","message":"What specific design change do you want?"}

IF input requests design: contains color, layout, style, design, component, theme words
  RETURN ONLY: type "design" with JSON schema

### OUTPUT FORMAT (MANDATORY)
Return ONLY ONE valid JSON object.
- Zero text before {
- Zero text after }
- Zero markdown
- Zero code blocks
- Zero "[Design proposed: ...]"

### FORBIDDEN (NEVER USE)
❌ [Design proposed: ...]
❌ "Here is the design"
❌ Markdown code blocks
❌ Text outside JSON

### DESIGN JSON SCHEMA
{
  "type": "design",
  "message": "Short expert explanation",
  "design": {
    "summary": "One sentence",
    "css_variables": {"primary": "217 91% 60%"},
    "css_overrides": "[data-ai='header']{background:hsl(var(--primary));}",
    "changes_list": ["Change 1", "Change 2"]
  }
}

### TEXT JSON SCHEMA
{"type":"text","message":"Clarification"}

### CSS RULES
- Colors: HSL ONLY "217 91% 60%" (no hsl(), no hex, no rgb)
- Selectors: [data-ai='name'] with single quotes

### DESIGN PHILOSOPHY
• Use color psychology — warm tones (amber, orange) for food/retail, cool tones (blue, slate) for tech, earth tones for fashion/lifestyle
• Typography hierarchy matters — hero text should command attention, body text should breathe
• Whitespace is a design element — use muted backgrounds and padding to create visual rhythm
• Micro-interactions build trust — smooth hover transitions, subtle shadows, card lift effects
• Contrast drives conversion — CTA buttons must stand out with strong contrast against background
• Consistency is professionalism — radius, shadow style, and spacing should be uniform across sections

STORE SECTIONS (target with data-ai selectors in css_overrides):
• [data-ai="header"] - Navigation bar
• [data-ai="section-hero"] - Main hero banner
• [data-ai="section-categories"] - Category cards
• [data-ai="section-featured"] - Featured product grid
• [data-ai="product-card"] - Individual product card
• [data-ai="section-reviews"] - Customer reviews section
• [data-ai="section-cta"] - Call-to-action banner
• [data-ai="section-footer"] - Footer

CSS VARIABLES (HSL format only — no hsl() wrapper, no hex — applied globally to :root):
CORE:
• primary — CTA buttons, links, price tags, accents
• primary-foreground — text color on primary backgrounds
• background — main page background
• foreground — primary text color
• card — card/panel backgrounds
• card-foreground — text on cards
• muted — subtle section backgrounds, dividers
• muted-foreground — secondary text, placeholders, captions
• border — card borders, dividers
• radius — global border radius (e.g. 0.5rem, 1rem, 0px for sharp)
• accent — hover state highlights
• accent-foreground — text on accent
• secondary — secondary buttons, badges, tags
• secondary-foreground — text on secondary elements
• ring — focus ring / accessibility outline

ADVANCED:
• primary-hover — button hover state color
• shadow-card — default card shadow
• shadow-elevated — elevated/floating element shadow
• transition-base — base interaction speed
• transition-smooth — smooth animation speed

CSS OVERRIDES — FULL ACCESS:
• Target ANY selector: [data-ai="..."], .class, h1, p, a, button, img, :hover, ::before, ::after, @keyframes
• Use ANY CSS: gradients, animations, box-shadow, backdrop-filter, filter, transform, clip-path, font-size, letter-spacing, text-transform, opacity, border, outline — everything
• No restrictions — write production-quality CSS

RULES:
1. MOST IMPORTANT: Output ONLY valid JSON. Start with { end with }. No text before or after. No markdown. No code blocks. No plain English design descriptions. ONLY JSON.
2. NEVER write things like "Design proposed:" or "I'll create..." — just output the JSON directly.
3. HSL values for css_variables: "217 91% 60%" — no hsl() wrapper, no hex
4. Variable keys WITHOUT "--": write "primary" not "--primary"
5. css_overrides: use ONLY single quotes for attribute selectors — [data-ai='header'] NOT [data-ai="header"]. NEVER use double quotes inside css_overrides strings.
6. PRESERVE PREVIOUS DESIGN: only change what the user explicitly asked. Copy all other values from CURRENT DESIGN exactly. Never remove or overwrite previous changes not mentioned. Merge, never replace.
7. If user says "no gradients", "minimal", "clean", "flat", or "simple" — use flat solid colors, no gradients or heavy effects
8. If prompt is vague (under 5 words, no specifics) — ask 1 clarifying question before generating: "What's the vibe — premium, playful, minimal, bold, or something else?"
9. BEFORE finalizing your design — self-review: check contrast ratios are readable, card style matches hero style, spacing is consistent. Fix issues before responding.
10. After every design, suggest ONE specific next improvement in your message — end with "Want me to [specific suggestion]?"
11. If user says "apply", "publish", "confirm", "is it applied" — respond with TEXT type. NEVER say "design is applied/confirmed". Always direct to the Publish button.
12. If user says "no" before a design request (e.g. "no redesign it") — treat as a NEW design request, generate fresh
13. Explain design decisions using real design vocabulary — color psychology, contrast, hierarchy, rhythm, affordance

FOR DESIGN CHANGES:
{
  "type": "design",
  "message": "Confident, expert explanation of what you designed and WHY it works — reference design principles. End with one specific suggestion for next improvement.",
  "design": {
    "summary": "One bold sentence describing the overall design vision and its purpose",
    "css_variables": { "primary": "217 91% 60%", "primary-foreground": "0 0% 100%", "background": "0 0% 100%", "foreground": "222 47% 11%", "card": "0 0% 98%", "card-foreground": "222 47% 11%", "muted": "210 40% 96%", "muted-foreground": "215 16% 47%", "border": "214 32% 91%", "radius": "0.75rem", "accent": "210 40% 96%", "secondary": "210 40% 96%", "secondary-foreground": "222 47% 11%" },
    "dark_css_variables": { "primary": "217 91% 65%", "background": "222 47% 8%", "foreground": "210 40% 98%", "card": "222 47% 11%", "muted": "217 33% 17%", "muted-foreground": "215 20% 65%", "border": "217 33% 17%" },
    "layout": { "product_grid_cols": "3", "section_padding": "normal" },
    "css_overrides": "[data-ai='section-hero']{ background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); padding: 80px 0; }[data-ai='product-card']{ border-radius: 12px; transition: all 0.3s ease; }[data-ai='product-card']:hover{ transform: translateY(-6px); box-shadow: 0 16px 32px rgba(0,0,0,0.15); }",
    "changes_list": [
      "Hero section — deep space gradient for a premium, immersive first impression",
      "Product cards — smooth lift on hover with layered shadow for depth",
      "Border radius — unified 12px across cards for a modern, friendly feel"
    ]
  }
}

FOR PURE CHAT (no design change needed):
{ "type": "text", "message": "Your expert, helpful response here" }

WHEN USER CONFIRMS THEY LIKE THE DESIGN:
{ "type": "text", "message": "Great taste! Click the 'Publish' button above to make it live on your store. Want me to [specific next improvement suggestion]?" }

WHEN USER ASKS TO APPLY/PUBLISH/IS IT APPLIED/CONFIRM:
{ "type": "text", "message": "I can't apply designs directly — only you can do that by clicking the 'Publish' button above. Once published, it goes live on your store instantly!" }`;
}

// ─── Main handler ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    console.log("DEBUG: Starting request handler");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    console.log("DEBUG: Supabase client created");

    const body = await req.json();
    console.log("DEBUG: Body parsed, action:", body.action);

    const { action, store_id, user_id, prompt, design, history_id, messages, package_id, amount, currency, theme } = body;

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
      console.log("DEBUG: Entered chat action");
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
      console.log("DEBUG: Token check done, has tokens:", !!activePurchase);
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

      const systemPrompt = buildSystemPrompt(store?.name || "Store", designState?.current_design || null, theme || "light");
      const model = (platformSettings.openrouter_model || "moonshotai/kimi-k2").trim();
      const apiKey = platformSettings.openrouter_api_key.trim();

      // Call OpenRouter
      console.log("DEBUG: Calling OpenRouter, model:", model);
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
            temperature: 0.1,
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
      console.log("DEBUG: Fetch completed, status:", aiResponse.status);

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text().catch(() => "");
        console.error("OpenRouter error:", aiResponse.status, errBody);
        return new Response(JSON.stringify({ success: false, error: "Unable to connect to AI. Please try again in a moment." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const aiData = await aiResponse.json();
      console.log("DEBUG: AI data received");
      const rawContent = aiData.choices?.[0]?.message?.content || "";
      console.log("DEBUG: Raw content length:", rawContent.length);

      // Parse AI response
      let parsed: any;

      // If no JSON found, treat as plain text response
      if (!rawContent.includes("{") || !rawContent.includes("}")) {
        console.log("DEBUG: No JSON found, treating as text response");

        // Save text conversation to history
        const plainMsg = rawContent || "";
        const { data: plainTextHistoryRow } = await supabase.from("ai_designer_history").insert({
          store_id, user_id, prompt: userPrompt,
          ai_response: { type: "text", message: plainMsg },
          ai_css_overrides: null, tokens_used: 0, applied: false,
        }).select("id").single();

        return new Response(JSON.stringify({
          success: true, type: "text",
          message: rawContent || "I couldn't understand that. Could you rephrase?",
          history_id: plainTextHistoryRow?.id || null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        parsed = extractJSON(rawContent);
        parsed = validateAndFixResponse(parsed, userPrompt);
        console.log("DEBUG: JSON parsed and validated, type:", parsed.type);
      } catch (e) {
        console.error("DEBUG: JSON parse failed:", e, "Content:", rawContent);

        // Save malformed response to history
        const fallbackMsg = rawContent || "I couldn't understand that. Could you rephrase?";
        const { data: errorHistoryRow } = await supabase.from("ai_designer_history").insert({
          store_id, user_id, prompt: userPrompt,
          ai_response: { type: "text", message: fallbackMsg },
          ai_css_overrides: null, tokens_used: 0, applied: false,
        }).select("id").single();

        return new Response(JSON.stringify({
          success: true, type: "text",
          message: rawContent || "I couldn't understand that. Could you rephrase?",
          history_id: errorHistoryRow?.id || null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        const { data: historyRow, error: historyErr } = await supabase.from("ai_designer_history").insert({
          store_id,
          user_id,
          prompt: userPrompt,
          ai_response: {
            summary: d.summary || "",
            changes_list: d.changes_list || [],
            layout: d.layout || {},
            css_variables: d.css_variables || {},
          },
          ai_css_overrides: d.css_overrides || null,
          tokens_used: 1,
          applied: false,
        }).select("id").single();
        if (historyErr) console.error("DEBUG: History insert failed:", historyErr.message);

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

      // Text response — no token charge, but still save to history
      const textMessage = parsed.message || rawContent || "";
      const { data: textHistoryRow } = await supabase.from("ai_designer_history").insert({
        store_id,
        user_id,
        prompt: userPrompt,
        ai_response: { type: "text", message: textMessage },
        ai_css_overrides: null,
        tokens_used: 0,
        applied: false,
      }).select("id").single();

      return new Response(JSON.stringify({
        success: true,
        type: "text",
        message: parsed.message || rawContent,
        history_id: textHistoryRow?.id || null,
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
            temperature: 0.1,
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

      // If no JSON found, treat as plain text
      if (!genContent.includes("{") || !genContent.includes("}")) {
        return new Response(JSON.stringify({
          success: true, type: "text",
          message: genContent || "I couldn't understand that. Could you rephrase?",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let genParsed: any;
      try { genParsed = extractJSON(genContent); } catch {
        return new Response(JSON.stringify({
          success: true, type: "text",
          message: genContent || "I couldn't understand that. Could you rephrase?",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
