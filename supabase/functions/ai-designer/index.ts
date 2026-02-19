/**
 * ============================================================
 * AI DESIGNER — SUPABASE EDGE FUNCTION
 * ============================================================
 * This is the backend brain of the AI Designer feature.
 * It runs as a serverless Deno function on Supabase Edge.
 *
 * WHAT IT DOES:
 *   Store owners describe design changes in plain English.
 *   This function calls an AI model via OpenRouter, parses
 *   the response, validates it, and saves it to the database.
 *
 * SUPPORTED ACTIONS (sent in request body as `action`):
 *   - get_token_balance  → Check how many AI tokens the store has
 *   - generate_design    → One-shot prompt → design (legacy flow)
 *   - chat               → Main action: full conversation with history
 *   - apply_design       → Publish a generated design to the live store
 *   - reset_design       → Revert store to platform defaults
 *   - rollback_design    → Revert to a previous design version
 *   - create_payment_order → Start a Razorpay token purchase
 *   - confirm_payment    → Confirm token purchase after payment
 *
 * REQUEST FLOW (chat action):
 *   1. Validate store_id + user_id (UUID)
 *   2. Rate limit check (10 requests / 60s per store)
 *   3. Fetch platform settings (OpenRouter key, model)
 *   4. Fetch store info (name, description)
 *   5. Classify prompt: design request vs casual chat
 *   6. Detect intent (preserve / create new) + semantic locks
 *   7. Fetch history (last 20 records) for failure tracking
 *   8. Build system prompt (full context or lightweight)
 *   9. Call OpenRouter API with 45s timeout + fallback model
 *  10. Parse + validate AI response (Delta or Legacy format)
 *  11. Sanitize + minify CSS overrides
 *  12. Deduct 1 token (optimistic lock on DB row)
 *  13. Save to ai_designer_history (JSONB + TEXT separately)
 *  14. Return design + token balance to frontend
 *
 * DATABASE TABLES USED:
 *   - platform_settings     → OpenRouter key, model, Razorpay keys
 *   - stores                → Store name, description
 *   - ai_token_purchases    → Token balance per store
 *   - ai_designer_history   → Prompt + AI response log
 *   - store_design_state    → Currently applied design (CSS vars)
 *   - ai_designer_metrics   → Performance monitoring logs
 *
 * DEPLOYMENT:
 *   supabase functions deploy ai-designer
 * ============================================================
 */

// ============================================================
// IMPORTS
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================
// CONSTANTS
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/** Singleton row ID for platform_settings table */
const SETTINGS_ID = "00000000-0000-0000-0000-000000000000";
/** Max allowed CSS override string size before rejection */
const MAX_CSS_SIZE = 15000; // 15KB
/** Max allowed total design JSON size before rejection */
const MAX_RESPONSE_SIZE = 10000; // 10KB

// ============================================================
// SECTION 1: INPUT VALIDATION
// ============================================================

/** Validates that a string is a proper UUID (prevents SQL injection / bad queries) */
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ============================================================
// SECTION 2: RATE LIMITING
// In-memory map — resets when the function cold-starts.
// Sufficient for edge functions (each instance is isolated).
// Prevents a single store from spamming the AI API.
// ============================================================

/**
 * Checks if a store has exceeded the request rate limit.
 * Default: 10 requests per 60 seconds per store.
 * Returns true = allowed, false = blocked (429 response).
 */
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

// ============================================================
// SECTION 3: COLOR NORMALIZATION
// The AI returns colors in many formats: #hex, rgb(), hsl().
// The Tailwind CSS system requires raw HSL: "217 91% 60%"
// (no hsl() wrapper, no hex, no rgb).
// These functions convert any color format to that standard.
// ============================================================

/**
 * Strips "--" prefix from CSS variable keys (AI sometimes includes it).
 * Also normalizes all values to raw HSL format via normalizeColorValue.
 * Input:  { "--primary": "#3b82f6" }
 * Output: { "primary": "217 91% 60%" }
 */
function normalizeVarKeys(vars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars || {})) {
    out[k.startsWith("--") ? k.slice(2) : k] = normalizeColorValue(v);
  }
  return out;
}

/**
 * Converts any color format to raw HSL string "H S% L%".
 * Handles: hsl() wrapper, #hex6, #hex3, rgb(), already-correct HSL.
 * Non-color values (rem, px, em) are returned unchanged.
 */
function normalizeColorValue(value: string): string {
  if (!value || typeof value !== "string") return value;
  const v = value.trim();

  // Already correct: "217 91% 60%" or "0.5rem" or other non-color values
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(v)) return v;
  if (v.includes("rem") || v.includes("px") || v.includes("em") || v.includes("%") === false && v.length < 8) return v;

  // hsl() wrapper: hsl(217, 91%, 60%) or hsl(217 91% 60%)
  const hslMatch = v.match(/^hsl\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)%\s*[,\s]\s*(\d+(?:\.\d+)?)%\s*\)/i);
  if (hslMatch) return `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;

  // Hex 6: #3b82f6
  const hex6 = v.match(/^#?([0-9a-f]{6})$/i);
  if (hex6) return hexToHsl(hex6[1]);

  // Hex 3: #38f
  const hex3 = v.match(/^#?([0-9a-f]{3})$/i);
  if (hex3) return hexToHsl(hex3[1].split("").map(c => c + c).join(""));

  // rgb(): rgb(59, 130, 246)
  const rgbMatch = v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) return rgbToHsl(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));

  return v; // Return as-is if unrecognized
}

/** Converts 6-char hex (without #) to raw HSL string "H S% L%" */
function hexToHsl(hex: string): string {
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  return rgbToHsl(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

/** Converts RGB (0–255 each) to raw HSL string "H S% L%" */
function rgbToHsl(r: number, g: number, b: number): string {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ============================================================
// SECTION 4: AI BEHAVIOR CONTROL (ENHANCED)
// ============================================================

/**
 * ENHANCED: Returns the AI temperature with better creative detection.
 * 
 * HIGH creativity (0.7-0.8): "design according to you", "make it pop", "stunning", 
 *                           "your choice", "surprise me", "be creative"
 * 
 * MEDIUM (0.5-0.6): "redesign everything", "new look", "full design"
 * 
 * LOW (0.3-0.4): Specific fixes ("change button color", "fix footer")
 * 
 * RETRY (0.4): Slightly higher than before to force different approach
 */
function getTemperature(userPrompt: string, isRetry = false): number {
  if (isRetry) return 0.4;
  
  const lower = userPrompt.toLowerCase();
  
  // HIGH creativity - user wants AI's best creative work
  const highCreativityWords = [
    "according to you", "your choice", "you decide", "surprise me", 
    "be creative", "make it pop", "stunning", "beautiful", "amazing", 
    "wow", "impressive", "outstanding", "gorgeous", "elegant", "premium",
    "luxury", "high-end", "designer", "artistic", "unique"
  ];
  
  // MEDIUM - full redesign but not explicitly creative
  const mediumCreativityWords = [
    "redesign", "change full", "change everything", "whole design", 
    "full design", "new design", "start over", "redo", "fresh design", 
    "create design", "give me a design", "make it look", "change design",
    "new look", "transform", "revamp"
  ];
  
  if (highCreativityWords.some(w => lower.includes(w))) return 0.75;
  if (mediumCreativityWords.some(w => lower.includes(w))) return 0.55;
  
  // Check if it's a specific narrow request (low temp)
  const specificPatterns = [
    /^(change|make|fix|update)\s+(the\s+)?(button|header|footer|color|primary|background)/i,
    /^(just|only)\s+/i,
    /don't\s+change/i,
    /keep\s+/i
  ];
  
  if (specificPatterns.some(pattern => pattern.test(lower))) return 0.3;
  
  // Default slightly higher than before for better results
  return 0.5;
}

// ============================================================
// SECTION 5: AI RESPONSE PARSING & SAFETY
// ============================================================

/**
 * Fixes a known AI bug: sometimes the AI wraps its design JSON
 * inside a text message instead of returning it directly.
 *
 * Bug example:
 *   { "type": "text", "message": " {\"type\":\"design\", ...}" }
 *                                  ^ leading space causes miss
 *
 * This function detects and unwraps the inner JSON so the
 * design is properly processed rather than shown as plain text.
 */
function unwrapNestedDesign(parsed: any): any {
  if (parsed?.type !== "text" || typeof parsed?.message !== "string") return parsed;
  const msg = parsed.message.trim();
  const s = msg.indexOf('{"type"');
  const s2 = msg.indexOf('{ "type"');
  const start = s !== -1 ? s : s2;
  if (start === -1) return parsed;
  const end = msg.lastIndexOf("}");
  if (end <= start) return parsed;
  try {
    const inner = JSON.parse(msg.slice(start, end + 1));
    // If inner looks like a design response or a direct design object
    if (inner.type === "design" && inner.design) return inner;
    if (inner.css_variables || inner.summary || inner.changes_list) {
      return { type: "design", message: inner.message || "Design generated", design: inner };
    }
  } catch { /* not parseable, keep as text */ }
  return parsed;
}

/**
 * Detects if the AI refused to answer due to content policy.
 * Returns true if the response contains refusal phrases AND
 * does not start with '{' (meaning it's not valid JSON).
 * Used to return a friendly error instead of a parse error.
 */
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

// ============================================================
// SECTION 6: ZOD VALIDATION SCHEMAS
// The AI response is validated against one of two schemas:
//
// DELTA FORMAT (preferred):
//   AI returns only the CHANGES (e.g. "set primary to blue").
//   Backend merges changes onto the existing design.
//   Prevents AI from accidentally resetting unrelated styles.
//
// LEGACY FORMAT (fallback):
//   AI returns the full design object (all CSS variables, layout).
//   Used for backward compatibility and full redesigns.
// ============================================================

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

// ============================================================
// SECTION 7: CSS UTILITIES
// ============================================================

/**
 * Minifies a CSS string to reduce DB storage size (~50% reduction).
 * Removes comments and collapses whitespace.
 * Special care: preserves content:"..." strings (e.g. pseudo-elements)
 * by temporarily replacing them during minification.
 */
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

/**
 * Validates that the AI response does not exceed size limits.
 * CSS > 15KB or JSON > 10KB gets rejected before DB save.
 * Prevents database corruption from oversized AI responses.
 */
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

/**
 * Extracts and parses JSON from AI response content.
 * Handles three cases:
 *   1. Raw JSON string → parse directly
 *   2. Markdown code block → strip ```json ... ``` then parse
 *   3. JSON embedded in text → find first { and last } then parse
 * Throws if no valid JSON is found.
 */
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

// ============================================================
// SECTION 8: PROMPT ANALYSIS & FAILURE TRACKING
// These functions analyze the user's prompt to:
//   - Detect if the same issue was attempted before (failure tracking)
//   - Classify intent (preserve existing vs fresh redesign)
//   - Detect semantic locks ("keep colors same")
//   - Detect if it's a design request vs casual chat
// ============================================================

/**
 * Calculates similarity between two prompts using Jaccard similarity
 * on their extracted keywords (with synonym expansion).
 * Returns 0.0 (completely different) to 1.0 (identical).
 * Used to detect when a user is repeating a failed request.
 */
function calculatePromptSimilarity(prompt1: string, prompt2: string): number {
  const keywords1 = extractKeywords(prompt1);
  const keywords2 = extractKeywords(prompt2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const intersection = keywords1.filter(k => keywords2.includes(k)).length;
  const union = new Set([...keywords1, ...keywords2]).size;

  return intersection / union; // Jaccard similarity
}

/**
 * Maps common design slang and abbreviations to standard terms.
 * Ensures "btn" and "buttons" and "button" all match the same keyword.
 * Applied during keyword extraction for similarity comparison.
 */
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

/** Extracts meaningful keywords from a prompt (removes stop words, expands synonyms) */
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

/**
 * ENHANCED: Better detection of design requests including 
 * open-ended creative prompts like "design according to you"
 */
function isDesignRequest(prompt: string): boolean {
  const designKeywords = [
    // Colors
    "color", "colour", "blue", "red", "green", "yellow", "purple", "pink", "orange", 
    "black", "white", "gold", "silver", "gradient",
    // Actions
    "design", "style", "layout", "change", "make", "update", "modify", "add", "create",
    // Elements  
    "button", "card", "section", "header", "footer", "banner", "product", "hero", "grid",
    // Properties
    "font", "text", "size", "padding", "margin", "border", "radius", "round", "shadow",
    "background", "foreground", "theme", "dark", "light",
    // Styles
    "modern", "elegant", "minimalist", "bold", "professional", "clean", "simple",
    "luxury", "premium", "beautiful", "stunning", "amazing", "attractive",
    // Layout
    "spacing", "grid", "column", "row", "align", "center", "fix", "visible", "hide",
    // Creative triggers
    "according to you", "your choice", "you decide", "surprise me", "be creative",
    "make it pop", "wow", "impressive", "outstanding", "gorgeous", "artistic", "unique",
    "transform", "revamp", "upgrade", "enhance", "improve"
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  
  // Short prompts with design keywords are design requests
  if (prompt.length < 50 && designKeywords.some(kw => lowerPrompt.includes(kw))) {
    return true;
  }
  
  // Check for explicit creative delegation
  const creativeDelegation = [
    "according to you", "your choice", "you decide", "what do you think",
    "surprise me", "use your judgment", "your best", "professional opinion"
  ];
  
  if (creativeDelegation.some(phrase => lowerPrompt.includes(phrase))) {
    return true;
  }
  
  return designKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * ENHANCED: Better intent classification with creative mode detection
 */
function classifyIntent(prompt: string): "PRESERVE_EXISTING" | "CREATE_NEW" | "NEUTRAL" | "CREATIVE_DELEGATION" {
  const lower = prompt.toLowerCase();
  
  // NEW: Creative delegation mode - user wants AI's best work
  const creativeDelegation = [
    "according to you", "your choice", "you decide", "surprise me",
    "be creative", "use your judgment", "your best", "what would you do",
    "design for me", "create something", "make it beautiful", "impress me"
  ];
  
  if (creativeDelegation.some(phrase => lower.includes(phrase))) {
    return "CREATIVE_DELEGATION";
  }
  
  const preserveKeywords = [
    "current", "existing", "keep", "only", "just", "fix", "maintain",
    "preserve", "dont change", "don't change", "same", "without changing",
    "leave", "stay", "as is", "maintain", "retain"
  ];
  
  const newKeywords = [
    "completely", "entirely", "whole new", "fresh", "redesign", "redo",
    "start over", "from scratch", "different", "brand new", "total",
    "full redesign", "transform", "revamp", "overhaul",
    "full design", "full", "complete", "everything", "all of it",
    "whole", "entire", "every section", "all sections", "whole store"
  ];
  
  const preserveScore = preserveKeywords.filter(k => lower.includes(k)).length;
  const newScore = newKeywords.filter(k => lower.includes(k)).length;

  if (preserveScore > newScore) return "PRESERVE_EXISTING";
  if (newScore > preserveScore) return "CREATE_NEW";
  return "NEUTRAL";
}

/**
 * Detects phrases that indicate the user wants to LOCK a specific
 * design element (i.e. "keep colors same", "don't change the footer").
 *
 * Detected locks are passed to the system prompt as explicit rules:
 *   "LOCKED — DO NOT CHANGE: colors (css_variables)"
 *
 * This prevents the AI from modifying those elements even when
 * making other changes to the design.
 */
function detectSemanticLocks(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const locks: string[] = [];
  const lockPatterns: Array<{ pattern: RegExp; lock: string }> = [
    { pattern: /keep.{0,20}color|color.{0,20}same|don.t.{0,10}change.{0,10}color|preserve.{0,10}color|current.{0,10}color/i, lock: "colors (css_variables)" },
    { pattern: /keep.{0,20}layout|layout.{0,20}same|don.t.{0,10}change.{0,10}layout/i, lock: "layout" },
    { pattern: /keep.{0,20}footer|don.t.{0,10}change.{0,10}footer|footer.{0,10}same/i, lock: "footer" },
    { pattern: /keep.{0,20}header|don.t.{0,10}change.{0,10}header|header.{0,10}same/i, lock: "header" },
    { pattern: /keep.{0,20}font|current.{0,10}font|font.{0,10}same|typography.{0,10}same/i, lock: "typography" },
    { pattern: /keep.{0,20}background|background.{0,10}same|don.t.{0,10}change.{0,10}background/i, lock: "background color" },
  ];
  lockPatterns.forEach(({ pattern, lock }) => {
    if (pattern.test(lower)) locks.push(lock);
  });
  return locks;
}

/**
 * Detects if the AI's proposed design is "destructive" —
 * i.e. it changes more than 50% of existing CSS variables
 * or more than 5 design fields.
 *
 * When destructive is true, the frontend shows a warning:
 *   "This will change 70% of your color variables. Review before publishing."
 *
 * The design is still returned — the user can still apply it.
 * This is informational only, not a block.
 */
function detectDestructiveChange(currentDesign: any, proposedDesign: any): {
  destructive: boolean;
  changePercent: number;
  changedFields: string[];
} {
  if (!currentDesign) return { destructive: false, changePercent: 0, changedFields: [] };

  const changedFields: string[] = [];

  // Check css_variables changes
  const currentVars = currentDesign.css_variables || {};
  const proposedVars = proposedDesign.css_variables || {};
  const totalVarKeys = Object.keys(currentVars).length;
  let changedVarCount = 0;

  Object.keys(proposedVars).forEach(key => {
    if (currentVars[key] !== undefined && currentVars[key] !== proposedVars[key]) {
      changedVarCount++;
      changedFields.push(key);
    }
  });

  // Check layout changes
  const currentLayout = currentDesign.layout || {};
  const proposedLayout = proposedDesign.layout || {};
  Object.keys(proposedLayout).forEach(key => {
    if (currentLayout[key] !== undefined && currentLayout[key] !== proposedLayout[key]) {
      changedFields.push(`layout.${key}`);
    }
  });

  const changePercent = totalVarKeys > 0 ? Math.round((changedVarCount / totalVarKeys) * 100) : 0;
  const destructive = changePercent > 50 || changedFields.length > 5;

  return { destructive, changePercent, changedFields };
}

// ============================================================
// SECTION 9: HTTP, MONITORING & SECURITY
// ============================================================

/**
 * Wraps fetch() with exponential backoff retry logic.
 * - 4xx errors are returned immediately (client error, no retry)
 * - 5xx server errors are retried up to maxRetries times
 * - AbortError (timeout) is re-thrown immediately (no retry)
 * Retry delays: 1s, 2s, 4s (doubles each attempt)
 */
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

/**
 * Saves performance and usage metrics to ai_designer_metrics table.
 * Called fire-and-forget (non-blocking) — errors are only console-logged.
 * Tracks: model used, token consumption, latency, errors, CSS sanitization.
 * Used by super admin analytics dashboard.
 */
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

/**
 * Sanitizes AI-generated CSS to block dangerous patterns.
 * Replaces dangerous code with "/* BLOCKED *\/".
 *
 * Blocked patterns:
 *   - javascript: URLs (XSS via CSS)
 *   - expression() — IE-era JS in CSS
 *   - @import — external resource loading
 *   - <script> tags embedded in CSS
 *   - behavior: / binding: / -moz-binding — legacy attack vectors
 *   - data:text/html — data URL injection
 *
 * Returns: { safe: bool, sanitized: string, blocked: string[] }
 */
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

// ============================================================
// SECTION 10: AI API CLIENT
// ============================================================

/**
 * Calls the OpenRouter API with automatic fallback model support.
 *
 * Flow:
 *   1. Try primary model (e.g. moonshotai/kimi-k2)
 *   2. If primary returns 5xx, try fallback model
 *   3. 4xx from either model = returned to caller (don't retry)
 *   4. If both fail → throw last error
 *
 * The API key and model IDs are trimmed to prevent whitespace 401 errors.
 * Uses fetchWithRetry internally (3 attempts per model).
 */
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

// ============================================================
// SECTION 11: DELTA/ACTIONS ARCHITECTURE
// ============================================================
// Instead of the AI returning a full new design every time,
// it returns only the CHANGES (called a "delta").
//
// Example delta:
//   { action_type: "css_variable", key: "primary", value: "142 71% 45%" }
//
// The backend then MERGES these changes onto the existing design.
// This prevents the AI from accidentally overwriting parts of
// the design that the user didn't ask to change.
//
// CSS deduplication: If the same selector appears in both the
// existing css_overrides and the new delta, the new one wins
// (replaces instead of appending). This prevents duplicate rules.
// ============================================================

/**
 * Parses a CSS string into a Map<selector, rules>.
 * Handles regular selectors AND at-rules (@media, @keyframes, @supports).
 * At-rules get a unique key (_index suffix) to preserve multiple @media blocks.
 * Used for CSS deduplication before applying delta changes.
 */
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

/**
 * Rebuilds a CSS string from a selector→rules Map.
 * At-rule keys (with _index suffix) are cleaned before output.
 * Called after applyDeltaChanges to produce the final css_overrides string.
 */
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

/**
 * Merges delta changes from AI onto the current design.
 *
 * For each change in the changes array:
 *   css_variable      → update css_variables[key] = value
 *   css_variable_dark → update dark_css_variables[key] = value
 *   layout            → update layout[key] = value
 *   css_override      → add/replace selector in CSS map
 *
 * CSS overrides are deduplicated: same selector = overwrite, new selector = append.
 * Returns a merged design object (does NOT mutate currentDesign).
 */
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

/**
 * Converts Delta format response to Legacy format for DB storage.
 * Applies the delta changes onto the current design first,
 * then wraps the result in the Legacy schema shape.
 * This allows Delta and Legacy responses to be stored identically.
 */
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

// ============================================================
// SECTION 12: SYSTEM PROMPTS (ENHANCED)
// ============================================================
// There are 3 system prompts, used in different situations:
//
// buildDesignSystemPrompt   → Simple prompt for generate_design (legacy)
// buildChatSystemPrompt     → Lightweight prompt for casual chat only
// buildFullChatSystemPrompt → Full enterprise prompt for design requests
//
// The FULL prompt includes (in order, for LLM primacy+recency bias):
//   TOP:    Critical rules (output contract, scope rules)
//   MIDDLE: Store info, current design, intent, locks, failure tracking, history
//   BODY:   Full store HTML structure, CSS variables, section selectors, examples
//   BOTTOM: Final reminder repeating the key rules (recency boost)
// ============================================================

/**
 * Simple one-shot system prompt for the generate_design action.
 * Used for backward compatibility. Includes store structure and CSS
 * variables, but lacks failure tracking and full context.
 */
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
    "RESPOND IN JSON FORMAT ONLY. No markdown. Start with { end with }.\n\n" +
    "RULE: NEVER ask for approval or clarification. Apply the design immediately.\n" +
    "RULE: CSS variable keys WITHOUT '--' prefix. Use 'primary' not '--primary'.\n" +
    "RULE: Full design request = change ALL variables and ALL sections. Specific = change ONLY that element.\n\n" +
    "For design changes: {\"type\":\"design\",\"message\":\"Applied [X]. Want to adjust?\",\"design\":{" +
    "\"summary\":\"Brief summary\",\"css_variables\":{\"primary\":\"217 91% 60%\",\"background\":\"0 0% 100%\"}," +
    "\"dark_css_variables\":{\"primary\":\"217 91% 65%\",\"background\":\"222 47% 8%\"}," +
    "\"layout\":{\"product_grid_cols\":\"3\"}," +
    "\"css_overrides\":\"[data-ai='section-hero'] { background: hsl(217 91% 60%) !important; }\"," +
    "\"changes_list\":[\"Change 1\",\"Change 2\"]}}\n\n" +
    "For pure chat only (NO design): {\"type\":\"text\",\"message\":\"your response\"}";

  return "You are an expert UI/UX designer for the e-commerce store: " + storeName + ".\n" +
    designContext + "\n\n" +
    storeSections + "\n" +
    cssVariables + "\n" +
    responseFormat;
}

/**
 * ENHANCED FULL PROMPT with creative mode support and style adaptation
 */
function buildFullChatSystemPrompt(
  storeName: string, 
  storeDescription: string, 
  currentDesign: any, 
  historyRecords: any[], 
  currentPrompt: string, 
  intent?: string, 
  locks?: string[]
): string {

  // Detect if this is a creative delegation request
  const lowerPrompt = currentPrompt.toLowerCase();
  const isCreativeDelegation = intent === "CREATIVE_DELEGATION" || 
    ["according to you", "your choice", "surprise me", "be creative"].some(p => lowerPrompt.includes(p));

  // OUTPUT FORMAT RULES (technical only — no creative restrictions)
  const criticalRulesTop =
    "╔══════════════════════════════════════════════════════════════════╗\n" +
    "║  OUTPUT FORMAT                                                   ║\n" +
    "╠══════════════════════════════════════════════════════════════════╣\n" +
    "║  1. OUTPUT ONLY RAW JSON. No markdown. No prose.                 ║\n" +
    "║  2. Start with { and end with }. Nothing before or after.        ║\n" +
    "║  3. Act immediately — apply your best design judgment.           ║\n" +
    "║  4. HSL format ONLY: \"217 91% 60%\" (no hsl() wrapper, no hex)    ║\n" +
    "║  5. Variable keys WITHOUT '--': \"primary\" not \"--primary\"       ║\n" +
    "╚══════════════════════════════════════════════════════════════════╝\n\n" +

    "╔══════════════════════════════════════════════════════════════════╗\n" +
    "║  DESIGN FREEDOM                                                  ║\n" +
    "╠══════════════════════════════════════════════════════════════════╣\n" +
    "║  You have FULL CREATIVE FREEDOM to improve the store design.     ║\n" +
    "║  → Change any or all css_variables if it improves the result.    ║\n" +
    "║  → Add css_overrides for any section that needs enhancement.     ║\n" +
    "║  → Use gradients, shadows, animations, hover effects freely.     ║\n" +
    "║  → Always include dark_css_variables for a polished result.      ║\n" +
    "╚══════════════════════════════════════════════════════════════════╝\n\n";

  // DESIGN PHILOSOPHY - Adaptive based on intent
  let designPhilosophy = "";
  
  if (isCreativeDelegation) {
    designPhilosophy = 
      "╔══════════════════════════════════════════════════════════════════╗\n" +
      "║  CREATIVE DESIGN PHILOSOPHY                                      ║\n" +
      "╠══════════════════════════════════════════════════════════════════╣\n" +
      "║  You are a SENIOR ECOMMERCE DESIGNER. Create a design that:     ║\n" +
      "║  • CONVERTS: Clear visual hierarchy, prominent CTAs              ║\n" +
      "║  • DELIGHTS: Subtle animations, pleasing color harmony           ║\n" +
      "║  • TRUSTS: Professional polish, consistent spacing               ║\n" +
      "║  • PERFORMS: Clean code, efficient selectors                     ║\n" +
      "║                                                                  ║\n" +
      "║  STYLE OPTIONS (choose based on store vibe):                     ║\n" +
      "║  • MODERN CLEAN: Subtle shadows, generous whitespace, soft radius║\n" +
      "║  • BOLD IMPACT: Strong gradients, vibrant primary, high contrast ║\n" +
      "║  • MINIMALIST: Flat design, thin borders, muted palette          ║\n" +
      "║  • LUXURY: Deep colors, gold accents, elegant typography         ║\n" +
      "║  • PLAYFUL: Rounded corners, bright colors, fun animations       ║\n" +
      "╚══════════════════════════════════════════════════════════════════╝\n\n";
  } else {
    designPhilosophy =
      "╔══════════════════════════════════════════════════════════════════╗\n" +
      "║  DESIGN GUIDELINES                                               ║\n" +
      "╠══════════════════════════════════════════════════════════════════╣\n" +
      "║  • Be BOLD — change the full design, not just one thing          ║\n" +
      "║  • Change ALL css_variables to create a cohesive look            ║\n" +
      "║  • Style EVERY section: hero, products, header, footer, CTA      ║\n" +
      "║  • Use gradients, shadows, animations — the more the better      ║\n" +
      "║  • Ensure high contrast for readability                          ║\n" +
      "╚══════════════════════════════════════════════════════════════════╝\n\n";
  }

  // Current design context (keep existing)
  const currentDesignContext = currentDesign
    ? "╔══════════════════════════════════════════════════════════════════╗\n" +
      "║  CURRENT DESIGN (your baseline — improve freely)                 ║\n" +
      "╠══════════════════════════════════════════════════════════════════╣\n" +
      JSON.stringify(currentDesign, null, 2) + "\n" +
      "╚══════════════════════════════════════════════════════════════════╝\n\n"
    : "╔══════════════════════════════════════════════════════════════════╗\n" +
      "║  CURRENT DESIGN: Platform defaults (fresh start)                 ║\n" +
      "╚══════════════════════════════════════════════════════════════════╝\n\n";

  // History context (keep existing logic)
  let historyContext = "";
  if (historyRecords && historyRecords.length > 0) {
    const appliedChanges = historyRecords.filter((r: any) => r.applied).slice(0, 5);
    const recentRejections = historyRecords.filter((r: any) => !r.applied).slice(0, 2);

    if (appliedChanges.length > 0) {
      historyContext += "╔══════════════════════════════════════════════════════════════════╗\n" +
        "║  RECENT APPLIED DESIGNS                                          ║\n" +
        "╠══════════════════════════════════════════════════════════════════╣\n";
      appliedChanges.forEach((r: any, i: number) => {
        historyContext += `║  ${i + 1}. "${r.prompt}"\n`;
      });
      historyContext += "╚══════════════════════════════════════════════════════════════════╝\n\n";
    }
    
    if (recentRejections.length > 0) {
      historyContext += "╔══════════════════════════════════════════════════════════════════╗\n" +
        "║  FAILED ATTEMPTS - AVOID THESE APPROACHES                        ║\n" +
        "╠══════════════════════════════════════════════════════════════════╣\n";
      recentRejections.forEach((r: any, i: number) => {
        historyContext += `║  ${i + 1}. "${r.prompt}"\n`;
      });
      historyContext += "╚══════════════════════════════════════════════════════════════════╝\n\n";
    }
  }

  // Failure tracking (keep existing)
  let failureContext = "";
  if (historyRecords && historyRecords.length > 0) {
    const failedAttempts = historyRecords.filter((r: any) => !r.applied);
    const similarFailures = failedAttempts.filter((r: any) => calculatePromptSimilarity(currentPrompt, r.prompt) > 0.3);
    if (similarFailures.length >= 2) {
      failureContext = "⚠️  SIMILAR REQUESTS FAILED " + similarFailures.length + " TIMES. USE DIFFERENT STRATEGY.\n\n";
    }
  }

  // Intent and locks (enhanced with creative mode)
  let intentContext = "";
  if (intent === "CREATIVE_DELEGATION" || isCreativeDelegation) {
    intentContext = "╔══════════════════════════════════════════════════════════════════╗\n" +
      "║  USER INTENT: CREATIVE DELEGATION                                ║\n" +
      "║  → User wants YOUR professional design judgment.                   ║\n" +
      "║  → Apply a complete, cohesive, impressive design.                ║\n" +
      "║  → Don't ask - create something that will wow them.              ║\n" +
      "╚══════════════════════════════════════════════════════════════════╝\n\n";
  } else if (intent === "PRESERVE_EXISTING") {
    intentContext = "USER INTENT: TARGETED CHANGE - focus on the requested element, but feel free to improve surrounding elements too.\n\n";
  } else if (intent === "CREATE_NEW") {
    intentContext = "USER INTENT: FULL REDESIGN - change ALL css_variables, ALL sections, be bold and comprehensive.\n\n";
  } else {
    intentContext = "USER INTENT: DESIGN CHANGE - be bold, change css_variables and multiple sections freely.\n\n";
  }

  let locksContext = "";
  if (locks && locks.length > 0) {
    locksContext = "LOCKED ELEMENTS - DO NOT MODIFY:\n" +
      locks.map(l => `  • ${l}`).join("\n") + "\n\n";
  }

  // Store structure (keep existing)
  const storeStructure = "╔══════════════════════════════════════════════════════════════════╗\n" +
    "║  STORE STRUCTURE                                                 ║\n" +
    "╠══════════════════════════════════════════════════════════════════╣\n" +
    "Framework: React + Tailwind CSS + CSS Variables (HSL)\n\n" +
    "LAYOUT CONTROLS:\n" +
    "• product_grid_cols: \"2\" | \"3\" | \"4\"\n" +
    "• section_padding: \"compact\" | \"normal\" | \"spacious\"  \n" +
    "• hero_style: \"image\" | \"gradient\"\n\n" +
    "SECTIONS (use data-ai selectors):\n" +
    "• [data-ai=\"header\"] - Sticky nav with logo, cart, search\n" +
    "• [data-ai=\"section-hero\"] - Main promotional banner\n" +
    "• [data-ai=\"section-categories\"] - Category cards grid\n" +
    "• [data-ai=\"section-featured\"] - Product grid\n" +
    "• [data-ai=\"product-card\"] - Individual product card\n" +
    "• [data-ai=\"section-reviews\"] - Customer reviews\n" +
    "• [data-ai=\"section-cta\"] - Call-to-action banner\n" +
    "• [data-ai=\"section-footer\"] - Footer links\n" +
    "╚══════════════════════════════════════════════════════════════════╝\n\n";

  // CSS Variables reference (keep existing)
  const cssVars = "╔══════════════════════════════════════════════════════════════════╗\n" +
    "║  CSS VARIABLES (HSL format - no hsl() wrapper)                 ║\n" +
    "╠══════════════════════════════════════════════════════════════════╣\n" +
    "ALL 8 REQUIRED for full redesigns:\n" +
    "┌─────────────────┬──────────────────────────────────────────────┐\n" +
    "│ --primary       │ Brand color. Buttons, links, accents, prices │\n" +
    "│ --background    │ Page background (light: 0 0% 100%)             │\n" +
    "│ --foreground    │ Main text (dark: 222 47% 11%)                  │\n" +
    "│ --card          │ Card backgrounds                               │\n" +
    "│ --muted         │ Subtle backgrounds, badges                     │\n" +
    "│ --muted-foreground│ Secondary text, descriptions                 │\n" +
    "│ --border        │ Card borders, dividers                         │\n" +
    "│ --radius        │ Border radius (0.5rem default)               │\n" +
    "└─────────────────┴──────────────────────────────────────────────┘\n" +
    "DARK MODE: Provide dark_css_variables with adjusted values\n" +
    "╚══════════════════════════════════════════════════════════════════╝\n\n";

  // ENHANCED CSS Capabilities section
  const capabilities = "╔══════════════════════════════════════════════════════════════════╗\n" +
    "║  CSS CAPABILITIES                                                ║\n" +
    "╠══════════════════════════════════════════════════════════════════╣\n" +
    "You can generate ANY valid CSS in css_overrides using data-ai selectors:\n\n" +
    
    "CREATIVE TECHNIQUES (use freely — the more the better):\n" +
    "• Gradients: background: linear-gradient(135deg, hsl(var(--primary)/0.2) 0%, transparent 100%);\n" +
    "• Glassmorphism: backdrop-filter: blur(12px); background: hsl(var(--background)/0.8);\n" +
    "• Shadows: box-shadow: 0 20px 40px -10px hsl(var(--foreground)/0.15);\n" +
    "• Hover lifts: transform: translateY(-8px); transition: all 0.3s ease;\n" +
    "• Image zoom: transform: scale(1.08); transition: transform 0.5s ease;\n" +
    "• Animated gradients: background-size: 200% 200%; animation: gradient 15s ease infinite;\n" +
    "• Text shadows: text-shadow: 0 2px 10px hsl(var(--foreground)/0.1);\n\n" +
    
    "SELECTOR EXAMPLES:\n" +
    "• [data-ai=\"section-hero\"] { background: linear-gradient(...); }\n" +
    "• [data-ai=\"product-card\"]:hover { transform: translateY(-8px); box-shadow: ...; }\n" +
    "• [data-ai=\"product-card\"] img { transition: transform 0.5s ease; }\n" +
    "• [data-ai=\"section-cta\"] { background: hsl(var(--primary)); position: relative; }\n" +
    "• [data-ai=\"section-cta\"]::before { content: ''; ... } /* overlay effects */\n" +
    "╚══════════════════════════════════════════════════════════════════╝\n\n";

  // Response format (enhanced)
  const responseFormat = "╔══════════════════════════════════════════════════════════════════╗\n" +
    "║  RESPONSE FORMAT                                                 ║\n" +
    "╠══════════════════════════════════════════════════════════════════╣\n" +
    "DESIGN RESPONSE (use for ANY visual change):\n" +
    "{\n" +
    "  \"type\": \"design\",\n" +
    "  \"message\": \"I created a [style] design with [features]. Want to adjust?\",\n" +
    "  \"design\": {\n" +
    "    \"summary\": \"One compelling sentence describing the design\",\n" +
    "    \"css_variables\": { \"primary\": \"265 89% 78%\", \"background\": \"0 0% 100%\", ... },\n" +
    "    \"dark_css_variables\": { \"primary\": \"265 89% 82%\", \"background\": \"222 47% 8%\", ... },\n" +
    "    \"layout\": { \"product_grid_cols\": \"3\", \"section_padding\": \"spacious\" },\n" +
    "    \"css_overrides\": \"[data-ai='section-hero']{...}[data-ai='product-card']:hover{...}\",\n" +
    "    \"changes_list\": [\n" +
    "      \"Applied purple gradient hero with depth\",\n" +
    "      \"Added product card hover lift with shadow\",\n" +
    "      \"Set spacious padding for editorial feel\",\n" +
    "      \"Created cohesive 8-color professional palette\"\n" +
    "    ]\n" +
    "  }\n" +
    "}\n\n" +
    
    "DESIGN QUALITY NOTES:\n" +
    "• css_overrides should be SUBSTANTIAL — style multiple sections\n" +
    "• Include ALL 8 css_variables for any design change\n" +
    "• Always provide dark_css_variables for a polished result\n" +
    "• Use effects freely — enhance, don't hold back\n\n" +
    
    "TEXT RESPONSE (only for pure chat, no design):\n" +
    "{ \"type\": \"text\", \"message\": \"Your helpful response here\" }\n\n" +
    
    "RULES:\n" +
    "• Keys WITHOUT '--': \"primary\" not \"--primary\"\n" +
    "• HSL only: \"217 91% 60%\" not \"hsl(...)\" or \"#hex\"\n" +
    "• Start with { and end with }. NOTHING else.\n" +
    "╚══════════════════════════════════════════════════════════════════╝\n\n";

  // Final reminder
  const finalReminder = "╔══════════════════════════════════════════════════════════════════╗\n" +
    "║  FINAL CHECKLIST                                                 ║\n" +
    "╠══════════════════════════════════════════════════════════════════╣\n" +
    "□ Valid JSON starting with { and ending with }                     \n" +
    "□ All 8 css_variables present (ALWAYS required)                    \n" +
    "□ dark_css_variables provided                                      \n" +
    "□ css_overrides is SUBSTANTIAL — styles multiple sections          \n" +
    "□ css_overrides uses [data-ai=\"...\"] selectors                   \n" +
    "□ Variable keys without '--' prefix                                \n" +
    "□ HSL values in correct format                                     \n" +
    "□ Design is bold, comprehensive and visually impressive            \n" +
    "╚══════════════════════════════════════════════════════════════════╝\n";

  // Assemble final prompt
  return criticalRulesTop + 
         designPhilosophy + 
         currentDesignContext + 
         intentContext + 
         locksContext +
         failureContext +
         historyContext +
         storeStructure + 
         cssVars + 
         capabilities + 
         responseFormat + 
         finalReminder;
}

/**
 * Lightweight system prompt for casual chat (non-design requests).
 * Used when isDesignRequest() returns false.
 * No token charge for casual chat responses.
 * Still enforces JSON output contract to keep parsing consistent.
 */
function buildChatSystemPrompt(storeName: string): string {
  return "You are a creative design assistant for " + storeName + " e-commerce store.\n\n" +
    "Respond ONLY with valid JSON. No prose, no markdown.\n" +
    "Act immediately with your best design judgment — feel free to enhance what you see.\n\n" +
    "For casual chat (no design): {\"type\":\"text\",\"message\":\"response\"}\n" +
    "For any design change: {\"type\":\"design\",\"message\":\"Applied [X]. Adjust?\",\"design\":{...}}\n\n" +
    "Start with { and end with }. Always include css_variables or css_overrides when making design changes.";
}

// ============================================================
// SECTION 13: MAIN REQUEST HANDLER
// ============================================================
// Entry point for all requests to this edge function.
// Routes to the correct action handler based on body.action.
//
// All requests must be POST with JSON body.
// OPTIONS is handled for CORS preflight.
// The Supabase client uses SERVICE_ROLE_KEY (bypasses RLS)
// so the function can read platform_settings and all stores.
// ============================================================

serve(async (req) => {
  // Handle CORS preflight (browser sends OPTIONS before POST)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    // Use service role key — needed to read platform_settings (no RLS bypass otherwise)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, store_id, user_id, prompt, design, history_id, package_id, amount, currency, version_number, messages } = body;

    // ──────────────────────────────────────────────────────────
    // ACTION: get_token_balance
    // Returns total tokens remaining across all active purchases.
    // Also auto-expires overdue tokens and cleans up pending rows.
    // Called on: AI Designer page load, after each chat response.
    // ──────────────────────────────────────────────────────────
    if (action === "get_token_balance") {
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

    // ──────────────────────────────────────────────────────────
    // ACTION: generate_design (Legacy / Backward Compatibility)
    // One-shot: prompt → AI → design. No chat history.
    // Steps: validate → rate limit → check tokens → call AI →
    //        parse → validate → normalize → sanitize → save → return
    // ──────────────────────────────────────────────────────────
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
          (platformSettings.openrouter_model || "moonshotai/kimi-k2").trim(),
          platformSettings.openrouter_fallback_model?.trim() || null,
          platformSettings.openrouter_api_key.trim(),
          {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: "Store: " + storeName + ". Request: " + prompt }
            ],
            response_format: { type: "json_object" },
            temperature: getTemperature(prompt),
            max_tokens: 3000
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
        const errBody = await aiResult.response.text().catch(() => "");
        console.error("OpenRouter API error:", aiResult.response.status, errBody);
        logMetrics(supabase, { store_id, user_id, action: "generate_design", success: false, error_type: "api_error" }).catch(console.error);
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

      // FIX Issue-3: Normalize CSS variable keys (strip "--" prefix if AI included it)
      if (parsedDesign.css_variables) {
        parsedDesign.css_variables = normalizeVarKeys(parsedDesign.css_variables);
      }
      if ((parsedDesign as any).dark_css_variables) {
        (parsedDesign as any).dark_css_variables = normalizeVarKeys((parsedDesign as any).dark_css_variables);
      }

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

    // ──────────────────────────────────────────────────────────
    // ACTION: chat (Primary Action — used by the AI Designer UI)
    // Full conversational flow with history, failure tracking,
    // intent classification, semantic locks, and delta parsing.
    //
    // Steps:
    //   1. Validate UUIDs + rate limit
    //   2. Fetch platform settings (OpenRouter key + model)
    //   3. Classify prompt: design vs casual chat
    //   4. Detect intent (PRESERVE/CREATE_NEW) + semantic locks
    //   5. Fetch history (last 20 records for failure tracking)
    //   6. Always fetch current design (for delta merge context)
    //   7. Check tokens BEFORE calling AI (if design request)
    //   8. Build full or lightweight system prompt
    //   9. Trim conversation window to last 6 messages
    //  10. Call AI with 45s timeout + fallback model
    //  11. Parse (extractJSON) → unwrap if double-wrapped
    //  12. Validate against Delta or Legacy Zod schema
    //  13. If Delta: merge onto currentDesign via applyDeltaChanges
    //  14. Normalize CSS var keys + sanitize CSS + minify
    //  15. Check size limits (15KB CSS / 10KB JSON)
    //  16. Deduct 1 token (optimistic lock prevents double-deduct)
    //  17. Save to ai_designer_history (JSONB + TEXT separated)
    //  18. Detect if change is destructive (>50% vars changed)
    //  19. Log metrics + return result
    // ──────────────────────────────────────────────────────────
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

      // STRATEGY #3: Classify intent + STRATEGY #7: Detect semantic locks
      const intent = classifyIntent(userPrompt);
      const locks = detectSemanticLocks(userPrompt);

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

        // Use FULL detailed system prompt with intent + locks (STRATEGY #3 + #7)
        systemPrompt = buildFullChatSystemPrompt(storeName, storeDescription, currentDesign, historyRecords || [], userPrompt, intent, locks);
      } else {
        systemPrompt = buildChatSystemPrompt(storeName);
      }

      // Manage conversation window (keep last 6 messages = 3 exchanges, prevents context pollution)
      let managedMessages = messages;
      if (messages.length > 6) {
        managedMessages = messages.slice(-6);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      let aiResult;
      let modelUsed: string;
      try {
        aiResult = await callAIWithFallback(
          (platformSettings.openrouter_model || "moonshotai/kimi-k2").trim(),
          platformSettings.openrouter_fallback_model?.trim() || null,
          platformSettings.openrouter_api_key.trim(),
          {
            messages: [{ role: "system", content: systemPrompt }, ...managedMessages],
            response_format: { type: "json_object" },
            temperature: getTemperature(userPrompt, (historyRecords || []).filter((r: any) => !r.applied && calculatePromptSimilarity(userPrompt, r.prompt) > 0.3).length >= 2),
            max_tokens: 4000
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
        const errBody = await aiResult.response.text().catch(() => "");
        console.error("OpenRouter API error (chat):", aiResult.response.status, errBody);
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
      // FIX Issue-2: Unwrap design JSON double-wrapped inside text message
      parsed = unwrapNestedDesign(parsed);

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

        // FIX Issue-3: Normalize CSS variable keys (strip "--" prefix if AI included it)
        if (finalDesign.css_variables) {
          finalDesign.css_variables = normalizeVarKeys(finalDesign.css_variables);
        }
        if ((finalDesign as any).dark_css_variables) {
          (finalDesign as any).dark_css_variables = normalizeVarKeys((finalDesign as any).dark_css_variables);
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

        // STRATEGY #6: Destructive change detection
        const destructiveInfo = detectDestructiveChange(currentDesign, finalDesign);
        if (destructiveInfo.destructive) {
          parsed._destructive = true;
          parsed._destructive_info = {
            changePercent: destructiveInfo.changePercent,
            changedFields: destructiveInfo.changedFields,
            message: `This will change ${destructiveInfo.changePercent}% of your color variables (${destructiveInfo.changedFields.length} fields). Review before publishing.`,
          };
          console.log("Destructive change detected:", destructiveInfo);
        }

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
        design: parsed.design || null, history_id: historyId, tokens_remaining: newTokenBalance,
        is_destructive: parsed._destructive || false,
        destructive_info: parsed._destructive_info || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────────────────────────────────────────────────────────
    // ACTION: apply_design (Publish button)
    // Saves the AI-generated design to store_design_state table.
    // Also keeps a version_history (last 10 versions) for rollback.
    // Marks the history record as applied=true.
    // The store's frontend reads store_design_state on load and
    // injects the CSS variables into the page.
    // ──────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────
    // ACTION: reset_design (Reset button)
    // Deletes the store's row from store_design_state.
    // When no row exists, the frontend falls back to hardcoded
    // Tailwind defaults (platform default design).
    // This is a hard reset — version history is also lost.
    // ──────────────────────────────────────────────────────────
    if (action === "reset_design") {
      if (!store_id) {
        return new Response(JSON.stringify({ success: false, error: "Missing store_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      await supabase.from("store_design_state").delete().eq("store_id", store_id);
      return new Response(JSON.stringify({ success: true, message: "Store design reset to platform default" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────────────────────────────────────────────────────────
    // ACTION: rollback_design
    // Restores a specific previous version from version_history.
    // version_history is stored in store_design_state and holds
    // the last 10 published designs with timestamps.
    // ──────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────
    // ACTION: create_payment_order
    // Creates a Razorpay order for purchasing AI tokens.
    // Returns: { razorpay_order_id, razorpay_key_id, amount }
    // Frontend uses these to open the Razorpay payment popup.
    // After payment success, frontend calls confirm_payment.
    // ──────────────────────────────────────────────────────────
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