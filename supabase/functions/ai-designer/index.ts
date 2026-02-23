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

// ─── Design System Context (for AI Intelligence) ─────────────
interface DesignSystemContext {
  availableColors: Record<string, string>;
  componentCapabilities: string[];
  currentState: Record<string, string>;
  storeType: string;
  constraints: {
    minContrast: number;
    maxSaturation: number;
    allowedEffects: string[];
  };
}

function buildDesignSystemContext(currentDesign: any, storeType: string = "general"): DesignSystemContext {
  // All colors AI can use
  const availableColors = {
    "primary-blue": "217 91% 60%",
    "primary-green": "142 71% 45%",
    "primary-orange": "38 92% 50%",
    "primary-red": "0 84% 60%",
    "accent-gold": "45 93% 47%",
    "accent-purple": "280 100% 60%",
    "accent-cyan": "190 100% 50%",
    "neutral-dark": "222 47% 8%",
    "neutral-light": "0 0% 100%",
    "neutral-gray": "210 40% 96%",
  };

  // What AI can modify on store
  const componentCapabilities = [
    "header-background",
    "hero-section",
    "product-cards",
    "category-cards",
    "cta-buttons",
    "footer",
    "text-colors",
    "border-colors",
    "hover-effects",
    "animations",
    "shadows",
    "radius",
  ];

  // Current live state
  const currentState = currentDesign?.css_variables || {
    primary: "217 91% 60%",
    background: "210 40% 98%",
    card: "0 0% 100%",
  };

  // Store type constraints
  const storeConstraints: Record<string, string[]> = {
    food: ["warm-colors", "appetizing-palette", "rounded-corners"],
    fashion: ["elegant-colors", "minimal-effects", "bold-typography"],
    tech: ["cool-colors", "modern-effects", "glassmorphism"],
    luxury: ["gold-accents", "dark-backgrounds", "premium-shadows"],
    casual: ["bright-colors", "playful-animations", "rounded-shapes"],
  };

  return {
    availableColors,
    componentCapabilities,
    currentState,
    storeType,
    constraints: {
      minContrast: 4.5,
      maxSaturation: 100,
      allowedEffects: ["gradient", "shadow", "blur", "glow", "animation"],
    },
  };
}

// ─── Normalize CSS variable keys (strip leading --) ──────────
function normalizeVarKeys(vars: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    result[k.replace(/^--/, "")] = v;
  }
  return result;
}

// ─── Parse structured text format ────────────────────────────
interface ParsedSection {
  name: string;
  change: string;
  color?: string;
}

function parseDesignText(aiText: string): { sections: ParsedSection[]; rawText: string } {
  console.log("[PARSER] Parsing AI text response");
  const sections: ParsedSection[] = [];
  const blocks = aiText.split('---').map(b => b.trim()).filter(Boolean);

  blocks.forEach((block, blockIdx) => {
    const lines = block.split('\n').filter(l => l.trim());

    let section: ParsedSection | null = null;
    lines.forEach(line => {
      if (line.startsWith('SECTION:')) {
        section = { name: line.replace('SECTION:', '').trim(), change: '', color: undefined };
      } else if (line.startsWith('CHANGE:') && section) {
        section.change = line.replace('CHANGE:', '').trim();
      } else if (line.startsWith('COLOR:') && section) {
        section.color = line.replace('COLOR:', '').trim();
      }
    });

    if (section?.name && section?.change) {
      sections.push(section);
      console.log("[PARSER] Block ${blockIdx}: ${section.name} → ${section.change.slice(0, 50)}...");
    }
  });

  return { sections, rawText: aiText };
}

// ─── Color Harmony Validation ─────────────────────────────────
function validateColorHarmony(hslColor: string, baseHSL: string): { harmonic: boolean; reason: string } {
  try {
    const hueNew = parseInt(hslColor.split(' ')[0]);
    const hueBase = parseInt(baseHSL.split(' ')[0]);
    const hueDiff = Math.abs(hueNew - hueBase);
    const minDiff = Math.min(hueDiff, 360 - hueDiff);

    // Check if colors are complementary, analogous, or triadic
    if (minDiff === 0) return { harmonic: false, reason: "Same hue (no contrast)" };
    if (minDiff < 30) return { harmonic: true, reason: "Analogous (harmonious)" };
    if (Math.abs(minDiff - 180) < 15) return { harmonic: true, reason: "Complementary (striking)" };
    if (Math.abs(minDiff - 120) < 15) return { harmonic: true, reason: "Triadic (balanced)" };
    return { harmonic: true, reason: "Novel combination (bold)" };
  } catch {
    return { harmonic: false, reason: "Invalid HSL format" };
  }
}

// ─── Semantic validation ──────────────────────────────────────
function validateDesignSections(sections: ParsedSection[], currentDesign?: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validSections = ['header', 'hero', 'products', 'categories', 'cta', 'footer'];

  if (!sections || sections.length === 0) {
    errors.push("No design sections found in response");
    return { valid: false, errors };
  }

  // Require at least 2 sections for design changes (not just 1)
  if (sections.length < 2) {
    errors.push("Only " + sections.length + " section found. Please update at least 2-3 sections for a complete design");
    return { valid: false, errors };
  }

  sections.forEach((section, idx) => {
    // Validate section name
    const sectionName = section.name.toLowerCase().trim();
    if (!validSections.some(vs => sectionName.includes(vs))) {
      errors.push("Section " + (idx + 1) + ": \"" + section.name + "\" not recognized. Use: " + validSections.join(", "));
    }

    // Validate change description
    if (!section.change || section.change.length < 3) {
      errors.push("Section " + (idx + 1) + ": Change description too short");
    }

    // Validate color format if provided
    if (section.color && !section.color.match(/^\d+\s+\d+%\s+\d+%$/)) {
      errors.push("Section " + (idx + 1) + ": Color format invalid. Use HSL like \"220 85% 45%\"");
    } else if (section.color && currentDesign?.css_variables?.primary) {
      // Check color harmony with existing primary color
      const harmony = validateColorHarmony(section.color, currentDesign.css_variables.primary);
      console.log("[HARMONY] Section \"" + section.name + "\": " + harmony.reason);
    }
  });

  console.log("[VALIDATION] Sections: " + sections.length + ", Errors: " + (errors.length === 0 ? "Valid" : errors.length));
  return { valid: errors.length === 0, errors };
}

// ─── Convert parsed sections to design JSON ───────────────────
function buildDesignFromSections(sections: ParsedSection[], message: string): any {
  const cssVariables: Record<string, string> = {};
  const changesList: string[] = [];
  const cssOverrides: string[] = [];

  // Real CSS variables used by the store
  const realVarDefaults: Record<string, string> = {
    'primary': '217 91% 60%',      // Buttons, links, accents
    'background': '210 40% 98%',   // Page background
    'foreground': '222 47% 11%',   // Text color
    'card': '0 0% 100%',           // Card backgrounds
    'card-foreground': '222 47% 11%',
    'muted': '210 40% 96%',        // Subtle backgrounds
    'muted-foreground': '215 16% 47%',
    'border': '214 32% 91%',       // Borders
    'radius': '0.75rem',           // Border radius
    'accent': '210 40% 96%',       // Hover accents
    'secondary': '210 40% 96%',
  };

  // Start with defaults
  Object.assign(cssVariables, realVarDefaults);

  // Map sections to real CSS variables
  const sectionToVarMap: Record<string, string[]> = {
    'header': ['primary', 'radius'],
    'hero': ['background', 'primary'],
    'products': ['card', 'primary', 'radius'],
    'categories': ['card', 'radius'],
    'cta': ['primary', 'secondary'],
    'footer': ['background', 'foreground'],
  };

  sections.forEach(section => {
    const sectionName = Object.keys(sectionToVarMap).find(key =>
      section.name.toLowerCase().includes(key)
    ) || 'primary';

    // Add to changes list
    changesList.push(`${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} → ${section.change}");

    // If color provided, apply it to the main variable for this section
    if (section.color) {
      const vars = sectionToVarMap[sectionName] || ['primary'];
      const mainVar = vars[0]; // Apply to first variable in the section
      cssVariables[mainVar] = section.color;
      console.log("[MAP] Section "${sectionName}" → variable "--${mainVar}" = ${section.color}");

      // Parse change description for creative effects
      const changeLower = section.change.toLowerCase();

      // Rounded corners
      if (changeLower.includes('rounded') || changeLower.includes('pill')) {
        cssVariables['radius'] = '1.5rem';
      }

      // Shadow effects
      if (changeLower.includes('shadow')) {
        cssOverrides.push(`[data-ai="${sectionName}"] { box-shadow: 0 8px 24px hsla(0, 0%, 0%, 0.2); }");
      }

      // Glassmorphism
      if (changeLower.includes('glass') || changeLower.includes('blur')) {
        cssOverrides.push(`[data-ai="${sectionName}"] { backdrop-filter: blur(12px); background: hsla(${section.color}, 0.75); border: 1px solid hsla(255, 255%, 255%, 0.2); }");
      }

      // Gradients
      if (changeLower.includes('gradient') || changeLower.includes('smooth fade')) {
        const hslValues = section.color.split(' ');
        const baseHue = parseInt(hslValues[0]) || 220;
        cssOverrides.push(`[data-ai="${sectionName}"] { background: linear-gradient(135deg, hsl(${baseHue} 90% 50%), hsl(${baseHue + 40} 85% 60%)); }");
      }

      // Glow/Neon effects
      if (changeLower.includes('glow') || changeLower.includes('neon') || changeLower.includes('glowing')) {
        cssOverrides.push(`[data-ai="${sectionName}"] { box-shadow: 0 0 20px hsl(${section.color}), 0 0 40px hsla(${section.color}, 0.5); }");
      }

      // Holographic/Shimmer
      if (changeLower.includes('holographic') || changeLower.includes('shimmer') || changeLower.includes('iridescent')) {
        cssOverrides.push(`[data-ai="${sectionName}"] { background: linear-gradient(45deg, hsl(${section.color}), hsl(${parseInt(section.color.split(' ')[0]) + 60} 90% 55%)); animation: shimmer 3s infinite; }");
      }

      // Hover effects
      if (changeLower.includes('hover') || changeLower.includes('lift') || changeLower.includes('animation')) {
        cssOverrides.push(`[data-ai="${sectionName}"]:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 12px 32px hsla(0, 0%, 0%, 0.25); transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }");
      }

      // Bold/Vibrant
      if (changeLower.includes('bold') || changeLower.includes('vibrant') || changeLower.includes('striking')) {
        cssVariables['primary'] = section.color;
        cssVariables['accent'] = section.color;
      }
    }
  });

  // Dark mode variables (adjusted for dark backgrounds)
  const darkCssVariables: Record<string, string> = {
    'primary': cssVariables['primary'], // Keep primary bright
    'background': '222 47% 8%',         // Dark background
    'foreground': '210 40% 98%',        // Light text
    'card': '222 47% 12%',              // Dark cards
    'muted': '217 33% 17%',
    'border': '217 33% 17%',
  };

  console.log('[DESIGN] Final CSS variables:', cssVariables);
  console.log('[DESIGN] Dark mode variables:', darkCssVariables);
  console.log('[DESIGN] CSS overrides:', cssOverrides.length, 'rules');

  return {
    summary: "Updated " + sections.length + " section" + (sections.length > 1 ? "s" : "") + " with warm colors and smooth effects",
    css_variables: cssVariables,
    dark_css_variables: darkCssVariables,
    css_overrides: cssOverrides.join('\n'),
    changes_list: changesList,
  };
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
function buildSystemPrompt(storeName: string, currentDesign: any, theme: string = "light", storeType: string = "general"): string {
  // Get full design system context for AI
  const designContext = buildDesignSystemContext(currentDesign, storeType);

  const currentDesignText = currentDesign
    ? "CURRENT DESIGN (your baseline — preserve everything not mentioned in the request):\n" + JSON.stringify(currentDesign, null, 2) + "\n\n"
    : "CURRENT DESIGN: Platform defaults (fresh start — full creative freedom)\n\n";

  // Build available colors reference
  const colorsReference = Object.entries(designContext.availableColors)
    .map(([name, hsl]) => `• ${name}: "${hsl}"`)
    .join("\n");

  // Build capabilities reference
  const capabilitiesReference = designContext.componentCapabilities
    .map(cap => `• ${cap}`)
    .join("\n");

  const contextInfo = `
### DESIGN SYSTEM KNOWLEDGE (Use This!)
You have FULL ACCESS to the store's design system:

AVAILABLE COLORS (use exact HSL values):
${colorsReference}

WHAT YOU CAN STYLE:
${capabilitiesReference}

DESIGN CONSTRAINTS:
• Minimum contrast ratio: 4.5:1 (WCAG AA)
• Maximum saturation: 100%
• Allowed effects: gradient, shadow, blur, glow, animation

CURRENT STATE (Don't ignore this):
${JSON.stringify(designContext.currentState, null, 2)}

STORE TYPE: ${storeType}
Use design principles for: ${storeType} stores (see best practices below)

STORE TYPE BEST PRACTICES:
${storeType === "food" ? "• Warm orange/yellow tones • Rounded, friendly shapes • Appetizing visuals" :
 storeType === "fashion" ? "• Elegant, minimal colors • Bold typography • White space" :
 storeType === "tech" ? "• Cool blues/purples • Modern effects • Glassmorphism" :
 storeType === "luxury" ? "• Gold accents • Dark backgrounds • Premium shadows" :
 "• Depends on store - be creative within constraints"}
`;

  return `You are a store design AI that outputs PLAIN TEXT ONLY.
Your entire output must be in SECTION/CHANGE/COLOR format.
NO JSON. NO MARKDOWN. NO EXPLANATIONS OUTSIDE THE FORMAT.

Output 3-4 design sections with creative changes:
SECTION: [header/hero/products/categories/cta/footer]
CHANGE: [what you changed]
COLOR: [HSL like "280 95% 60%"]
---

Be creative. Use bold colors. Suggest effects. Reference available colors.
Always output at least 3 sections. Never less.

${currentDesignText}
${contextInfo}
Format example:
SECTION: header
CHANGE: Glass effect with purple gradient
COLOR: 280 95% 60%
---
SECTION: products
CHANGE: Smooth lift animation on hover
COLOR: 142 71% 45%
---
SECTION: footer
CHANGE: Dark background with golden text
COLOR: 45 93% 47%
---

Rules:
• Output minimum 3 sections
• Colors are HSL only: "280 95% 60%"
• Bold effects: gradients, glows, shadows, blur
• No JSON, no markdown, no explanations


CRITICAL RULES FOR OUTPUT:
1. PLAIN TEXT ONLY — NO JSON, NO MARKDOWN, NO CODE BLOCKS
2. Output EXACTLY in this format (repeat 3-4 times for different sections):
   SECTION: header
   CHANGE: Description of what changed
   COLOR: 280 95% 60%
   ---
3. Do NOT output JSON. Do NOT use { } or [ ]. Do NOT write "Design proposed:"
4. Each section needs SECTION and CHANGE. COLOR is optional.
5. Section names: header, hero, products, categories, cta, footer
6. Colors: HSL only like "280 95% 60%" — no hsl() or hex codes
7. Output minimum 3 sections, maximum 6 sections
8. If user says "flat/minimal/no effects" → use solid colors, no gradients
9. If prompt is vague → ask one clarifying question first
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

    // Helper: Enhanced prompt for retries
    const enhancePromptForRetry = (basePrompt: string, attempt: number, lastError: string, designContext?: DesignSystemContext): string => {
      const hints = [
        "Use EXACTLY the SECTION/CHANGE/COLOR format. Colors MUST be valid HSL.",
        "Each section needs SECTION: and CHANGE: lines. Separate with ---.",
        "Output AT LEAST 3 complete sections.",
      ];
      const hint = hints[attempt % hints.length];
      let result = basePrompt + "\n\nRETRY " + (attempt + 1) + ": " + lastError + "\n" + hint;
      if (attempt > 0 && designContext) {
        const colors = Object.keys(designContext.availableColors).slice(0, 3).join(", ");
        result += "\nColors: " + colors;
      }
      return result;
    };

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
      console.log("[CHAT] AI response received");
      let rawContent = aiData.choices?.[0]?.message?.content || "";
      console.log("[CHAT] Raw content (${rawContent.length} chars): ${rawContent.slice(0, 100)}...");

      // ─── SMART RETRY LOGIC ───────────────────────────────────────
      let currentPrompt = userPrompt;
      let lastError = "";
      let parsed: any = null;
      const maxRetries = 2;

      // Build design context once for all retry attempts
      const designContext = buildDesignSystemContext(designState?.current_design, "general");
      console.log("[CONTEXT] Design system context built. Available: ${designContext.availableColors ? Object.keys(designContext.availableColors).length : 0} colors, ${designContext.componentCapabilities?.length || 0} capabilities");

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log("[ATTEMPT] ${attempt + 1}/${maxRetries + 1} - Parsing AI output (${rawContent.length} chars)");

          // Try to parse as text format (new approach)
          const { sections, rawText } = parseDesignText(rawContent);
          console.log("[PARSE] Found ${sections.length} sections: ${sections.map(s => s.name).join(", ")}");

          // Validate sections with design context (for color harmony checking)
          const validation = validateDesignSections(sections, designState?.current_design);

          if (!validation.valid) {
            lastError = validation.errors.join("; ");
            console.warn(`[VALIDATION] Failed: ${lastError}");
            throw new Error(lastError);
          }

          // Convert to design JSON
          const designFromText = buildDesignFromSections(sections, "Design generated successfully");

          parsed = {
            type: "design",
            message: "Updated " + sections.length + " section" + (sections.length > 1 ? "s" : "") + " with your design changes",
            design: designFromText,
          };

          console.log("[SUCCESS] ✅ Parsed design with ${sections.length} sections on attempt ${attempt + 1}");
          break; // Success, exit retry loop

        } catch (parseError: any) {
          lastError = parseError.message;
          console.warn(`[PARSE_ERROR] Attempt ${attempt + 1}: ${lastError}");

          if (attempt < maxRetries) {
            // Retry with enhanced prompt that includes design context
            console.log("[RETRY] Enhancing prompt for attempt ${attempt + 2} with design context...");
            currentPrompt = enhancePromptForRetry(userPrompt, attempt, lastError, designContext);

            // Call AI again with modified prompt and lower temperature
            try {
              const retryResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": "Bearer " + apiKey,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://yesgive.shop",
                  "X-Title": "Vendy Buildr AI Designer",
                },
                body: JSON.stringify({
                  model,
                  messages: [{ role: "system", content: systemPrompt }, ...messages, { role: "user", content: currentPrompt }],
                  max_tokens: 4000,
                  temperature: 0.05, // Lower temp for retries (more deterministic)
                }),
              });

              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                rawContent = retryData.choices?.[0]?.message?.content || "";
                console.log("[RETRY] ✓ New AI response received (${rawContent.length} chars) on attempt ${attempt + 2}");
              } else {
                console.error(`[RETRY] ✗ Retry fetch failed: ${retryResponse.status}");
              }
            } catch (retryErr) {
              console.error(`[RETRY] ✗ Retry error:`, retryErr);
            }
          } else {
            console.log("[RETRY] Max retries (${maxRetries}) exhausted. Will use fallback.");
          }
        }
      }

      // ─── FALLBACK HANDLER ───────────────────────────────────────
      if (!parsed) {
        console.error(`[FALLBACK] ✗ All ${maxRetries + 1} retry attempts exhausted. Error: ${lastError}");
        console.error(`[FALLBACK] Last AI output (first 500 chars): ${rawContent.substring(0, 500)}");

        // Log failure for monitoring (critical for debugging)
        const failureRecord = {
          store_id,
          user_id,
          user_prompt: userPrompt,
          error_message: lastError,
          model,
          raw_ai_output: rawContent.substring(0, 2000),
          attempt_count: maxRetries + 1,
          created_at: new Date().toISOString(),
          status: "pending_review" as const,
        };

        await supabase.from("ai_generation_failures").insert(failureRecord)
          .catch(e => console.error("[FAILURE_LOG_ERROR]", e.message));

        console.log("[FALLBACK] Logged failure to ai_generation_failures for manual review");

        // Save to history as text
        const { data: fallbackHistoryRow } = await supabase.from("ai_designer_history").insert({
          store_id, user_id, prompt: userPrompt,
          ai_response: { type: "text", message: "Design generation encountered an issue. Please try again with a simpler request." },
          ai_css_overrides: null, tokens_used: 0, applied: false,
        }).select("id").single().catch(() => ({ data: null }));

        console.log("[FALLBACK] Saved fallback response to history");

        return new Response(JSON.stringify({
          success: true, type: "text",
          message: "I had trouble understanding that request. Could you describe the design more clearly? For example: 'Make the header blue' or 'Add glass effects'",
          history_id: fallbackHistoryRow?.id || null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const responseType = parsed.type || "text";

      // If design response — sanitize CSS, normalize keys, log quality metrics
      if (responseType === "design" && parsed.design) {
        const d = parsed.design;

        // Log design quality metrics for monitoring
        const designQuality = {
          sections_count: d.changes_list?.length || 0,
          css_variables_count: Object.keys(d.css_variables || {}).length,
          has_dark_vars: !!d.dark_css_variables && Object.keys(d.dark_css_variables).length > 0,
          has_css_overrides: !!d.css_overrides && d.css_overrides.length > 0,
          has_layout_config: !!d.layout && Object.keys(d.layout).length > 0,
          has_fonts: !!d.fonts && (!!d.fonts.heading || !!d.fonts.body),
          summary_length: d.summary?.length || 0,
        };
        console.log("[QUALITY] Design metrics:", JSON.stringify(designQuality));

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
            fonts: d.fonts || {},
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
      let genContent = genData.choices?.[0]?.message?.content || "";
      console.log("[GENERATE] Initial AI response (${genContent.length} chars): ${genContent.slice(0, 80)}...");

      // Try parsing as text format first (enterprise approach)
      const genContext = buildDesignSystemContext(genDesignState?.current_design, "general");
      let genParsed: any = null;
      let genLastError = "";

      for (let genAttempt = 0; genAttempt <= 2; genAttempt++) {
        try {
          console.log("[GENERATE] Parse attempt ${genAttempt + 1}/3");

          // Try text format parsing
          const { sections, rawText } = parseDesignText(genContent);
          console.log("[GENERATE] Found ${sections.length} sections");

          const genValidation = validateDesignSections(sections, genDesignState?.current_design);
          if (!genValidation.valid) {
            genLastError = genValidation.errors.join("; ");
            throw new Error(genLastError);
          }

          const designFromText = buildDesignFromSections(sections, "Design generated successfully");
          genParsed = {
            type: "design",
            message: `✅ Generated ${sections.length} section${sections.length > 1 ? 's' : ''} with design changes`,
            design: designFromText,
          };
          console.log("[GENERATE] ✅ Successfully parsed on attempt ${genAttempt + 1}");
          break;

        } catch (parseErr: any) {
          genLastError = parseErr.message;
          console.warn(`[GENERATE] Parse failed attempt ${genAttempt + 1}: ${genLastError}");

          if (genAttempt < 2) {
            // Retry with enhanced prompt
            try {
              const retryGenResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": "Bearer " + genSettings.openrouter_api_key.trim(),
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://yesgive.shop",
                  "X-Title": "Vendy Buildr AI Designer",
                },
                body: JSON.stringify({
                  model: (genSettings.openrouter_model || "moonshotai/kimi-k2").trim(),
                  messages: [
                    { role: "system", content: genSystemPrompt },
                    { role: "user", content: enhancePromptForRetry(prompt, genAttempt, genLastError, genContext) }
                  ],
                  max_tokens: 4000,
                  temperature: 0.05,
                }),
              });

              if (retryGenResponse.ok) {
                const retryGenData = await retryGenResponse.json();
                genContent = retryGenData.choices?.[0]?.message?.content || "";
                console.log("[GENERATE] Retry ${genAttempt + 2} received (${genContent.length} chars)");
              }
            } catch (retryErr) {
              console.error(`[GENERATE] Retry failed:`, retryErr);
            }
          }
        }
      }

      // Fallback if parsing failed
      if (!genParsed) {
        console.warn(`[GENERATE] All parse attempts exhausted. Logging failure.");
        await supabase.from("ai_generation_failures").insert({
          store_id, user_id, user_prompt: prompt,
          error_message: genLastError,
          model: genSettings.openrouter_model || "moonshotai/kimi-k2",
          raw_ai_output: genContent.substring(0, 2000),
          attempt_count: 3,
        }).catch(e => console.error("[LOG_ERROR]", e.message));

        return new Response(JSON.stringify({
          success: true, type: "text",
          message: "I couldn't generate that design. Try describing it differently, like 'Make the header purple' or 'Add rounded cards'.",
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
          ai_response: { summary: d.summary, changes_list: d.changes_list, layout: d.layout, css_variables: d.css_variables, fonts: d.fonts || {} },
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

      // Fallback text response
      return new Response(JSON.stringify({
        success: true, type: "text", message: genParsed.message || genContent || "Design generation complete."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
