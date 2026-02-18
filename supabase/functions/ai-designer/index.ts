import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SETTINGS_ID = "00000000-0000-0000-0000-000000000000";
const MAX_CSS_SIZE = 15000; // 15KB limit
const MAX_RESPONSE_SIZE = 10000; // 10KB limit

// FIX #6: UUID validation helper
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// FIX #9: In-memory rate limiting (resets on function restart, good enough for edge functions)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(storeId: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(storeId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(storeId, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (entry.count >= maxRequests) return false; // blocked
  entry.count++;
  return true; // allowed
}

// FIX #16: Detect AI content policy refusal
function isAIRefusal(content: string): boolean {
  if (!content) return false;
  const refusalPhrases = [
    "i'm sorry", "i cannot", "i can't", "i am not able", "i'm not able",
    "i'm unable", "i am unable", "not appropriate", "against my guidelines",
    "i must decline", "i will not", "harmful content", "as an ai",
  ];
  const lower = content.toLowerCase();
  return refusalPhrases.some(phrase => lower.includes(phrase)) && !lower.startsWith("{");
}

// ============================================
// DELTA/ACTIONS ARCHITECTURE - NEW SCHEMA
// ============================================

const DesignChangeSchema = z.object({
  action_type: z.enum(["css_variable", "css_variable_dark", "css_override", "layout"]),
  key: z.string().optional(), // for css_variable and layout
  selector: z.string().optional(), // for css_override
  css: z.string().optional(), // for css_override
  value: z.string().optional(), // for css_variable and layout
});

const DeltaDesignSchema = z.object({
  summary: z.string(),
  changes: z.array(DesignChangeSchema),
  changes_list: z.array(z.string()),
});

// FIX #13: HSL value validator - accepts "217 91% 60%" or "0.5rem" (for --radius) or any valid CSS value
const cssValueValidator = z.string().refine((val) => {
  // Allow --radius and other non-color values
  if (val.includes("rem") || val.includes("px") || val.includes("em")) return true;
  // HSL format: "H S% L%" (no hsl() wrapper)
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(val)) return true;
  // Allow any short value (less than 50 chars) to be flexible
  return val.length < 50;
}, { message: "Invalid CSS variable value" });

// Legacy schema (for backward compatibility during transition)
const LegacyDesignSchema = z.object({
  summary: z.string(),
  css_variables: z.record(cssValueValidator).optional(),
  dark_css_variables: z.record(cssValueValidator).optional(),
  layout: z.object({
    product_grid_cols: z.enum(["2", "3", "4"]).optional(),
    section_padding: z.enum(["compact", "normal", "spacious"]).optional(),
    hero_style: z.enum(["image", "gradient"]).optional(),
  }).optional(),
  css_overrides: z.string().optional(),
  changes_list: z.array(z.string()),
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// FIX #6: CSS Minification - preserves strings in content properties
function minifyCSS(css: string): string {
  if (!css || typeof css !== "string") return "";

  // Preserve content: "..." strings by temporarily replacing them
  const contentStrings: string[] = [];
  let tempCss = css.replace(/content\s*:\s*["']([^"']*)["']/gi, (match) => {
    contentStrings.push(match);
    return `CONTENT_PLACEHOLDER_${contentStrings.length - 1}`;
  });

  // Minify
  tempCss = tempCss
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, "$1") // Remove spaces around special chars
    .replace(/;}/g, "}") // Remove last semicolon in block
    .trim();

  // Restore content strings
  tempCss = tempCss.replace(/CONTENT_PLACEHOLDER_(\d+)/g, (match, index) => {
    return contentStrings[parseInt(index)];
  });

  return tempCss;
}

// Response size validation
function validateResponseSize(design: any, cssOverrides: string): { valid: boolean; error?: string } {
  const designSize = JSON.stringify(design).length;
  const cssSize = cssOverrides.length;

  if (cssSize > MAX_CSS_SIZE) {
    return { valid: false, error: `CSS too large (${cssSize} > ${MAX_CSS_SIZE} chars). Please simplify.` };
  }

  if (designSize > MAX_RESPONSE_SIZE) {
    return { valid: false, error: `Response too large (${designSize} > ${MAX_RESPONSE_SIZE} chars). Please simplify.` };
  }

  return { valid: true };
}

// Extract JSON from AI response (handles markdown wrappers)
function extractJSON(content: string): any {
  try { return JSON.parse(content); } catch { /* continue */ }
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(content.slice(start, end + 1)); } catch { /* continue */ }
  }
  throw new Error("Could not parse AI response as JSON");
}

// FIX #1: Prompt similarity detection for failure tracking
function calculatePromptSimilarity(prompt1: string, prompt2: string): number {
  const keywords1 = extractKeywords(prompt1);
  const keywords2 = extractKeywords(prompt2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const intersection = keywords1.filter(k => keywords2.includes(k)).length;
  const union = new Set([...keywords1, ...keywords2]).size;

  return intersection / union; // Jaccard similarity
}

// FIX #10: Synonym expansion for better semantic similarity detection
const DESIGN_SYNONYMS: Record<string, string> = {
  "colour": "color", "colours": "color", "colors": "color",
  "btn": "button", "buttons": "button",
  "bg": "background", "backgrounds": "background",
  "txt": "text", "texts": "text",
  "hdr": "header", "nav": "header", "navbar": "header",
  "ftr": "footer", "foot": "footer",
  "img": "image", "images": "image", "photo": "image",
  "card": "product-card", "cards": "product-card",
  "invisible": "visible", "hidden": "visible", "can't see": "visible",
  "font": "text", "typography": "text",
  "padding": "spacing", "margin": "spacing", "space": "spacing",
  "round": "radius", "rounded": "radius", "circular": "radius",
  "dark": "theme", "light": "theme", "mode": "theme",
};

function extractKeywords(prompt: string): string[] {
  const stopWords = ["the", "a", "an", "is", "are", "not", "to", "in", "on", "it", "make", "change", "please", "can", "you"];
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  // Expand synonyms
  return words.map(word => DESIGN_SYNONYMS[word] || word);
}

// Classify if prompt needs full design context or is casual chat
function isDesignRequest(prompt: string): boolean {
  const designKeywords = [
    "color", "colour", "blue", "red", "green", "yellow", "purple", "pink", "orange",
    "design", "style", "layout", "change", "make", "update", "modify", "add",
    "button", "card", "section", "header", "footer", "banner", "product",
    "font", "text", "size", "padding", "margin", "border", "radius", "round",
    "shadow", "gradient", "background", "foreground", "theme",
    "dark", "light", "modern", "elegant", "minimalist", "bold",
    "spacing", "grid", "column", "row", "align", "center", "fix", "visible"
  ];
  const lowerPrompt = prompt.toLowerCase();
  if (prompt.length < 20 && !designKeywords.some(kw => lowerPrompt.includes(kw))) {
    return false;
  }
  return designKeywords.some(keyword => lowerPrompt.includes(keyword));
}

// Retry with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 400 && response.status < 500) return response;
      if (response.status >= 500 && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return response;
    } catch (error: any) {
      lastError = error;
      if (error.name === "AbortError") throw error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("Max retries exceeded");
}

// Log metrics for monitoring
async function logMetrics(supabase: any, data: {
  store_id: string;
  user_id?: string;
  action: string;
  model_used?: string;
  tokens_consumed?: number;
  latency_ms?: number;
  success: boolean;
  error_type?: string;
  prompt_length?: number;
  design_published?: boolean;
  css_sanitized?: boolean;
}): Promise<void> {
  try {
    await supabase.from("ai_designer_metrics").insert({
      store_id: data.store_id,
      user_id: data.user_id || null,
      action: data.action,
      model_used: data.model_used || null,
      tokens_consumed: data.tokens_consumed || 0,
      latency_ms: data.latency_ms || null,
      success: data.success,
      error_type: data.error_type || null,
      prompt_length: data.prompt_length || null,
      design_published: data.design_published || false,
      css_sanitized: data.css_sanitized || false,
    });
  } catch (error) {
    console.error("Failed to log metrics:", error);
  }
}

// CSS Sanitization - blocks dangerous patterns
function sanitizeCSS(css: string): { safe: boolean; sanitized: string; blocked: string[] } {
  if (!css || typeof css !== "string") {
    return { safe: true, sanitized: "", blocked: [] };
  }
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

// Call AI with fallback model support
async function callAIWithFallback(
  primaryModel: string,
  fallbackModel: string | null,
  apiKey: string,
  requestBody: any,
  signal?: AbortSignal
): Promise<{ response: Response; modelUsed: string }> {
  const modelChain = fallbackModel && fallbackModel !== primaryModel
    ? [primaryModel, fallbackModel]
    : [primaryModel];
  let lastError: any = null;
  for (const model of modelChain) {
    try {
      console.log("Trying model:", model);
      const response = await fetchWithRetry(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://yesgive.shop",
            "X-Title": "Vendy Buildr AI Designer",
          },
          body: JSON.stringify({ ...requestBody, model }),
          signal
        },
        3
      );
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        if (model !== primaryModel) {
          console.log("Fallback used:", primaryModel, "->", model);
        }
        return { response, modelUsed: model };
      }
      lastError = await response.text();
      console.log("Model", model, "failed:", response.status);
    } catch (error: any) {
      lastError = error;
      console.log("Model", model, "error:", error.message);
    }
  }
  throw lastError || new Error("All AI models failed");
}

// ============================================
// DELTA/ACTIONS: APPLY CHANGES TO CURRENT DESIGN
// ============================================

// FIX #2 + #4: Parse CSS and extract selectors for deduplication, handles @media/@keyframes
function parseCSSSelectors(css: string): Map<string, string> {
  const selectorMap = new Map<string, string>();
  if (!css) return selectorMap;

  let i = 0;
  while (i < css.length) {
    // Skip whitespace
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length) break;

    // Find start of selector or at-rule
    const start = i;
    // Read until first {
    while (i < css.length && css[i] !== "{") i++;
    if (i >= css.length) break;

    const selector = css.slice(start, i).trim();
    i++; // skip {

    // For @media/@keyframes, find matching closing brace (nested)
    if (selector.startsWith("@media") || selector.startsWith("@keyframes") || selector.startsWith("@supports")) {
      let depth = 1;
      const blockStart = i;
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}") depth--;
        i++;
      }
      const blockContent = css.slice(blockStart, i - 1).trim();
      // Store at-rule with a unique key (append index to handle multiple @media)
      const key = selector + "_" + selectorMap.size;
      selectorMap.set(key, blockContent);
    } else {
      // Regular selector - read until }
      const blockStart = i;
      while (i < css.length && css[i] !== "}") i++;
      const rules = css.slice(blockStart, i).trim();
      i++; // skip }
      if (selector && rules) {
        selectorMap.set(selector, rules);
      }
    }
  }

  return selectorMap;
}

// FIX #2 + #4: Rebuild CSS from selector map, handles at-rules
function rebuildCSS(selectorMap: Map<string, string>): string {
  const blocks: string[] = [];
  selectorMap.forEach((rules, selector) => {
    // Strip _index suffix from at-rule keys (added during parsing for deduplication)
    const cleanSelector = selector.replace(/_\d+$/, "");
    if (cleanSelector.startsWith("@media") || cleanSelector.startsWith("@keyframes") || cleanSelector.startsWith("@supports")) {
      blocks.push(`${cleanSelector} { ${rules} }`);
    } else {
      blocks.push(`${selector} { ${rules} }`);
    }
  });
  return blocks.join("\n");
}

function applyDeltaChanges(currentDesign: any, changes: any[]): any {
  const result = {
    css_variables: { ...(currentDesign?.css_variables || {}) },
    dark_css_variables: { ...(currentDesign?.dark_css_variables || {}) },
    layout: { ...(currentDesign?.layout || {}) },
    css_overrides: currentDesign?.css_overrides || "",
  };

  // FIX #2: Parse existing CSS into selector map for deduplication
  const cssMap = parseCSSSelectors(result.css_overrides);

  for (const change of changes) {
    switch (change.action_type) {
      case "css_variable":
        if (change.key && change.value) {
          result.css_variables[change.key] = change.value;
        }
        break;

      case "css_variable_dark":
        if (change.key && change.value) {
          result.dark_css_variables[change.key] = change.value;
        }
        break;

      case "layout":
        if (change.key && change.value) {
          result.layout[change.key] = change.value;
        }
        break;

      case "css_override":
        if (change.selector && change.css) {
          // FIX #2: Replace if selector exists, otherwise add
          cssMap.set(change.selector, change.css);
        }
        break;
    }
  }

  // FIX #2: Rebuild CSS from deduplicated selector map
  result.css_overrides = rebuildCSS(cssMap);

  return result;
}

// Convert Delta format to Legacy format (for database storage)
function deltaToLegacy(deltaDesign: any, currentDesign: any): any {
  const merged = applyDeltaChanges(currentDesign, deltaDesign.changes);

  return {
    summary: deltaDesign.summary,
    css_variables: Object.keys(merged.css_variables).length > 0 ? merged.css_variables : undefined,
    dark_css_variables: Object.keys(merged.dark_css_variables).length > 0 ? merged.dark_css_variables : undefined,
    layout: Object.keys(merged.layout).length > 0 ? merged.layout : undefined,
    css_overrides: merged.css_overrides || undefined,
    changes_list: deltaDesign.changes_list,
  };
}

// ============================================
// SYSTEM PROMPTS (Updated for Delta/Actions with FULL context)
// ============================================

// Build simple design system prompt (for generate_design action - backward compatibility)
function buildDesignSystemPrompt(storeName: string, currentDesign: any): string {
  const designContext = currentDesign
    ? "Current store design: " + JSON.stringify(currentDesign) + "\nPreserve existing settings unless user asks to change them."
    : "Store is using platform defaults.";

  const storeSections =
    "STORE SECTIONS (use data-ai selectors in css_overrides):\n" +
    "1. Header [data-ai=\"header\"] - Logo, navigation, cart icon, search\n" +
    "2. Hero Banner [data-ai=\"section-hero\"] - Main promotional banner with CTA\n" +
    "3. Categories Grid [data-ai=\"section-categories\"] - Category cards with images\n" +
    "4. Featured Products [data-ai=\"section-featured\"] - Product cards grid\n" +
    "5. Product Card [data-ai=\"product-card\"] - Image, title, price, add-to-cart\n" +
    "6. Testimonials [data-ai=\"section-testimonials\"] - Customer reviews carousel\n" +
    "7. Footer [data-ai=\"footer\"] - Links, contact info, social icons\n";

  const cssVariables =
    "CSS VARIABLES (HSL format without hsl() wrapper):\n" +
    "--primary: 217 91% 60%        (buttons, links, accents)\n" +
    "--background: 0 0% 100%       (page background)\n" +
    "--foreground: 222 47% 11%     (main text color)\n" +
    "--card: 0 0% 100%             (card backgrounds)\n" +
    "--muted: 210 40% 96%          (subtle backgrounds)\n" +
    "--muted-foreground: 215 16% 47%   (secondary text)\n" +
    "--border: 214 32% 91%         (border color)\n" +
    "--radius: 0.5rem              (border radius)\n";

  const responseFormat =
    "RESPOND IN JSON FORMAT ONLY:\n" +
    "For text/chat: {\"type\":\"text\",\"message\":\"your response\"}\n" +
    "For design changes: {\"type\":\"design\",\"message\":\"description\",\"design\":{" +
    "\"summary\":\"Brief summary\",\"css_variables\":{\"--primary\":\"217 91% 60%\"}," +
    "\"layout\":{\"product_grid_cols\":\"3\"}," +
    "\"css_overrides\":\"[data-ai='section-hero'] { ... }\"," +
    "\"changes_list\":[\"Change 1\",\"Change 2\"]}}\n\n" +
    "Start response with { and end with }. No markdown code blocks.";

  return "You are an expert UI/UX designer for the e-commerce store: " + storeName + ".\n" +
    designContext + "\n\n" +
    storeSections + "\n" +
    cssVariables + "\n" +
    responseFormat;
}

// Build FULL detailed system prompt for design requests in chat (comprehensive version)
function buildFullChatSystemPrompt(storeName: string, storeDescription: string, currentDesign: any, historyRecords: any[], currentPrompt: string): string {
  const currentDesignContext = currentDesign
    ? "\n===== CURRENT PUBLISHED DESIGN =====\n" +
      "This store currently has these customizations applied:\n" +
      JSON.stringify(currentDesign, null, 2) + "\n\n" +
      "CRITICAL: PRESERVE all above settings unless the user explicitly asks to change them.\n" +
      "Only modify what the user specifically requests. Build on existing design incrementally.\n" +
      "=====\n"
    : "\n===== CURRENT DESIGN =====\nStore is using platform defaults (no customizations yet).\n=====\n";

  // FIX #1: Improved failure tracking - detect SIMILAR prompts only
  let failureContext = "";
  if (historyRecords && historyRecords.length > 0) {
    const failedAttempts = historyRecords.filter((r: any) => !r.applied);

    const similarFailures = failedAttempts.filter((r: any) => {
      const similarity = calculatePromptSimilarity(currentPrompt, r.prompt);
      return similarity > 0.3;
    });

    if (similarFailures.length >= 2) {
      failureContext = "\n⚠️ IMPORTANT - FAILURE DETECTED ⚠️\n" +
        `This SAME issue has been attempted ${similarFailures.length} times and FAILED.\n` +
        "Previous solutions did NOT work. You MUST try a DIFFERENT technical approach.\n\n" +
        "Failed attempts for similar issue:\n";
      similarFailures.slice(0, 2).forEach((record: any, idx: number) => {
        failureContext += `${idx + 1}. User asked: "${record.prompt}"\n   Status: NOT APPLIED (rejected by user)\n\n`;
      });
      failureContext += "Try a completely different CSS strategy this time (e.g., if you used 'color' before, try 'opacity' or 'filter' now).\n=====\n\n";
    }
  }

  // History context
  let historyContext = "";
  if (historyRecords && historyRecords.length > 0) {
    historyContext = "\n===== RECENT DESIGN HISTORY (last " + Math.min(historyRecords.length, 10) + " changes) =====\n" +
      "Below are the user's recent design requests.\n" +
      "Use this to understand what has already been customized and make ONLY incremental changes.\n\n";
    historyRecords.slice(0, 10).forEach((record: any, idx: number) => {
      historyContext += (idx + 1) + ". User asked: \"" + record.prompt + "\"\n" +
        "   Applied: " + (record.applied ? "YES" : "NO") + "\n\n";
    });
    historyContext += "=====\n\n";
  }

  const intro = "!!!CRITICAL: YOU MUST RESPOND ONLY IN VALID JSON FORMAT. NO PLAIN TEXT ALLOWED!!!\n\n" +
    "You are an expert AI designer and consultant for an e-commerce store called \"" + storeName + "\"" +
    (storeDescription ? " - " + storeDescription : "") + ".\n" +
    currentDesignContext +
    failureContext +
    historyContext +
    "You have full access to the store's frontend source code and structure below. Use it to give precise, accurate design suggestions.\n\n" +
    "!!! STRICT RULE - DELTA/ACTIONS ARCHITECTURE !!!\n" +
    "ONLY CHANGE WHAT THE USER EXPLICITLY ASKS FOR. DO NOT MODIFY ANYTHING ELSE.\n" +
    "If user says 'fix button color' -> ONLY return css_variables with --primary change. Nothing else.\n" +
    "If user says 'change footer text' -> ONLY return css_overrides for footer. Nothing else.\n" +
    "DO NOT include unchanged css_variables, layout options, or css_overrides in your response.\n" +
    "Omitting a field = keep it unchanged.\n\n";

  const storeStructure = "===== STORE FRONTEND STRUCTURE =====\n" +
    "Framework: React + Tailwind CSS + CSS custom properties (HSL values)\n\n" +
    "--- AI-CONTROLLED LAYOUT VARIABLES ---\n" +
    "product_grid_cols: \"2\" | \"3\" | \"4\"\n" +
    "  \"2\" -> grid grid-cols-2 sm:grid-cols-2 gap-6\n" +
    "  \"3\" -> grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-6\n" +
    "  \"4\" (default) -> grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6\n\n" +
    "section_padding: \"compact\" | \"normal\" | \"spacious\"\n" +
    "  compact -> py-8 / py-10, spacious -> py-24 / py-28, normal -> py-16 / py-20\n\n" +
    "hero_style: \"image\" (default) | \"gradient\"\n" +
    "  gradient -> bg-gradient-to-br from-primary/20 via-background to-muted\n\n";

  const sections = "--- SECTION 1: HEADER ---\n" +
    "Component: <Header storeSlug storeId />\n" +
    "Classes: bg-background border-b border-border sticky top-0 z-50\n" +
    "Contains: logo, store name, nav links, cart icon\n\n" +
    "--- SECTION 2: HERO BANNER ---\n" +
    "Component: <HeroBannerCarousel />\n" +
    "hero_style controls: \"image\" shows uploaded banner, \"gradient\" shows branded gradient\n\n" +
    "--- SECTION 3: CATEGORIES ---\n" +
    "Condition: shows if categories exist\n" +
    "Section: data-ai=\"section-categories\" sectionPyLarge bg-gradient-to-b from-muted/30 to-background\n" +
    "Title: \"Shop by Category\" -> text-4xl md:text-5xl font-bold text-foreground mb-4\n" +
    "Subtitle: text-lg text-muted-foreground\n" +
    "Layout: horizontal scroll flex gap-2 overflow-x-auto snap-x snap-mandatory\n" +
    "Each card: flex-shrink-0 w-48 snap-center, bg-card border border-border rounded-[--radius]\n\n" +
    "--- SECTION 4: FEATURED PRODUCTS ---\n" +
    "Section: sectionPy bg-background\n" +
    "Title: \"Featured Products\" -> text-3xl font-bold text-foreground mb-2\n" +
    "Subtitle: \"Check out our top picks for you\" -> text-muted-foreground\n" +
    "Grid: gridColsClass (AI-controlled columns)\n" +
    "Product card: bg-card border border-border rounded-[--radius] overflow-hidden\n" +
    "  Image: aspect-square object-cover, hover: y:-8 scale:1.05 (Framer Motion)\n" +
    "  Price: text-primary font-bold\n" +
    "  Category badge: bg-muted text-muted-foreground text-xs rounded-full px-2 py-1\n\n" +
    "--- SECTION 5: INSTAGRAM REELS ---\n" +
    "Conditional. Component: <InstagramReels />. bg-background py-16\n\n" +
    "--- SECTION 6: GOOGLE REVIEWS ---\n" +
    "Section: sectionPy bg-muted/30\n" +
    "Review cards: bg-card border border-border rounded-[--radius] p-4\n" +
    "Star color follows --primary\n\n" +
    "--- SECTION 7: NEW ARRIVALS ---\n" +
    "Condition: shows if new products exist\n" +
    "Section: sectionPy (no extra bg)\n" +
    "Title: \"New Arrivals\" -> text-3xl font-bold text-foreground mb-2\n" +
    "Grid: same gridColsClass as featured products\n\n" +
    "--- SECTION 8: CTA BANNER ---\n" +
    "Section: py-20 bg-primary text-primary-foreground\n" +
    "Title: text-3xl md:text-4xl font-bold mb-4 -> \"Ready to Start Shopping?\"\n" +
    "Subtitle: text-xl mb-8 opacity-90\n" +
    "Buttons: variant=\"secondary\" size=\"lg\"\n\n" +
    "--- SECTION 9: FOOTER ---\n" +
    "Component: <StoreFooter />\n" +
    "Classes: bg-card border-t border-border py-12\n" +
    "Links: text-muted-foreground hover:text-foreground\n" +
    "Bottom bar: bg-muted/50 py-4 text-center text-sm text-muted-foreground\n\n";

  const htmlStructure = "===== ACTUAL HTML STRUCTURE (for reference) =====\n" +
    "Below is the exact HTML of key components. Use this to write precise CSS selectors.\n\n" +
    "--- PRODUCT CARD HTML ---\n" +
    "<motion.div data-ai=\"product-card\" className=\"group\">\n" +
    "  <Card className=\"card overflow-hidden border-border hover:shadow-lg transition-all\">\n" +
    "    <div className=\"aspect-square overflow-hidden\">\n" +
    "      <img src=\"...\" className=\"w-full h-full object-cover\" />\n" +
    "    </div>\n" +
    "    <CardContent className=\"p-4\">\n" +
    "      <h3 className=\"font-semibold text-base mb-2\">{product.name}</h3>\n" +
    "      <Badge className=\"bg-muted text-muted-foreground text-xs\">{category}</Badge>\n" +
    "      <p className=\"text-lg font-bold text-primary mt-2\">₹{product.price}</p>\n" +
    "    </CardContent>\n" +
    "    <CardFooter className=\"p-4 pt-0\">\n" +
    "      <Button variant=\"outline\" className=\"w-full min-h-[44px]\">View Details</Button>\n" +
    "    </CardFooter>\n" +
    "  </Card>\n" +
    "</motion.div>\n\n" +
    "IMPORTANT SELECTORS:\n" +
    "- [data-ai=\"product-card\"] -> outer wrapper\n" +
    "- [data-ai=\"product-card\"] .card -> Card component\n" +
    "- [data-ai=\"product-card\"] button -> View Details button\n" +
    "- [data-ai=\"product-card\"] .text-lg -> price text\n" +
    "- [data-ai=\"product-card\"] img -> product image\n\n" +
    "--- CATEGORY CARD HTML ---\n" +
    "<div data-ai=\"category-card\" className=\"flex-shrink-0 w-48\">\n" +
    "  <div className=\"bg-card border border-border rounded-2xl overflow-hidden\">\n" +
    "    <div className=\"aspect-square rounded-xl overflow-hidden\">\n" +
    "      <img src=\"...\" className=\"w-full h-full object-cover\" />\n" +
    "    </div>\n" +
    "    <p className=\"text-center font-medium\">{category.name}</p>\n" +
    "  </div>\n" +
    "</div>\n\n" +
    "IMPORTANT SELECTORS:\n" +
    "- [data-ai=\"category-card\"] .rounded-2xl -> outer card border-radius\n" +
    "- [data-ai=\"category-card\"] .rounded-xl -> image container border-radius\n\n" +
    "--- FOOTER HTML ---\n" +
    "<footer data-ai=\"section-footer\" className=\"bg-card border-t border-border py-12\">\n" +
    "  <div className=\"container\">\n" +
    "    <div className=\"grid grid-cols-4 gap-8\">\n" +
    "      <div>\n" +
    "        <h3 className=\"font-bold mb-4\">Quick Links</h3>\n" +
    "        <a href=\"...\" className=\"text-muted-foreground hover:text-foreground\">Link</a>\n" +
    "      </div>\n" +
    "    </div>\n" +
    "  </div>\n" +
    "  <div className=\"bg-muted/50 py-4 text-center\">\n" +
    "    <p className=\"text-sm text-muted-foreground\">© 2026 Store Name</p>\n" +
    "  </div>\n" +
    "</footer>\n\n" +
    "IMPORTANT SELECTORS:\n" +
    "- [data-ai=\"section-footer\"] -> entire footer\n" +
    "- [data-ai=\"section-footer\"] a -> footer links\n" +
    "- [data-ai=\"section-footer\"] .text-sm -> copyright text\n\n" +
    "===== END HTML STRUCTURE =====\n\n";

  const cssVars = "--- CURRENT CSS VARIABLES (defaults) ---\n" +
    ":root {\n" +
    "  --primary: 217 91% 60%;         /* blue - buttons, links, accents, CTA bg, star color */\n" +
    "  --background: 0 0% 100%;        /* page background, header bg */\n" +
    "  --foreground: 222 47% 11%;      /* main text, headings */\n" +
    "  --card: 0 0% 100%;              /* product cards, review cards, footer bg */\n" +
    "  --muted: 210 40% 96%;           /* category section bg, review section bg, badges */\n" +
    "  --muted-foreground: 215 16% 47%;/* secondary text, subtitles, badge text */\n" +
    "  --border: 214 32% 91%;          /* card borders, header border, footer border */\n" +
    "  --radius: 0.5rem;               /* all card/button border radius */\n" +
    "}\n" +
    "===== END STORE STRUCTURE =====\n\n";

  const capabilities = "You can change:\n" +
    "1. css_variables -> any :root variable above (HSL values only, no hsl() wrapper)\n" +
    "2. dark_css_variables -> .dark mode overrides\n" +
    "3. layout.product_grid_cols -> \"2\" | \"3\" | \"4\"\n" +
    "4. layout.section_padding -> \"compact\" | \"normal\" | \"spacious\"\n" +
    "5. layout.hero_style -> \"image\" | \"gradient\"\n" +
    "6. css_overrides -> raw CSS string injected into the store page. Use data-ai selectors to target sections precisely.\n\n";

  const selectors = "   SECTION SELECTORS (target entire sections):\n" +
    "   - [data-ai=\"section-hero\"]           -> Hero banner section\n" +
    "   - [data-ai=\"section-categories\"]     -> Categories section\n" +
    "   - [data-ai=\"section-featured\"]       -> Featured Products section\n" +
    "   - [data-ai=\"section-reviews\"]        -> Google Reviews section\n" +
    "   - [data-ai=\"section-new-arrivals\"]   -> New Arrivals section\n" +
    "   - [data-ai=\"section-cta\"]            -> CTA banner section\n" +
    "   - [data-ai=\"section-reels\"]          -> Instagram Reels section\n" +
    "   - [data-ai=\"section-footer\"]         -> Footer\n\n" +
    "   CARD SELECTORS (target individual cards):\n" +
    "   - [data-ai=\"category-card\"]          -> each category card wrapper\n" +
    "   - [data-ai=\"product-card\"]           -> each product card wrapper\n" +
    "   - [data-ai=\"product-card\"] .card     -> product card inner element\n\n" +
    "   ELEMENT SELECTORS (target text/buttons inside sections):\n" +
    "   - [data-ai=\"section-categories\"] h2  -> \"Shop by Category\" title\n" +
    "   - [data-ai=\"section-featured\"] h2    -> \"Featured Products\" title\n" +
    "   - [data-ai=\"product-card\"] .text-lg  -> product price\n" +
    "   - [data-ai=\"product-card\"] img       -> product image\n\n";

  const examples = "   EXAMPLES:\n" +
    "   Make category cards circular:\n" +
    "   \"[data-ai='category-card'] .rounded-2xl, [data-ai='category-card'] .rounded-xl { border-radius: 9999px !important; }\"\n\n" +
    "   Add shadow to product cards:\n" +
    "   \"[data-ai='product-card'] .card { box-shadow: 0 8px 30px hsl(var(--primary)/0.15) !important; }\"\n\n" +
    "   Dark footer:\n" +
    "   \"[data-ai='section-footer'] { background: hsl(222 47% 8%) !important; color: hsl(0 0% 95%) !important; }\"\n\n";

  const responseRules = "===== CRITICAL RESPONSE RULES =====\n" +
    "YOU MUST RESPOND WITH VALID JSON ONLY. NO PLAIN TEXT, NO MARKDOWN.\n\n" +
    "YOUR RESPONSE MUST BE ONE OF THESE TWO JSON FORMATS:\n\n" +
    "FORMAT 1 - Text response (for questions, suggestions, advice):\n" +
    "{\"type\": \"text\", \"message\": \"Your helpful response here\"}\n\n" +
    "FORMAT 2 - Design response (when user wants to change/apply design):\n" +
    "{\"type\": \"design\", \"message\": \"Brief explanation\", \"design\": {" +
    "\"summary\": \"Brief description\", " +
    "\"css_variables\": {\"--primary\": \"142 71% 45%\"}, " +
    "\"dark_css_variables\": {\"--primary\": \"142 71% 50%\"}, " +
    "\"layout\": {\"product_grid_cols\": \"3\"}, " +
    "\"css_overrides\": \"[data-ai='category-card'] * { border-radius: 9999px !important; }\", " +
    "\"changes_list\": [\"Change 1\", \"Change 2\"]}}\n\n" +
    "REMEMBER: ONLY include fields you are CHANGING. Omit unchanged fields.\n" +
    "START YOUR RESPONSE WITH { AND END WITH }. NOTHING ELSE.";

  return intro + storeStructure + sections + htmlStructure + cssVars + capabilities + selectors + examples + responseRules;
}

// Lightweight prompt for casual chat
function buildChatSystemPrompt(storeName: string): string {
  return "You are a friendly AI design assistant for " + storeName + " e-commerce store.\n\n" +
    "You help store owners customize their store appearance. You can modify:\n" +
    "- Colors (primary, background, text, cards, borders)\n" +
    "- Layout (product grid columns, section padding, hero style)\n" +
    "- Visual effects (shadows, rounded corners, gradients, hover effects)\n" +
    "- Section styling (header, hero, categories, products, footer)\n\n" +
    "For casual chat: {\"type\":\"text\",\"message\":\"Your friendly response\"}\n" +
    "If user wants design help, ask what they want to change.\n\n" +
    "Always respond with valid JSON. Start with { and end with }.";
}

// ============================================
// MAIN SERVE FUNCTION
// ============================================

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
    const { action, store_id, user_id, prompt, design, history_id, package_id, amount, currency, version_number, messages } = body;

    // ========== GET TOKEN BALANCE ==========
    if (action === "get_token_balance") {
      // FIX #6: UUID validation
      if (!store_id || !isValidUUID(store_id)) {
        return new Response(JSON.stringify({ success: false, error: "Invalid store_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const now = new Date().toISOString();
      const { error: expireErr } = await supabase.from("ai_token_purchases").update({ status: "expired" })
        .eq("store_id", store_id).eq("status", "active").lt("expires_at", now).not("expires_at", "is", null);
      if (expireErr) console.error("FIX #14: Failed to expire tokens:", expireErr.message);

      const { error: deleteErr } = await supabase.from("ai_token_purchases").delete()
        .eq("store_id", store_id).eq("status", "expired");
      if (deleteErr) console.error("FIX #14: Failed to delete expired tokens:", deleteErr.message);

      // FIX #15: Clean up orphaned 'pending' purchases older than 24 hours
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const { error: pendingErr } = await supabase.from("ai_token_purchases").delete()
        .eq("store_id", store_id).eq("status", "pending").lt("created_at", oneDayAgo);
      if (pendingErr) console.error("FIX #14: Failed to clean pending tokens:", pendingErr.message);

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

    // ========== GENERATE DESIGN (Backward Compatibility) ==========
    if (action === "generate_design") {
      const startTime = Date.now();

      // FIX #6: UUID validation
      if (!store_id || !isValidUUID(store_id) || !user_id || !isValidUUID(user_id)) {
        return new Response(JSON.stringify({ success: false, error: "Invalid store_id or user_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      if (!prompt) {
        return new Response(JSON.stringify({ success: false, error: "Missing required fields" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      // FIX #11: Prompt length limit
      if (prompt.length > 2000) {
        return new Response(JSON.stringify({ success: false, error: "Prompt too long. Please keep your request under 2000 characters." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      // FIX #9: Rate limiting
      if (!checkRateLimit(store_id)) {
        return new Response(JSON.stringify({ success: false, error: "Too many requests. Please wait a moment before trying again." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 });
      }

      // Check tokens
      const { data: purchases } = await supabase.from("ai_token_purchases")
        .select("id, tokens_remaining, tokens_used")
        .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0)
        .order("expires_at", { ascending: true, nullsFirst: false }).limit(1);

      if (!purchases || purchases.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "No tokens remaining. Please buy tokens to continue." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 });
      }

      const activePurchase = purchases[0];

      // Get settings
      const { data: platformSettings } = await supabase.from("platform_settings")
        .select("openrouter_api_key, openrouter_model, openrouter_fallback_model")
        .eq("id", SETTINGS_ID).single();

      if (!platformSettings?.openrouter_api_key) {
        return new Response(JSON.stringify({ success: false, error: "OpenRouter API key not configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const { data: store } = await supabase.from("stores").select("name, description").eq("id", store_id).single();
      const storeName = store?.name || "My Store";
      const storeDescription = store?.description || "";

      const { data: designState } = await supabase.from("store_design_state")
        .select("current_design").eq("store_id", store_id).single();

      // FIX: Failure tracking - fetch history same as chat action
      const { data: historyRecords } = await supabase.from("ai_designer_history")
        .select("prompt, ai_response, applied, created_at")
        .eq("store_id", store_id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Use full system prompt with failure tracking context (same as chat action)
      const systemPrompt = buildFullChatSystemPrompt(storeName, storeDescription, designState?.current_design, historyRecords || [], prompt);

      // Call AI with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      let aiResult;
      let modelUsed: string;
      try {
        aiResult = await callAIWithFallback(
          platformSettings.openrouter_model || "moonshotai/kimi-k2",
          platformSettings.openrouter_fallback_model,
          platformSettings.openrouter_api_key,
          {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: "Store: " + storeName + ". Request: " + prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.5, // FIX #12: Consistent temperature across all actions
            max_tokens: 1500
          },
          controller.signal
        );
        modelUsed = aiResult.modelUsed;
      } catch (error: any) {
        clearTimeout(timeout);
        // FIX Issue #18: User-friendly error messages
        const errMsg = error.name === "AbortError" ? "Request timed out. Please try again." : "Unable to connect to AI. Please try again in a moment.";
        logMetrics(supabase, { store_id, user_id, action: "generate_design", success: false, error_type: errMsg, prompt_length: prompt.length }).catch(console.error); // FIX #8: fire-and-forget
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      clearTimeout(timeout);

      if (!aiResult.response.ok) {
        // FIX Issue #18: User-friendly error messages
        logMetrics(supabase, { store_id, user_id, action: "generate_design", success: false, error_type: "api_error" }).catch(console.error); // FIX #8: fire-and-forget
        return new Response(JSON.stringify({ success: false, error: "Unable to connect to AI. Please try again in a moment." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const aiData = await aiResult.response.json();
      const aiContent = aiData.choices?.[0]?.message?.content;

      // FIX #16: Detect AI content policy refusal
      if (isAIRefusal(aiContent)) {
        logMetrics(supabase, { store_id, user_id, action: "generate_design", model_used: modelUsed, success: false, error_type: "content_policy" }).catch(console.error);
        return new Response(JSON.stringify({ success: false, error: "AI could not process this request. Please rephrase your prompt." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      let parsedDesign;
      try {
        parsedDesign = extractJSON(aiContent);
      } catch {
        logMetrics(supabase, { store_id, user_id, action: "generate_design", model_used: modelUsed, success: false, error_type: "parse_error" }).catch(console.error); // FIX #8
        return new Response(JSON.stringify({ success: false, error: "AI response was unreadable. No token charged. Please try again." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      // Validate with Zod
      const validation = LegacyDesignSchema.safeParse(parsedDesign);
      if (!validation.success) {
        logMetrics(supabase, { store_id, user_id, action: "generate_design", model_used: modelUsed, success: false, error_type: "validation_error" }).catch(console.error); // FIX #8
        return new Response(JSON.stringify({ success: false, error: "AI returned incomplete design. No token charged. Please try again." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      parsedDesign = validation.data;

      // Sanitize CSS
      let cssSanitized = false;
      if (parsedDesign.css_overrides) {
        const sanitization = sanitizeCSS(parsedDesign.css_overrides);
        cssSanitized = !sanitization.safe;
        if (!sanitization.safe) {
          console.warn("CSS sanitized, blocked:", sanitization.blocked);
        }
        parsedDesign.css_overrides = minifyCSS(sanitization.sanitized);
      }

      // FIX: Response size validation (same as chat action)
      const sizeCheck = validateResponseSize(parsedDesign, parsedDesign.css_overrides || "");
      if (!sizeCheck.valid) {
        logMetrics(supabase, { store_id, user_id, action: "generate_design", model_used: modelUsed, success: false, error_type: "size_exceeded" }).catch(console.error); // FIX #8
        return new Response(JSON.stringify({ success: false, error: sizeCheck.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      // FIX #1: Optimistic locking - only deduct if tokens_remaining hasn't changed
      const { error: deductErr } = await supabase.from("ai_token_purchases").update({
        tokens_remaining: activePurchase.tokens_remaining - 1,
        tokens_used: (activePurchase.tokens_used || 0) + 1,
        updated_at: new Date().toISOString()
      }).eq("id", activePurchase.id).eq("tokens_remaining", activePurchase.tokens_remaining); // FIX #1: optimistic lock
      if (deductErr) console.error("FIX #14: Token deduction error:", deductErr.message); // FIX #14

      // Save history with split storage (FIX #2: handle insert error gracefully)
      const cssOverrides = parsedDesign.css_overrides || null;
      const designForStorage = { ...parsedDesign };
      delete designForStorage.css_overrides;

      const { data: historyRecord, error: historyErr } = await supabase.from("ai_designer_history")
        .insert({
          store_id, user_id, prompt,
          ai_response: designForStorage,
          ai_css_overrides: cssOverrides,
          response_size_bytes: JSON.stringify(designForStorage).length + (cssOverrides?.length || 0),
          tokens_used: 1, applied: false
        })
        .select("id").single();
      if (historyErr) console.error("FIX #14: History insert error:", historyErr.message); // FIX #2 + #14

      // Get new balance
      const { data: updatedPurchases } = await supabase.from("ai_token_purchases")
        .select("tokens_remaining").eq("store_id", store_id).eq("status", "active");
      const newBalance = (updatedPurchases || []).reduce((s: number, p: any) => s + (p.tokens_remaining || 0), 0);

      // FIX #8: fire-and-forget metrics logging
      logMetrics(supabase, {
        store_id, user_id, action: "generate_design", model_used: modelUsed,
        tokens_consumed: 1, latency_ms: Date.now() - startTime, success: true,
        prompt_length: prompt.length, css_sanitized: cssSanitized
      }).catch(console.error);

      return new Response(JSON.stringify({
        success: true, design: parsedDesign, history_id: historyRecord?.id, tokens_remaining: newBalance
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== CHAT (with Full Context) ==========
    if (action === "chat") {
      const startTime = Date.now();

      // FIX #6: UUID validation
      if (!store_id || !isValidUUID(store_id) || !user_id || !isValidUUID(user_id)) {
        return new Response(JSON.stringify({ success: false, error: "Invalid store_id or user_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      if (!messages?.length) {
        return new Response(JSON.stringify({ success: false, error: "Missing required fields" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      // FIX #9: Rate limiting
      if (!checkRateLimit(store_id)) {
        return new Response(JSON.stringify({ success: false, error: "Too many requests. Please wait a moment before trying again." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 });
      }

      const { data: platformSettings } = await supabase.from("platform_settings")
        .select("openrouter_api_key, openrouter_model, openrouter_fallback_model")
        .eq("id", SETTINGS_ID).single();

      if (!platformSettings?.openrouter_api_key) {
        return new Response(JSON.stringify({ success: false, error: "OpenRouter API key not configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const { data: store } = await supabase.from("stores").select("name, description").eq("id", store_id).single();
      const storeName = store?.name || "My Store";
      const storeDescription = store?.description || "";

      // Check if design request
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
      const userPrompt = lastUserMsg?.content || "";

      // FIX #11: Prompt length limit
      if (userPrompt.length > 2000) {
        return new Response(JSON.stringify({ success: false, error: "Prompt too long. Please keep your request under 2000 characters." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const needsFullContext = isDesignRequest(userPrompt);

      // FIX #3: Fetch history with ai_css_overrides for better context
      const { data: historyRecords } = await supabase.from("ai_designer_history")
        .select("prompt, ai_response, ai_css_overrides, applied, created_at")
        .eq("store_id", store_id)
        .order("created_at", { ascending: false })
        .limit(20);

      // FIX #5: Always fetch current design (even for casual chat - AI may return design unexpectedly)
      const { data: designState } = await supabase.from("store_design_state")
        .select("current_design").eq("store_id", store_id).single();
      const currentDesign = designState?.current_design || null;

      let systemPrompt: string;

      if (needsFullContext) {
        // FIX #3: Check tokens BEFORE calling AI
        const { data: tokenCheck } = await supabase.from("ai_token_purchases")
          .select("tokens_remaining")
          .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0).limit(1);

        if (!tokenCheck?.length) {
          return new Response(JSON.stringify({ success: false, error: "No tokens remaining. Please buy tokens to continue." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 });
        }

        // Use FULL detailed system prompt with all store structure info
        systemPrompt = buildFullChatSystemPrompt(storeName, storeDescription, currentDesign, historyRecords || [], userPrompt);
      } else {
        systemPrompt = buildChatSystemPrompt(storeName);
      }

      // Manage conversation window (keep last 20 messages)
      let managedMessages = messages;
      if (messages.length > 20) {
        managedMessages = messages.slice(-20);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      let aiResult;
      let modelUsed: string;
      try {
        aiResult = await callAIWithFallback(
          platformSettings.openrouter_model || "moonshotai/kimi-k2",
          platformSettings.openrouter_fallback_model,
          platformSettings.openrouter_api_key,
          {
            messages: [{ role: "system", content: systemPrompt }, ...managedMessages],
            response_format: { type: "json_object" },
            temperature: 0.5,
            max_tokens: 2000
          },
          controller.signal
        );
        modelUsed = aiResult.modelUsed;
      } catch (error: any) {
        clearTimeout(timeout);
        const errMsg = error.name === "AbortError" ? "Request timed out" : "Unable to connect to AI. Please try again in a moment.";
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      clearTimeout(timeout);

      if (!aiResult.response.ok) {
        return new Response(JSON.stringify({ success: false, error: "Unable to connect to AI. Please try again in a moment." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const aiData = await aiResult.response.json();
      const aiContent = aiData.choices?.[0]?.message?.content;

      // FIX #16: Detect AI content policy refusal before extractJSON
      if (isAIRefusal(aiContent)) {
        return new Response(JSON.stringify({ success: false, error: "AI could not process this request. Please rephrase your prompt." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      let parsed;
      try {
        parsed = extractJSON(aiContent);
      } catch {
        parsed = { type: "text", message: aiContent || "I encountered an error. Please try again." };
      }

      let historyId: string | undefined;
      let newTokenBalance: number | undefined;
      let cssSanitized = false;

      if (parsed.type === "design" && parsed.design) {
        // Try Delta format first, fallback to Legacy
        let validation = DeltaDesignSchema.safeParse(parsed.design);
        let isDelta = validation.success;

        if (!isDelta) {
          validation = LegacyDesignSchema.safeParse(parsed.design);
          if (!validation.success) {
            return new Response(JSON.stringify({ success: false, error: "AI returned incomplete design. Please try again." }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
          }
        }

        let finalDesign = validation.data;

        // Convert Delta to Legacy for storage
        if (isDelta) {
          finalDesign = deltaToLegacy(finalDesign, currentDesign);
        }

        // Sanitize and minify CSS
        if (finalDesign.css_overrides) {
          const sanitization = sanitizeCSS(finalDesign.css_overrides);
          cssSanitized = !sanitization.safe;
          finalDesign.css_overrides = minifyCSS(sanitization.sanitized);
        }

        // Validate size
        const sizeCheck = validateResponseSize(finalDesign, finalDesign.css_overrides || "");
        if (!sizeCheck.valid) {
          return new Response(JSON.stringify({ success: false, error: sizeCheck.error }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
        }

        // FIX #1: Optimistic locking - re-fetch tokens and use lock on update
        const { data: purchases } = await supabase.from("ai_token_purchases")
          .select("id, tokens_remaining, tokens_used")
          .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0).limit(1);

        if (purchases?.length) {
          const { error: deductErr } = await supabase.from("ai_token_purchases").update({
            tokens_remaining: purchases[0].tokens_remaining - 1,
            tokens_used: (purchases[0].tokens_used || 0) + 1
          }).eq("id", purchases[0].id).eq("tokens_remaining", purchases[0].tokens_remaining); // FIX #1: optimistic lock
          if (deductErr) console.error("FIX #14: Token deduction error in chat:", deductErr.message);
        }

        // Save to history with split storage (FIX #2: handle insert error gracefully)
        const cssOverrides = finalDesign.css_overrides || null;
        delete finalDesign.css_overrides; // Remove from JSONB

        const { data: hr, error: hrErr } = await supabase.from("ai_designer_history")
          .insert({
            store_id,
            user_id,
            prompt: userPrompt,
            ai_response: finalDesign,
            ai_css_overrides: cssOverrides,
            response_size_bytes: JSON.stringify(finalDesign).length + (cssOverrides?.length || 0),
            tokens_used: 1
          })
          .select("id").single();
        if (hrErr) console.error("FIX #14: History insert error in chat:", hrErr.message); // FIX #2 + #14
        historyId = hr?.id;

        // Add css_overrides back for response
        finalDesign.css_overrides = cssOverrides;

        const { data: up } = await supabase.from("ai_token_purchases")
          .select("tokens_remaining").eq("store_id", store_id).eq("status", "active");
        newTokenBalance = (up || []).reduce((s: number, p: any) => s + (p.tokens_remaining || 0), 0);

        parsed.design = finalDesign;
      } else if (parsed.type === "text" && userPrompt) {
        // Save text responses to ai_designer_history too (tokens_used: 0, no token charge)
        supabase.from("ai_designer_history").insert({
          store_id, user_id,
          prompt: userPrompt,
          ai_response: { type: "text", message: parsed.message || "" },
          tokens_used: 0,
          applied: false,
        }).then(({ error }) => {
          if (error) console.error("Text history insert error:", error.message);
        });
      }

      // FIX #8: fire-and-forget metrics logging
      logMetrics(supabase, {
        store_id, user_id, action: "chat", model_used: modelUsed,
        tokens_consumed: parsed.type === "design" ? 1 : 0,
        latency_ms: Date.now() - startTime, success: true,
        prompt_length: userPrompt.length, css_sanitized: cssSanitized
      }).catch(console.error);

      return new Response(JSON.stringify({
        success: true, type: parsed.type, message: parsed.message,
        design: parsed.design || null, history_id: historyId, tokens_remaining: newTokenBalance
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== APPLY DESIGN ==========
    if (action === "apply_design") {
      if (!store_id || !design) {
        return new Response(JSON.stringify({ success: false, error: "Missing store_id or design" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      // Sanitize CSS before applying
      let cssSanitized = false;
      if (design.css_overrides) {
        const sanitization = sanitizeCSS(design.css_overrides);
        cssSanitized = !sanitization.safe;
        design.css_overrides = sanitization.sanitized;
      }

      const { data: currentState } = await supabase.from("store_design_state")
        .select("current_design, version, version_history").eq("store_id", store_id).single();

      const now = new Date().toISOString();
      let newVersionHistory = currentState?.version_history || [];
      if (currentState?.current_design) {
        newVersionHistory = [
          { version: currentState.version || 0, design: currentState.current_design, applied_at: now },
          ...newVersionHistory
        ].slice(0, 10);
      }

      const { error: upsertErr } = await supabase.from("store_design_state").upsert({
        store_id, current_design: design,
        version: (currentState?.version || 0) + 1,
        version_history: newVersionHistory,
        last_applied_at: now, updated_at: now
      }, { onConflict: "store_id" });
      if (upsertErr) console.error("FIX #14: Design state upsert error:", upsertErr.message);

      if (history_id) {
        const { error: histApplyErr } = await supabase.from("ai_designer_history").update({ applied: true }).eq("id", history_id);
        if (histApplyErr) console.error("FIX #14: History apply update error:", histApplyErr.message);
      }

      logMetrics(supabase, { store_id, action: "apply_design", success: true, design_published: true, css_sanitized: cssSanitized }).catch(console.error); // FIX #8

      return new Response(JSON.stringify({ success: true, message: "Design applied to your live store" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== RESET DESIGN ==========
    if (action === "reset_design") {
      if (!store_id) {
        return new Response(JSON.stringify({ success: false, error: "Missing store_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      await supabase.from("store_design_state").delete().eq("store_id", store_id);
      return new Response(JSON.stringify({ success: true, message: "Store design reset to platform default" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== ROLLBACK DESIGN ==========
    if (action === "rollback_design") {
      if (!store_id || version_number === undefined) {
        return new Response(JSON.stringify({ success: false, error: "Missing store_id or version_number" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const { data: currentState } = await supabase.from("store_design_state")
        .select("version_history").eq("store_id", store_id).single();

      if (!currentState?.version_history) {
        return new Response(JSON.stringify({ success: false, error: "No version history found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
      }

      const targetVersion = currentState.version_history.find((v: any) => v.version === version_number);
      if (!targetVersion) {
        return new Response(JSON.stringify({ success: false, error: "Version not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
      }

      await supabase.from("store_design_state").update({
        current_design: targetVersion.design,
        updated_at: new Date().toISOString()
      }).eq("store_id", store_id);

      return new Response(JSON.stringify({ success: true, message: "Rolled back to version " + version_number, design: targetVersion.design }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== CREATE PAYMENT ORDER ==========
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
        success: true, order_id: razorpayOrder.id,
        amount: razorpayOrder.amount, razorpay_key_id: platformSettings.razorpay_key_id
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
