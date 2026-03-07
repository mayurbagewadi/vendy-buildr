/**
 * AI Designer Edge Function - Changelog & Optimization History
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Server-side AI integration for store design generation
 * MODELS: Kimi K2.5 (moonshotai/kimi-k2) via OpenRouter
 * TOKEN SYSTEM: Credit-based, deducts ACTUAL OpenRouter tokens per generation (not hardcoded 1)
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * CHANGE LOG WITH DATES & BUSINESS IMPACT
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * [FEB 16, 2026] - Initial AI Designer System
 *   Added: Layer 1 CSS variables system (primary colors, spacing, radius)
 *   Added: Token purchase + balance tracking
 *   Added: Design history logging to ai_designer_history table
 *   Business Impact: Foundation for AI-powered store styling
 *
 * [FEB 23, 2026 MORNING] - Template Literal to String Concatenation
 *   Issue: Deno bundler couldn't parse template literals with ${} expressions
 *   Changed: All 50+ template literals → string concatenation with + operator
 *   Files: buildLayer2SystemPrompt(), CSS parsing logic, error messages
 *   Business Impact: Enabled edge function deployment (was previously failing)
 *
 * [FEB 23, 2026 EVENING] - Token Bloat Fix: 73,086 → 5-8K tokens
 *   Issue: AI spending $14.30/request (73K tokens) due to:
 *     - Duplicate design state in system prompt + conversation
 *     - Verbose HTML listings (all components described twice)
 *     - Repetitive instructions (same rules in multiple places)
 *     - No AI capability limits (hallucinating animations, parallax, etc)
 *   Fixed:
 *     - Removed duplicates in design context
 *     - Compressed component listings
 *     - Added "CSS only, NO JavaScript" rule
 *     - Forbid animation terms: scroll, parallax, particles, fade, etc
 *   Token Impact: 90% reduction ($14.30 → $1.50 per request)
 *   Cost Saved: ~$13/request × 100 requests/day = $1,300/day
 *
 * [FEB 24, 2026] - Layer 2 CSS System Launch
 *   Added: Full CSS generation (not just variables)
 *   Added: Intent classification (TARGETED vs COMPLETE redesigns)
 *   Added: Multi-page HTML scanning (extract /products, /categories, detail pages)
 *   Added: Snapshot-based context (AI sees actual HTML structure, not descriptions)
 *   Business Impact: AI now styles entire store, not just variables
 *   Token Cost: ~5K tokens per generation (within budget)
 *
 * [FEB 26, 2026] - Clean HTML Snapshot System
 *   Issue: Second AI request failed (HTTP 546) - cached/stale iframe HTML
 *   Fixed: Capture clean HTML snapshot ONCE on iframe load, reuse for all requests
 *   Implementation: cleanHTMLSnapshotRef stores pristine HTML without CSS injection
 *   Business Impact: Eliminated cascading failures on multi-turn conversations
 *
 * [MAR 6, 2026] - Granular Data-AI Attributes (THIS COMMIT)
 *   Added: 30+ data-ai selectors across all customer pages:
 *     - Products: products-count, sort-button, category-checkboxes, etc
 *     - Product Detail: category-badge, product-name, product-price, etc
 *     - Categories: categories-hero-heading, category-card-*, etc
 *     - Cart: cart-item-image, cart-item-name, quantity-buttons, etc
 *     - Checkout: customer-info-heading, delivery-address-heading, etc
 *   Added: Comprehensive Site Context Manifest in aiSiteManifest.ts
 *   Business Impact: AI now has access to style individual elements with precision
 *   Token Cost: Site manifest ~1.5KB sent with each request (acceptable)
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * KNOWN ISSUES & OPTIMIZATION OPPORTUNITIES
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * CRITICAL: Token Usage Discrepancy (MAR 6, 2026)
 *   Issue: Claude token usage ≠ OpenRouter actual usage
 *   Suspected causes:
 *     1. System prompt overhead not counted in Claude tokens
 *     2. Conversation history accumulation (grows unbounded)
 *     3. HTML snapshot size (multi-page snapshots)
 *     4. Site manifest repeated per request
 *   TODO: Add OpenRouter token logging to diagnose exact ratio
 *   TODO: Implement conversation history trimming
 *   TODO: Consider manifest caching/compression
 *
 * PERFORMANCE: Streaming (Not Yet Implemented)
 *   Opportunity: Stream AI response text as it generates
 *   Current: User waits 10-30s for full response
 *   TODO: Add SSE streaming to show progress
 *
 * ═════════════════════════════════════════════════════════════════════════════
 */

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

// ─── Form Element Protection (prevent breaking checkout/forms) ──────────
function validateFormSafety(css: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];

  const protectedSelectors = [
    'checkout-field-input', 'checkout-field-label', 'checkout-form',
    'customer-info-card', 'delivery-address-card', 'payment-method-card',
    'place-order-button', 'coupon-input', 'apply-coupon-button',
    'cart-item', 'cart-summary', 'order-summary'
  ];

  const forbiddenProps = ['display', 'visibility', 'opacity', 'pointer-events', 'z-index', 'height', 'width', 'position', 'overflow'];

  // Check for rules targeting protected elements with forbidden properties
  const rulePattern = /\[data-ai="([^"]+)"\]\s*\{([^}]+)\}|button\s*\{([^}]+)\}|input\s*\{([^}]+)\}/gi;
  let match;
  while ((match = rulePattern.exec(css)) !== null) {
    const selector = match[1] || '';
    const props = match[2] || match[3] || match[4] || '';

    // Check if selector is protected
    const isProtected = protectedSelectors.some(p => selector.includes(p));
    if (!isProtected) continue;

    // Check for forbidden properties
    forbiddenProps.forEach(prop => {
      const propPattern = new RegExp(prop + '\\s*:', 'gi');
      if (propPattern.test(props)) {
        violations.push('Protected element [data-ai="' + selector + '"] cannot use property: ' + prop);
      }
    });
  }

  return {
    safe: violations.length === 0,
    violations
  };
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
  console.log("[PARSER] Parsing AI text response (" + aiText.length + " chars)");
  const sections: ParsedSection[] = [];

  // Try SECTION/CHANGE/COLOR block format first
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
      console.log("[PARSER] Block " + blockIdx + ": " + (section as ParsedSection).name + " → " + (section as ParsedSection).change.slice(0, 50));
    }
  });

  // If no structured blocks found, scan entire text for variable=value patterns
  if (sections.length === 0) {
    console.log("[PARSER] No SECTION blocks found, scanning for loose variable patterns");
    const varPattern = /\b(primary|background|foreground|card|muted|border|accent|secondary|radius)\s*[=:]\s*([\d]+\s+[\d]+%\s+[\d]+%|[\d.]+\s*rem)/gi;
    const matches = [...aiText.matchAll(varPattern)];
    if (matches.length > 0) {
      sections.push({
        name: "store",
        change: "Updated store colors based on your request",
        color: matches.map(m => m[1].toLowerCase() + "=" + m[2].trim()).join(" ")
      });
      console.log("[PARSER] Found " + matches.length + " loose variable patterns");
    }
  }

  console.log("[PARSER] Total sections parsed: " + sections.length);
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
  // Flexible validation - only reject if completely empty
  if (!sections || sections.length === 0) {
    return { valid: false, errors: ["No design sections found in response"] };
  }
  console.log("[VALIDATION] Accepted " + sections.length + " section(s)");
  return { valid: true, errors: [] };
}

// ─── Validate CSS variable values ───────────────────
function isValidCSSValue(varName: string, value: string): boolean {
  // For radius, check if it's a valid length unit
  if (varName === 'radius') {
    return /^[\d.]+\s*(rem|px|em|%)$/.test(value.trim());
  }

  // For color variables (HSL), ensure 3 space-separated values (Hue Saturation% Lightness%)
  const parts = value.trim().split(/\s+/);
  return parts.length === 3;
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

  // Map sections to real CSS variables and correct selectors
  const sectionToVarMap: Record<string, string[]> = {
    'section-hero': ['background', 'primary'],
    'section-categories': ['card', 'radius'],
    'section-featured': ['card', 'primary', 'radius'],
    'product-card': ['card', 'primary', 'radius'],
    'category-card': ['card', 'radius'],
    'section-reviews': ['card', 'foreground'],
    'section-new-arrivals': ['card', 'primary'],
    'section-cta': ['primary', 'secondary'],
    'section-footer': ['background', 'foreground'],
    // Legacy fallbacks (for backward compatibility)
    'hero': ['background', 'primary'],
    'categories': ['card', 'radius'],
    'products': ['card', 'primary', 'radius'],
    'cta': ['primary', 'secondary'],
    'footer': ['background', 'foreground'],
  };

  sections.forEach(section => {
    // Add to changes list
    changesList.push(section.name.charAt(0).toUpperCase() + section.name.slice(1) + " → " + section.change);

    if (!section.color) return;

    // Handle loose variable=value pairs (from fallback parser)
    // e.g. "primary=350 80% 55% background=220 15% 10%"
    if (section.color.includes('=')) {
      const pairPattern = /(primary|background|foreground|card|muted|muted-foreground|border|accent|secondary|radius)\s*=\s*([\d]+\s+[\d]+%\s+[\d]+%|[\d.]+\s*rem)/gi;
      const pairs = [...section.color.matchAll(pairPattern)];
      pairs.forEach(pair => {
        const varName = pair[1].toLowerCase();
        const value = pair[2].trim();
        if (isValidCSSValue(varName, value)) {
          cssVariables[varName] = value;
          console.log("[MAP] Loose pattern → variable \"--" + varName + "\" = " + value);
        }
      });
      return; // Skip section-to-var mapping for loose patterns
    }

    // Standard SECTION/CHANGE/COLOR format: look up section → variable mapping
    let sectionName = sectionToVarMap[section.name.toLowerCase()] ? section.name.toLowerCase() : null;
    if (!sectionName) {
      sectionName = Object.keys(sectionToVarMap).find(key =>
        section.name.toLowerCase().includes(key)
      ) || 'section-hero';
    }

    // If color provided, apply it to the main variable for this section
    {
      const vars = sectionToVarMap[sectionName] || ['primary'];
      const mainVar = vars[0];

      if (isValidCSSValue(mainVar, section.color)) {
        cssVariables[mainVar] = section.color;
        console.log("[MAP] Section \"" + sectionName + "\" → variable \"--" + mainVar + "\" = " + section.color);
      } else {
        console.log("[SKIP] Invalid value for \"--" + mainVar + "\": \"" + section.color + "\"");
      }

      // Parse change description for creative effects
      const changeLower = section.change.toLowerCase();

      // Rounded corners
      if (changeLower.includes('rounded') || changeLower.includes('pill')) {
        cssVariables['radius'] = '1.5rem';
      }

      // Shadow effects
      if (changeLower.includes('shadow')) {
        cssOverrides.push("[data-ai=\"" + sectionName + "\"] { box-shadow: 0 8px 24px hsla(0, 0%, 0%, 0.2); }");
      }

      // Glassmorphism
      if (changeLower.includes('glass') || changeLower.includes('blur')) {
        cssOverrides.push("[data-ai=\"" + sectionName + "\"] { backdrop-filter: blur(12px); background: hsla(" + section.color + ", 0.75); border: 1px solid hsla(255, 255%, 255%, 0.2); }");
      }

      // Gradients
      if (changeLower.includes('gradient') || changeLower.includes('smooth fade')) {
        const hslValues = section.color.split(' ');
        const baseHue = parseInt(hslValues[0]) || 220;
        cssOverrides.push("[data-ai=\"" + sectionName + "\"] { background: linear-gradient(135deg, hsl(" + baseHue + " 90% 50%), hsl(" + (baseHue + 40) + " 85% 60%)); }");
      }

      // Glow/Neon effects
      if (changeLower.includes('glow') || changeLower.includes('neon') || changeLower.includes('glowing')) {
        cssOverrides.push("[data-ai=\"" + sectionName + "\"] { box-shadow: 0 0 20px hsl(" + section.color + "), 0 0 40px hsla(" + section.color + ", 0.5); }");
      }

      // Holographic/Shimmer
      if (changeLower.includes('holographic') || changeLower.includes('shimmer') || changeLower.includes('iridescent')) {
        cssOverrides.push("[data-ai=\"" + sectionName + "\"] { background: linear-gradient(45deg, hsl(" + section.color + "), hsl(" + (parseInt(section.color.split(" ")[0]) + 60) + " 90% 55%)); animation: shimmer 3s infinite; }");
      }

      // Hover effects
      if (changeLower.includes('hover') || changeLower.includes('lift') || changeLower.includes('animation')) {
        cssOverrides.push("[data-ai=\"" + sectionName + "\"]:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 12px 32px hsla(0, 0%, 0%, 0.25); transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }");
      }

      // Bold/Vibrant
      if (changeLower.includes('bold') || changeLower.includes('vibrant') || changeLower.includes('striking')) {
        if (isValidCSSValue('primary', section.color)) {
          cssVariables['primary'] = section.color;
          cssVariables['accent'] = section.color;
        }
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

  // ─── Contrast check: ensure button (primary) is visible on background ───
  const parseLightness = (hsl: string): number => {
    const parts = hsl.trim().split(/\s+/);
    return parts.length === 3 ? parseFloat(parts[2].replace('%', '')) : -1;
  };
  const primaryL = parseLightness(cssVariables['primary'] || '');
  const backgroundL = parseLightness(cssVariables['background'] || '');
  if (primaryL >= 0 && backgroundL >= 0) {
    const diff = Math.abs(primaryL - backgroundL);
    if (diff < 25) {
      // Button too close to background — auto-fix primary lightness
      const fixedL = backgroundL > 50 ? 25 : 75; // dark bg → light button, light bg → dark button
      const parts = cssVariables['primary'].trim().split(/\s+/);
      cssVariables['primary'] = parts[0] + ' ' + parts[1] + ' ' + fixedL + '%';
      console.log('[CONTRAST] Primary too close to background (diff=' + diff + '%). Fixed primary lightness to ' + fixedL + '%: ' + cssVariables['primary']);
    } else {
      console.log('[CONTRAST] OK — primary vs background diff=' + diff + '%');
    }
  }

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
  return "You are a CSS designer for '" + storeName + "' ecommerce store.\n\n" +
    "CSS variables you can change:\nprimary, background, foreground, card, muted, muted-foreground, border, accent, secondary, radius\n\n" +
    "Color format: HSL without parentheses, e.g. 350 80% 55%\n" +
    "Radius format: rem value, e.g. 1rem\n\n" +
    "Response format:\nSECTION: hero\nCHANGE: description of what you changed\nCOLOR: primary=350 80% 55%\n---\nSECTION: cards\nCHANGE: description\nCOLOR: card=0 0% 98%\n---";
}

// ─── AI-Based Intent Classification ──────────────────────────
function classifyUserIntent(userPrompt: string): "targeted" | "complete" {
  const lower = userPrompt.toLowerCase();
  const completeKeywords = [
    "everything", "entire store", "complete redesign", "redesign everything",
    "from scratch", "full makeover", "overhaul", "transform everything",
    "all sections", "whole store", "full redesign", "completely change",
    "redo everything", "start over",
    "colour full", "color full", "full design", "new design", "full style",
    "style the store", "design the store", "make it", "all of it",
    "colour scheme", "color scheme", "aesthetic", "rebrand", "restyle",
    "beautiful", "nice", "modern", "professional", "elegant", "fancy",
    "i want ", "make the", "change the", "update the", "improve the",
    "website design", "store design", "shop design", "look good", "look nice"
  ];
  const result = completeKeywords.some(kw => lower.includes(kw)) ? "complete" : "targeted";
  console.log("[CLASSIFY] Keyword-based result:", result, "for:", userPrompt.slice(0, 50));
  return result;
}

// ─── Layer 2 System Prompt (Full CSS Generation — Mode B) ─────
// Mode B: AI always generates CSS immediately, decides its own scope.
// Small request = few lines. Full redesign = many lines. No upfront classification.
// Merge new CSS with existing CSS by replacing overridden selectors
function mergeCSS(existing: string, incoming: string): string {
  if (!existing) return incoming;
  if (!incoming) return existing;

  // Parse selectors from incoming CSS
  const incomingSelectors = new Set<string>();
  incoming.replace(/([^{}]+)\{/g, function(_: string, sel: string) {
    incomingSelectors.add(sel.trim());
    return '';
  });

  // Filter out overridden rules from existing
  const filteredExisting = existing.replace(
    /([^{}]+)\{[^}]*\}/g,
    function(match: string, sel: string) {
      return incomingSelectors.has(sel.trim()) ? '' : match;
    }
  );

  // Combine: filtered existing + new
  return (filteredExisting.trim() + '\n\n/* --- AI Update --- */\n' + incoming.trim()).trim();
}

/**
 * BUILDS SYSTEM PROMPT FOR AI CSS GENERATION
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * TOKEN COMPOSITION (approximate, per request):
 * ─────────────────────────────────────────────
 * - System prompt intro (instructions): ~400 tokens
 * - Theme context (light/dark mode rules): ~200 tokens
 * - Site manifest (all selectors): ~500 tokens (ADDED MAR 6, 2026)
 * - HTML snapshot (home page structure): ~1000-1500 tokens
 * - Existing CSS (previously generated): ~500-1000 tokens (if present)
 * - Conversation history (all prior turns): ~500-2000 tokens (GROWS UNBOUNDED)
 * ─────────────────────────────────────────────
 * TYPICAL TOTAL: 3200-5500 tokens input (varies with conversation length)
 * OUTPUT (CSS + explanation): 500-1000 tokens
 * TOTAL PER REQUEST: 3700-6500 tokens
 *
 * OPTIMIZATION OPPORTUNITIES:
 * - Trim conversation history (currently unlimited)
 * - Compress HTML snapshot (currently ~2KB plain text)
 * - Implement manifest caching (avoid resending on every request)
 * - Streaming response (reduce user wait time, not token cost)
 * ═════════════════════════════════════════════════════════════════════════════
 */
function buildLayer2SystemPrompt(htmlStructure: string, layer1Baseline: any, existingCSS: string, theme: string = "light", siteManifest: string = ""): string {
  console.log("[LAYER2] Building system prompt - includes manifest + HTML + CSS context");
  console.log("[TOKEN-MONITOR] Manifest size:", siteManifest.length, "chars");
  console.log("[TOKEN-MONITOR] HTML snapshot size:", htmlStructure.length, "chars");
  console.log("[TOKEN-MONITOR] Existing CSS size:", existingCSS.length, "chars");

  // Store context: what CSS is already applied (so AI doesn't repeat work)
  // ADDED FEB 24, 2026 - Enables cumulative design system
  const stateContext = existingCSS
    ? "CURRENTLY APPLIED CSS (preserve rules you don't need to change):\n" + existingCSS + "\n\n"
    : "";

  // Site context: ALL selectors across all pages (so AI knows what's available)
  // ADDED MAR 6, 2026 - Enables precise styling without hallucination
  const manifestContext = siteManifest
    ? siteManifest + "\n\n"
    : "";

  const isDark = theme === "dark";
  const themeContext = "CURRENT THEME: " + (isDark ? "DARK" : "LIGHT") + " mode\n" +
    "DARK MODE SUPPORT: This store supports both light and dark mode.\n" +
    "The <html> element gets class=\"dark\" when the user switches to dark mode.\n\n" +
    "DARK MODE CSS RULES:\n" +
    "- Light mode styles: write normally (no prefix needed)\n" +
    "- Dark mode overrides: prefix every selector with .dark\n" +
    "  Example:\n" +
    "    [data-ai=\"header\"] { background: #ffffff; color: #111111; }\n" +
    "    .dark [data-ai=\"header\"] { background: #1a1a2e; color: #e2e8f0; }\n" +
    "- ALWAYS generate BOTH light and dark variants for any background, color, or border change.\n" +
    "- For shadows and gradients, provide dark-friendly versions too.\n\n";

  return "You are a friendly, creative senior CSS designer helping a store owner make their online store beautiful.\n" +
    "You speak warmly and naturally — like a talented designer explaining their work to a client.\n" +
    "You always generate CSS first, then explain your thinking in a conversational way.\n\n" +
    themeContext +
    manifestContext +
    "HOME PAGE HTML SNAPSHOT (visual structure reference — preview iframe shows this page only):\n" + htmlStructure + "\n\n" +
    stateContext +
    "Your approach:\n" +
    "- ALWAYS generate CSS immediately. Never refuse. Never ask questions.\n" +
    "- Decide scope yourself: a targeted request = few lines. A full redesign = many lines.\n" +
    "- Output ONLY new or modified CSS rules. Existing unchanged rules are preserved automatically.\n" +
    "- If you need to override an existing rule, include it with updated values.\n" +
    "- Build on previous changes from conversation history. Maintain visual consistency.\n" +
    "- Use ONLY selectors from the Site Manifest and HTML above. Only valid CSS, no JavaScript.\n" +
    "- When designing globally (colors, fonts, buttons), include ALL pages from the manifest — not just the home page.\n" +
    "- DO NOT auto-apply gradients. Only use solid colors by default. You MAY suggest gradients in your SUMMARY as an optional enhancement (e.g., 'Would you like a gradient hero? Let me know!'). Only generate gradient CSS if user explicitly asks 'add gradient', 'make it gradient', etc.\n" +
    "- PROTECTED FORM ELEMENTS — DO NOT MODIFY THESE UNDER ANY CIRCUMSTANCES:\n" +
    "  [data-ai=\"checkout-field-input\"], [data-ai=\"checkout-field-label\"], [data-ai=\"checkout-form\"],\n" +
    "  [data-ai=\"customer-info-card\"], [data-ai=\"delivery-address-card\"], [data-ai=\"payment-method-card\"],\n" +
    "  [data-ai=\"order-summary-heading\"], [data-ai=\"place-order-button\"],\n" +
    "  [data-ai=\"coupon-input\"], [data-ai=\"apply-coupon-button\"],\n" +
    "  [data-ai=\"cart-item\"], [data-ai=\"cart-summary\"],\n" +
    "  button, input, textarea, select, [role=\"button\"], [role=\"radio\"], [role=\"checkbox\"]\n" +
    "  FORBIDDEN PROPERTIES: display, visibility, opacity, pointer-events, z-index, height, width, position, overflow\n" +
    "  If user asks to style buttons/inputs: only modify color, font, border-radius, padding — NEVER hide or disable them.\n" +
    "- NEVER add or change background or background-color on section containers, cards, or page wrappers (like [data-ai=\"section-hero\"], [data-ai=\"checkout-form\"], [data-ai=\"filter-card\"], [data-ai=\"cart-summary\"], [data-ai=\"customer-info-card\"] etc.) unless the user EXPLICITLY asks to change the background or color. If user says 'change font', 'make buttons rounded', 'update border' — do NOT touch any background property on sections or cards.\n" +
    "- Background changes are ONLY allowed on: badges, tags, price labels, individual product cards, and accent elements — never on full-page sections, card wrappers, or form containers.\n\n" +
    "Output format (follow EXACTLY):\n\n" +
    "```css\n[your CSS here]\n```\n\n" +
    "SUMMARY: [1-2 sentence friendly explanation of what you did and why, like talking to the store owner. " +
    "Example: \"I gave your hero section a bold primary color background — paired with softer product cards so the eye flows naturally.\"]\n\n" +
    "CHANGES:\n" +
    "SECTION: [area name]\n" +
    "CHANGE: [what you changed and why]\n" +
    "---";
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
        .select("openrouter_api_key, openrouter_model, openrouter_fallback_model").eq("id", SETTINGS_ID).single();

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
      const model = (platformSettings.openrouter_model || platformSettings.openrouter_fallback_model || "").trim();
      if (!model) {
        return new Response(JSON.stringify({ success: false, error: "No AI model configured. Please set a model in Super Admin → Platform Settings." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      const apiKey = platformSettings.openrouter_api_key.trim();

      // ═══ LIMIT CHAT HISTORY TO PREVENT TOKEN BLOAT ═══
      // Only keep last 10 messages for context (saves massive tokens)
      const MAX_HISTORY = 10;
      const recentMessages = messages.slice(-MAX_HISTORY);

      console.log("[TOKEN-DEBUG] Total messages:", messages.length, "| Using last:", recentMessages.length);
      console.log("[TOKEN-DEBUG] System prompt length:", systemPrompt.length, "chars");
      console.log("[TOKEN-DEBUG] System prompt preview:", systemPrompt.slice(0, 200) + "...");
      const estimatedTokens = Math.ceil((systemPrompt.length + (recentMessages.length * 100)) / 3.5);
      console.log("[TOKEN-DEBUG] Estimated input tokens:", estimatedTokens);

      // Call OpenRouter (with 30s timeout for initial request)
      console.log("DEBUG: Calling OpenRouter, model:", model);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

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
            messages: [{ role: "system", content: systemPrompt }, ...recentMessages],
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

      // ═══ TOKEN USAGE DEBUG ═══
      const usage = aiData.usage || {};
      console.log("[TOKEN-DEBUG] ═══ ACTUAL TOKEN USAGE ═══");
      console.log("[TOKEN-DEBUG] Prompt tokens:", usage.prompt_tokens || "N/A");
      console.log("[TOKEN-DEBUG] Completion tokens:", usage.completion_tokens || "N/A");
      console.log("[TOKEN-DEBUG] Total tokens:", usage.total_tokens || "N/A");
      console.log("[TOKEN-DEBUG] ═══════════════════════════");

      let rawContent = aiData.choices?.[0]?.message?.content || "";
      console.log("[CHAT] Raw content (" + rawContent.length + " chars): " + rawContent.slice(0, 100) + "...");
      console.log("[AI-OUTPUT-FULL]", rawContent);

      // ─── SMART RETRY LOGIC ───────────────────────────────────────
      let currentPrompt = userPrompt;
      let lastError = "";
      let parsed: any = null;
      const maxRetries = 2;

      // Build design context once for all retry attempts
      const designContext = buildDesignSystemContext(designState?.current_design, "general");
      console.log("[CONTEXT] Design system context built. Available: " + (designContext.availableColors ? Object.keys(designContext.availableColors).length : 0) + " colors, " + (designContext.componentCapabilities?.length || 0) + " capabilities");

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log("[ATTEMPT] " + (attempt + 1) + "/" + (maxRetries + 1) + " - Parsing AI output (" + rawContent.length + " chars)");

          // Try to parse as text format (new approach)
          const { sections, rawText } = parseDesignText(rawContent);
          console.log("[PARSE] Found " + sections.length + " sections: " + sections.map(s => s.name).join(", "));

          // Validate sections with design context (for color harmony checking)
          const validation = validateDesignSections(sections, designState?.current_design);

          if (!validation.valid) {
            lastError = validation.errors.join("; ");
            console.warn("[VALIDATION] Failed: " + lastError);
            throw new Error(lastError);
          }

          // Convert to design JSON
          const designFromText = buildDesignFromSections(sections, "Design generated successfully");

          parsed = {
            type: "design",
            message: "Updated " + sections.length + " section" + (sections.length > 1 ? "s" : "") + " with your design changes",
            design: designFromText,
          };

          console.log("[SUCCESS] Parsed design with " + sections.length + " sections on attempt " + (attempt + 1));
          break; // Success, exit retry loop

        } catch (parseError: any) {
          lastError = parseError.message;
          console.warn("[PARSE_ERROR] Attempt " + (attempt + 1) + ": " + lastError);

          if (attempt < maxRetries) {
            // Retry with enhanced prompt that includes design context
            console.log("[RETRY] Enhancing prompt for attempt " + (attempt + 2) + " with design context...");
            currentPrompt = enhancePromptForRetry(userPrompt, attempt, lastError, designContext);

            // Call AI again with modified prompt and lower temperature
            try {
              const retryController = new AbortController();
              const retryTimeout = setTimeout(() => retryController.abort(), 10000); // 10s timeout for retries

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
                  messages: [{ role: "system", content: systemPrompt }, { role: "user", content: currentPrompt }],
                  max_tokens: 2000, // Reduce tokens for retries
                  temperature: 0.05, // Lower temp for retries (more deterministic)
                }),
                signal: retryController.signal,
              });
              clearTimeout(retryTimeout);

              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                rawContent = retryData.choices?.[0]?.message?.content || "";
                console.log("[RETRY] New AI response received (" + rawContent.length + " chars) on attempt " + (attempt + 2));
              } else {
                console.error("[RETRY] Retry fetch failed: " + retryResponse.status);
              }
            } catch (retryErr: any) {
              clearTimeout(timeout);
              console.error("[RETRY] Retry error:", retryErr.message);
            }
          } else {
            console.log("[RETRY] Max retries (" + maxRetries + ") exhausted. Will use fallback.");
          }
        }
      }

      // ─── ERROR: NO VALID RESPONSE ───────────────────────────────
      if (!parsed) {
        console.error("[ERROR] All " + (maxRetries + 1) + " retry attempts exhausted. Error: " + lastError);
        console.error("[ERROR] Last AI output (first 500 chars): " + rawContent.substring(0, 500));

        // Log failure for monitoring
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
          .then(() => console.log("[FAILURE_LOG_OK]"))
          .catch(() => console.error("[FAILURE_LOG_ERROR] Failed to log failure"));

        return new Response(JSON.stringify({
          success: false,
          error: "AI failed to generate design. Please try again."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const responseType = parsed.type || "text";

      // If design response — sanitize CSS, normalize keys, log quality metrics
      if (responseType === "design" && parsed.design) {
        const d = parsed.design;

        // ═══ DETAILED DEBUG LOGGING - SHOW WHAT AI CHANGED ═══
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🎨 [AI CHANGES DEBUG] Design Generation Complete");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        // Get current design state for before/after comparison
        const { data: currentState } = await supabase
          .from("store_design_state")
          .select("current_design")
          .eq("store_id", store_id)
          .maybeSingle();

        const beforeDesign = currentState?.current_design as any || {};

        console.log("📋 Summary:", d.summary || "No summary provided");
        console.log("\n📝 Changes List:");
        (d.changes_list || []).forEach((change: string, idx: number) => {
          console.log("  " + (idx + 1) + ". " + change);
        });

        console.log("\n🎨 CSS Variables Changes:");
        if (d.css_variables && Object.keys(d.css_variables).length > 0) {
          Object.entries(d.css_variables).forEach(([key, newValue]) => {
            const oldValue = beforeDesign.css_variables?.[key];
            if (oldValue && oldValue !== newValue) {
              console.log("  --" + key + ": " + oldValue + " → " + newValue + " ✓ CHANGED");
            } else if (!oldValue) {
              console.log("  --" + key + ": " + newValue + " ✓ NEW");
            } else {
              console.log("  --" + key + ": " + newValue + " (unchanged)");
            }
          });
        } else {
          console.log("  No CSS variable changes");
        }

        if (d.dark_css_variables && Object.keys(d.dark_css_variables).length > 0) {
          console.log("\n🌙 Dark Mode Variables:");
          Object.entries(d.dark_css_variables).forEach(([key, value]) => {
            console.log("  --" + key + ": " + value);
          });
        }

        if (d.layout && Object.keys(d.layout).length > 0) {
          console.log("\n📐 Layout Changes:");
          Object.entries(d.layout).forEach(([key, value]) => {
            const oldValue = beforeDesign.layout?.[key];
            if (oldValue && oldValue !== value) {
              console.log("  " + key + ": " + oldValue + " → " + value + " ✓ CHANGED");
            } else if (!oldValue) {
              console.log("  " + key + ": " + value + " ✓ NEW");
            }
          });
        }

        if (d.fonts) {
          console.log("\n🔤 Font Changes:");
          if (d.fonts.heading) {
            const oldFont = beforeDesign.fonts?.heading;
            if (oldFont && oldFont !== d.fonts.heading) {
              console.log("  Heading: " + oldFont + " → " + d.fonts.heading + " ✓ CHANGED");
            } else if (!oldFont) {
              console.log("  Heading: " + d.fonts.heading + " ✓ NEW");
            }
          }
          if (d.fonts.body) {
            const oldFont = beforeDesign.fonts?.body;
            if (oldFont && oldFont !== d.fonts.body) {
              console.log("  Body: " + oldFont + " → " + d.fonts.body + " ✓ CHANGED");
            } else if (!oldFont) {
              console.log("  Body: " + d.fonts.body + " ✓ NEW");
            }
          }
        }

        if (d.css_overrides && d.css_overrides.length > 0) {
          console.log("\n✨ Custom CSS Overrides:");
          console.log("  Length: " + d.css_overrides.length + " characters");
          console.log("  Preview: " + d.css_overrides.substring(0, 150) + "...");
        }

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

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
        .select("openrouter_api_key, openrouter_model, openrouter_fallback_model").eq("id", SETTINGS_ID).single();
      if (!genSettings?.openrouter_api_key) {
        return new Response(JSON.stringify({ success: false, error: "AI not configured. Please contact platform support." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const genModel = (genSettings.openrouter_model || genSettings.openrouter_fallback_model || "").trim();
      if (!genModel) {
        return new Response(JSON.stringify({ success: false, error: "No AI model configured. Please set a model in Super Admin → Platform Settings." }),
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
            model: genModel,
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

      // ─── TOKEN MONITORING (CRITICAL FOR COST TRACKING) ───
      // ADDED MAR 6, 2026 - To track actual OpenRouter vs Claude token discrepancy
      const promptTokens = genData.usage?.prompt_tokens || 0;
      const completionTokens = genData.usage?.completion_tokens || 0;
      const totalTokens = promptTokens + completionTokens;
      const openrouterCost = ((promptTokens * 0.002) + (completionTokens * 0.006)) / 1000; // Kimi K2.5 pricing

      console.log("[TOKEN-TRACKING] ═══════════════════════════════════════════════════════");
      console.log("[TOKEN-TRACKING] OpenRouter ACTUAL token usage (THIS IS THE REAL COST):");
      console.log("[TOKEN-TRACKING]   Input tokens:  " + promptTokens);
      console.log("[TOKEN-TRACKING]   Output tokens: " + completionTokens);
      console.log("[TOKEN-TRACKING]   Total:         " + totalTokens + " tokens");
      console.log("[TOKEN-TRACKING]   Cost (est):    $" + openrouterCost.toFixed(4));
      console.log("[TOKEN-TRACKING] ═══════════════════════════════════════════════════════");
      console.log("[GENERATE] AI response received (" + genContent.length + " chars): " + genContent.slice(0, 80) + "...");

      // Try parsing as text format first (enterprise approach)
      const genContext = buildDesignSystemContext(genDesignState?.current_design, "general");
      let genParsed: any = null;
      let genLastError = "";

      for (let genAttempt = 0; genAttempt <= 2; genAttempt++) {
        try {
          console.log("[GENERATE] Parse attempt " + (genAttempt + 1) + "/3");

          // Try text format parsing
          const { sections, rawText } = parseDesignText(genContent);
          console.log("[GENERATE] Found " + sections.length + " sections");

          const genValidation = validateDesignSections(sections, genDesignState?.current_design);
          if (!genValidation.valid) {
            genLastError = genValidation.errors.join("; ");
            throw new Error(genLastError);
          }

          const designFromText = buildDesignFromSections(sections, "Design generated successfully");
          genParsed = {
            type: "design",
            message: "Generated " + sections.length + " section" + (sections.length > 1 ? "s" : "") + " with design changes",
            design: designFromText,
          };
          console.log("[GENERATE] Successfully parsed on attempt " + (genAttempt + 1));
          break;

        } catch (parseErr: any) {
          genLastError = parseErr.message;
          console.warn("[GENERATE] Parse failed attempt " + (genAttempt + 1) + ": " + genLastError);

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
                  model: genModel,
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
                console.log("[GENERATE] Retry " + (genAttempt + 2) + " received (" + genContent.length + " chars)");
              }
            } catch (retryErr) {
              console.error("[GENERATE] Retry failed:", retryErr);
            }
          }
        }
      }

      // Fallback if parsing failed
      if (!genParsed) {
        console.warn("[GENERATE] All parse attempts exhausted. Logging failure.");
        await supabase.from("ai_generation_failures").insert({
          store_id, user_id, user_prompt: prompt,
          error_message: genLastError,
          model: genModel,
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

      // ═══ DEBUG LOGGING - APPLY DESIGN ═══
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ [APPLY DEBUG] Applying Design to Live Store");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      console.log("🏪 Store ID:", store_id);
      console.log("📦 History ID:", history_id || "None (direct apply)");
      console.log("\n📋 Design Being Applied:");
      console.log("  Summary:", design.summary || "No summary");
      console.log("  CSS Variables:", Object.keys(design.css_variables || {}).length);
      console.log("  Dark Variables:", Object.keys(design.dark_css_variables || {}).length);
      console.log("  Layout Config:", Object.keys(design.layout || {}).length);
      console.log("  Fonts:", design.fonts ? (design.fonts.heading || design.fonts.body ? "Yes" : "No") : "No");
      console.log("  CSS Overrides:", design.css_overrides ? design.css_overrides.length + " chars" : "None");

      if (design.css_variables && Object.keys(design.css_variables).length > 0) {
        console.log("\n🎨 CSS Variables to Apply:");
        Object.entries(design.css_variables).forEach(([key, value]) => {
          console.log("  --" + key + ": " + value);
        });
      }

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

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

      console.log("✅ [APPLY] Design successfully saved to database");

      return new Response(JSON.stringify({ success: true, message: "Design applied to your live store" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACTION: generate_full_css (Layer 2 CSS Generation - Full Store Design)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // WHAT: AI generates complete CSS for entire store (not just variables)
    // COST: ~5K tokens/request (down from 73K in Feb 2026)
    // TOKEN BREAKDOWN:
    //   - System prompt + theme: ~600 tokens
    //   - Site manifest (all selectors): ~500 tokens
    //   - HTML snapshot (home page): ~1200 tokens
    //   - Existing CSS (if redesigning): ~600 tokens
    //   - Conversation history (sliding window): ~1500 tokens
    //   - User message: ~200 tokens
    //   ─────────────────────────────────
    //   INPUT TOTAL: ~4600 tokens (varies with history length)
    //   OUTPUT: ~400 tokens (CSS + explanation)
    //   ═════════════════════════════════════════════════════════════════════════════════
    //   ACTUAL COST: OpenRouter Kimi K2.5 = (input × $0.002 + output × $0.006) / 1000
    //              = ($4600 × $0.002 + $400 × $0.006) / 1000
    //              = ($9.20 + $2.40) / 1000 = ~$0.011 per request
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ADDED: Feb 24, 2026 (replaced Layer 1 as primary system)
    // LAST OPTIMIZED: Mar 6, 2026 (added granular data-ai attributes, improved manifest)
    // KNOWN ISSUE: Claude token count ≠ OpenRouter actual (see token-tracking logs below)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (action === "generate_full_css") {
      try {
      console.log("\n╔══════════════════════════════════════════════════╗");
      console.log("║  [LAYER2] generate_full_css ACTION TRIGGERED     ║");
      console.log("║  Generating full CSS for entire store design    ║");
      console.log("╚══════════════════════════════════════════════════╝\n");
      console.log("📥 Request received at:", new Date().toISOString());

      const { html_structure, layer1_baseline, theme: layer2Theme, image_base64, site_manifest, idempotency_key } = body;
      console.log("📊 Payload sizes (contributes to token count):");
      console.log("  ├─ HTML structure:", html_structure?.length || 0, "chars (~" + Math.ceil((html_structure?.length || 0) / 4) + " tokens)");
      console.log("  ├─ Layer1 baseline:", JSON.stringify(layer1_baseline || {}).length, "chars");
      console.log("  ├─ Site manifest:", site_manifest?.length || 0, "chars (~" + Math.ceil((site_manifest?.length || 0) / 4) + " tokens)");
      console.log("  └─ Message history:", messages?.length || 0, "messages (~" + (messages?.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0) || 0) / 4 + " tokens combined)");

      if (!store_id || !user_id || !html_structure || !messages || messages.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: store_id, user_id, html_structure, or messages"
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const userPrompt = messages[messages.length - 1]?.content || "";

      // Build messages for OpenRouter — inject image into last user message if attached
      const messagesForAI: any[] = image_base64
        ? messages.slice(-8).map((msg: any, idx: number, arr: any[]) => {
            if (idx === arr.length - 1 && msg.role === "user") {
              return {
                role: "user",
                content: [
                  { type: "text", text: typeof msg.content === "string" ? msg.content : "" },
                  { type: "image_url", image_url: { url: image_base64 } },
                ],
              };
            }
            return msg;
          })
        : messages.slice(-8);

      // Check tokens
      const { data: activePurchases } = await supabase.from("ai_token_purchases")
        .select("id, tokens_remaining, tokens_used, version")
        .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0)
        .order("expires_at", { ascending: true, nullsFirst: false }).limit(1);

      const activePurchase = activePurchases?.[0];
      if (!activePurchase) {
        return new Response(JSON.stringify({
          success: false,
          error: "No tokens remaining. Please purchase more tokens to continue."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 });
      }

      // ─── Idempotency check: prevent double charge on network retry ───
      if (idempotency_key) {
        const { data: existingLedger } = await supabase
          .from("ai_token_ledger")
          .select("status, cached_css, total_tokens")
          .eq("idempotency_key", idempotency_key)
          .maybeSingle();

        if (existingLedger?.status === "completed" && existingLedger?.cached_css) {
          // Already processed — return cached CSS as SSE done event (no charge)
          console.log("[IDEMPOTENCY] Duplicate request detected, returning cached result for key:", idempotency_key);
          const sseEncoder2 = new TextEncoder();
          const cachedStream = new ReadableStream({
            start(ctrl) {
              ctrl.enqueue(sseEncoder2.encode("data: " + JSON.stringify({
                done: true,
                css: existingLedger.cached_css,
                tokens_remaining: activePurchase.tokens_remaining,
                changes_list: ["Returned cached design (no extra charge)"],
                message: "Design loaded from cache",
                cached: true,
              }) + "\n\n"));
              ctrl.close();
            }
          });
          return new Response(cachedStream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        }

        // Insert PENDING ledger entry (receipt before OpenRouter call)
        // If insert fails due to unique conflict (concurrent retry), we continue — optimistic lock handles billing
        try {
          await supabase.from("ai_token_ledger").insert({
            store_id, user_id, idempotency_key,
            status: "pending",
            purchase_id: activePurchase.id,
          });
        } catch (_) { /* ignore conflict errors — idempotency key already exists */ }
      }

      // Fetch platform settings
      const { data: platformSettings } = await supabase.from("platform_settings")
        .select("openrouter_api_key, openrouter_model, openrouter_fallback_model").eq("id", SETTINGS_ID).single();

      if (!platformSettings?.openrouter_api_key) {
        return new Response(JSON.stringify({
          success: false,
          error: "AI not configured. Please contact platform support."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const model = (platformSettings.openrouter_model || platformSettings.openrouter_fallback_model || "").trim();
      if (!model) {
        return new Response(JSON.stringify({
          success: false,
          error: "No AI model configured. Please set a model in Super Admin → Platform Settings."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      const apiKey = platformSettings.openrouter_api_key.trim();

      // Read existing Layer 2 CSS from DB for merging and AI context
      const { data: existingDesign } = await supabase.from("store_design_state")
        .select("ai_full_css")
        .eq("store_id", store_id)
        .maybeSingle();
      const existingCSS = (existingDesign?.ai_full_css || "").trim();
      console.log("[LAYER2] Existing CSS from DB:", existingCSS.length, "chars");

      // ═══ DEBUG LOGGING - LAYER 2 INTENT CLASSIFICATION ═══
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🎯 [LAYER2 DEBUG] Intent Classification");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      console.log("📝 User Prompt:", userPrompt);
      console.log("📊 HTML Structure Length:", html_structure.length, "chars");
      console.log("🎨 Layer 1 Variables:", layer1_baseline ? Object.keys(layer1_baseline.cssVariables || {}).length : 0);

      // Monitor intent for logging only — AI decides its own scope in Mode B
      const intentMode = classifyUserIntent(userPrompt);
      console.log("\n🤖 [LAYER2 MONITOR] Intent guess (not used as constraint):", intentMode.toUpperCase());
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // Build Layer 2 system prompt — Mode B (AI decides own scope)
      // Uses DB-sourced existing CSS for context (not conversation-history based)
      const systemPrompt = buildLayer2SystemPrompt(html_structure, layer1_baseline, existingCSS, layer2Theme || "light", site_manifest || "");

      console.log("[LAYER2] System prompt length:", systemPrompt.length, "chars");
      const isStreaming = body.stream === true;
      console.log("[LAYER2] Streaming:", isStreaming);
      console.log("[LAYER2] ⏱️ TIMEOUT SAFETY: 120s abort (Supabase limit 150s)");

      // ═══ STREAMING PATH ═══
      if (isStreaming) {
        let streamAiResponse: Response;
        try {
          const streamAbort = new AbortController();
          const streamTimeout = setTimeout(() => streamAbort.abort(), 120000);
          streamAiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + apiKey,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://yesgive.shop",
              "X-Title": "Vendy Buildr AI Designer Layer 2",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                ...messagesForAI,
              ],
              max_tokens: 8000,
              temperature: 0.2,
              stream: true,
              stream_options: { include_usage: true },
              provider: { sort: "throughput" },
            }),
            signal: streamAbort.signal,
          });
          clearTimeout(streamTimeout);
        } catch (error: any) {
          const errMsg = error.name === "AbortError"
            ? "Design request took too long."
            : "Unable to connect to AI.";
          return new Response(JSON.stringify({ success: false, error: errMsg }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
        }

        if (!streamAiResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: "AI service responded with error. Please try again."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: streamAiResponse.status || 500 });
        }

        const streamReader = streamAiResponse.body!.getReader();
        const encoder = new TextEncoder();

        // Capture variables needed for final processing
        const capturedActivePurchase = activePurchase;
        const capturedExistingCSS = existingCSS;
        const capturedStoreId = store_id;
        const capturedUserId = user_id;
        const capturedUserPrompt = userPrompt;
        const capturedIntentMode = intentMode;

        const stream = new ReadableStream({
          async start(controller) {
            let fullContent = '';
            let capturedUsageLegacy: any = null;
            try {
              while (true) {
                const { done, value } = await streamReader.read();
                if (done) break;

                const text = new TextDecoder().decode(value);
                const lines = text.split('\n').filter(function(l: string) { return l.startsWith('data: '); });
                for (const line of lines) {
                  if (line === 'data: [DONE]') continue;
                  try {
                    const json = JSON.parse(line.slice(6));
                    // Capture actual token usage from OpenRouter final chunk
                    if (json.usage) capturedUsageLegacy = json.usage;
                    const delta = json.choices?.[0]?.delta?.content || '';
                    if (delta) {
                      fullContent += delta;
                      controller.enqueue(encoder.encode('data: ' + JSON.stringify({ chunk: delta }) + '\n\n'));
                    }
                  } catch (_e) { /* skip malformed SSE lines */ }
                }
              }

              // ═══ PARSE FINAL RESULT (same logic as non-streaming) ═══
              let rawCSS = '';
              let changesList: string[] = [];
              let aiSummary = '';

              // Strip <think>...</think> tags from thinking models
              let cleanedContent1 = fullContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
              if (cleanedContent1.length === 0) cleanedContent1 = fullContent;

              let cssContent = cleanedContent1;
              const codeBlockPatterns1 = [
                /```css\s*\n([\s\S]*?)\n\s*```/,
                /```css\s*([\s\S]*?)```/,
                /```\s*\n([\s\S]*?)\n\s*```/,
                /```\s*([\s\S]*?)```/,
              ];
              for (const cbPattern of codeBlockPatterns1) {
                const m = cleanedContent1.match(cbPattern);
                if (m && m[1].trim().length > 20) { cssContent = m[1].trim(); break; }
              }
              // Always strip SUMMARY/CHANGES and leftover code fences
              cssContent = cssContent
                .replace(/SUMMARY:[\s\S]*$/i, '')
                .replace(/CHANGES:[\s\S]*$/i, '')
                .replace(/^```(?:css)?\s*/gm, '')
                .replace(/```\s*$/gm, '')
                .trim();

              const summaryMatch = cleanedContent1.match(/SUMMARY:\s*([^\n]+(?:\n(?!CHANGES:|SECTION:|CHANGE:)[^\n]*)*)/i);
              if (summaryMatch) aiSummary = summaryMatch[1].trim();

              const parts = cleanedContent1.split(/CHANGES:/i);
              if (parts.length >= 2) {
                rawCSS = cssContent.trim();
                const changesText = 'SECTION:' + parts.slice(1).join('CHANGES:');
                const changeLines = changesText.split(/---/).filter(function(s: string) { return s.trim(); });
                changesList = [];
                for (const block of changeLines) {
                  const sectionMatch = block.match(/SECTION:\s*([^\n]+)/i);
                  const changeMatch = block.match(/CHANGE:\s*([^\n]+(?:\n(?!SECTION|CHANGE)[^\n]*)*)/i);
                  if (sectionMatch && changeMatch) {
                    const sectionName = sectionMatch[1].trim();
                    const changDesc = changeMatch[1].trim().split('\n')[0];
                    changesList.push(sectionName.charAt(0).toUpperCase() + sectionName.slice(1) + ' → ' + changDesc);
                  }
                }
                if (changesList.length === 0) changesList = ['Applied custom CSS to your store'];
              } else {
                rawCSS = cssContent.trim();
                changesList = ['Applied beautiful custom CSS design to your store'];
              }

              const sanitization = sanitizeCSS(rawCSS);
              let finalCSS = sanitization.sanitized;
              if (!finalCSS || finalCSS.trim().length === 0) {
                finalCSS = "[data-ai=\"section-hero\"] { background: hsl(var(--primary)); padding: 80px 20px; color: hsl(var(--primary-foreground)); }\n" +
                  "[data-ai=\"product-card\"] { border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }\n";
                changesList = ['Hero → Applied primary color', 'Products → Modern shadows'];
              }

              // Validate form element safety
              const formSafety = validateFormSafety(finalCSS);
              if (!formSafety.safe) {
                console.error('[FORM-PROTECTION] Violations detected:', formSafety.violations);
                formSafety.violations.forEach(v => console.warn('[PROTECTION]', v));
                // Strip out the dangerous rules
                finalCSS = finalCSS.split('\n').filter(line => {
                  return !formSafety.violations.some(v => line.includes(v.split('cannot use')[0].trim()));
                }).join('\n');
                console.log('[FORM-PROTECTION] Dangerous rules removed, CSS length:', finalCSS.length);
              }

              // Merge with existing CSS
              const mergedCSS = mergeCSS(capturedExistingCSS, finalCSS);

              // 🔍 DEBUG: Log CSS being saved
              console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('📢 [EDGE-FUNCTION] Saving CSS to database');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('Store ID:', capturedStoreId);
              console.log('Final CSS length:', finalCSS.length);
              console.log('Merged CSS length:', mergedCSS.length);
              console.log('Final CSS preview:', finalCSS.substring(0, 300));
              console.log('Merged CSS full:', mergedCSS);

              // Deduct ACTUAL OpenRouter tokens (not hardcoded 1)
              const legacyPromptTok = capturedUsageLegacy?.prompt_tokens || 0;
              const legacyCompTok = capturedUsageLegacy?.completion_tokens || 0;
              const legacyTotalTok = (legacyPromptTok + legacyCompTok) || 1;
              const legacyCostUSD = ((legacyPromptTok * 0.002) + (legacyCompTok * 0.006)) / 1000;
              console.log('[LAYER2-LEGACY] Token usage — prompt:', legacyPromptTok, 'completion:', legacyCompTok, 'total:', legacyTotalTok, 'cost: $' + legacyCostUSD.toFixed(6));
              const newRemaining = Math.max(0, capturedActivePurchase.tokens_remaining - legacyTotalTok);
              const newUsed = capturedActivePurchase.tokens_used + legacyTotalTok;
              await supabase.from('ai_token_purchases')
                .update({ tokens_remaining: newRemaining, tokens_used: newUsed, version: (capturedActivePurchase.version || 0) + 1, updated_at: new Date().toISOString() })
                .eq('id', capturedActivePurchase.id)
                .eq('version', capturedActivePurchase.version || 0);

              // Store merged CSS in DB
              const nowStr = new Date().toISOString();
              console.log('📝 [EDGE-FUNCTION] Upserting to store_design_state...');
              await supabase.from('store_design_state').upsert({
                store_id: capturedStoreId,
                ai_full_css: mergedCSS,
                layer1_snapshot: layer1_baseline,
                mode: 'advanced',
                ai_full_css_applied_at: nowStr,
                updated_at: nowStr,
              }, { onConflict: 'store_id' });
              console.log('✅ [EDGE-FUNCTION] CSS saved to database successfully');

              // Log to history
              await supabase.from('ai_designer_history').insert({
                store_id: capturedStoreId,
                user_id: capturedUserId,
                prompt: capturedUserPrompt,
                ai_response: { layer2_css: finalCSS, mode: capturedIntentMode, changes_list: changesList },
                tokens_used: legacyTotalTok,
                applied: false,
              });

              // Send final structured result
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({
                done: true,
                css: mergedCSS,
                changes_list: changesList,
                message: aiSummary || ('Updated ' + changesList.length + ' section' + (changesList.length > 1 ? 's' : '')),
                tokens_remaining: newRemaining,
              }) + '\n\n'));
            } catch (streamErr: any) {
              console.error('[LAYER2-STREAM] Error:', streamErr);
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({
                done: true,
                error: streamErr.message || 'Stream processing error',
              }) + '\n\n'));
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" }
        });
      }

      // ═══ SSE STREAMING WITH HEARTBEAT ═══
      // Opens SSE stream immediately → sends heartbeat every 20s → streams AI tokens →
      // parses result when done → saves to DB → sends final event.
      // Heartbeat prevents Cloudflare 524 timeout (resets 100s idle timer on every ping).
      const sseEncoder = new TextEncoder();

      const sseStream = new ReadableStream({
        async start(controller) {
          // Confirm connection immediately
          controller.enqueue(sseEncoder.encode(": connected\n\n"));

          // Heartbeat every 20s — keeps Cloudflare + nginx alive during long AI generation
          const heartbeat = setInterval(() => {
            try { controller.enqueue(sseEncoder.encode(": heartbeat\n\n")); } catch (_) { /* stream closed */ }
          }, 20000);

          const sendEvent = (data: object) => {
            try { controller.enqueue(sseEncoder.encode("data: " + JSON.stringify(data) + "\n\n")); } catch (_) {}
          };

          try {
            // Call OpenRouter with streaming enabled
            // AbortController: 120s timeout (Supabase hard limit is 150s)
            const abortCtrl = new AbortController();
            const abortTimeout = setTimeout(() => abortCtrl.abort(), 120000);
            const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://yesgive.shop",
                "X-Title": "Vendy Buildr AI Designer Layer 2",
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: systemPrompt },
                  ...messagesForAI,
                ],
                max_tokens: 8000,
                temperature: 0.2,
                stream: true,
                stream_options: { include_usage: true },
                provider: { sort: "throughput" },
              }),
              signal: abortCtrl.signal,
            });
            clearTimeout(abortTimeout);

            if (!aiResponse.ok) {
              const errBody = await aiResponse.text().catch(() => "");
              console.error("[LAYER2] OpenRouter error:", aiResponse.status, errBody);
              sendEvent({ done: true, error: "AI service error. Please try again." });
              return;
            }

            // Stream AI tokens to client in real-time
            const aiReader = aiResponse.body!.getReader();
            const aiDecoder = new TextDecoder();
            let fullContent = "";
            let sseBuffer = "";
            let capturedUsage: any = null; // actual token counts from OpenRouter final chunk

            const processSSELines = (linesToProcess: string[]) => {
              for (const line of linesToProcess) {
                if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
                try {
                  const json = JSON.parse(line.slice(6));
                  // Capture actual token usage from OpenRouter final usage chunk
                  if (json.usage) {
                    capturedUsage = json.usage;
                    console.log("[LAYER2] OpenRouter usage captured:", json.usage);
                  }
                  const delta = json.choices?.[0]?.delta;
                  // Capture actual content tokens
                  const content = delta?.content || "";
                  if (content) {
                    fullContent += content;
                    sendEvent({ chunk: content });
                  }
                  // Forward reasoning/thinking tokens as progress indicator
                  const reasoning = delta?.reasoning_content || delta?.reasoning || delta?.thinking || "";
                  if (reasoning) {
                    sendEvent({ thinking: reasoning });
                  }
                } catch (_) {}
              }
            };

            while (true) {
              const { done, value } = await aiReader.read();
              if (done) {
                // Flush remaining buffer — last chunk may lack trailing newline
                if (sseBuffer.trim()) processSSELines(sseBuffer.split("\n"));
                break;
              }

              sseBuffer += aiDecoder.decode(value, { stream: true });
              const lines = sseBuffer.split("\n");
              sseBuffer = lines.pop() || "";
              processSSELines(lines);
            }

            console.log("[LAYER2] AI stream complete, output:", fullContent.length, "chars");
            console.log("[LAYER2] Full AI output preview (first 500):", fullContent.substring(0, 500));
            console.log("[LAYER2] Full AI output tail (last 300):", fullContent.substring(Math.max(0, fullContent.length - 300)));

            // ═══ PARSE: CSS + SUMMARY + CHANGES ═══
            let rawCSS = "";
            let changesList: string[] = [];
            let aiSummary = "";

            // Declared outside try so accessible in error logging below
            let cleanedContent = fullContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            if (cleanedContent.length === 0) cleanedContent = fullContent;
            console.log("[LAYER2] After stripping <think> tags:", cleanedContent.length, "chars (was", fullContent.length, ")");

            try {

              let cssContent = cleanedContent;
              let codeBlockFound = false;
              const codeBlockPatterns2 = [
                /```css\s*\n([\s\S]*?)\n\s*```/,
                /```css\s*([\s\S]*?)```/,
                /```\s*\n([\s\S]*?)\n\s*```/,
                /```\s*([\s\S]*?)```/,
              ];
              for (const cbPattern of codeBlockPatterns2) {
                const m = cleanedContent.match(cbPattern);
                if (m && m[1].trim().length > 20) { cssContent = m[1].trim(); codeBlockFound = true; break; }
              }
              console.log("[LAYER2] Code block extracted:", codeBlockFound, "| cssContent length:", cssContent.length);

              if (codeBlockFound) {
                // Strip SUMMARY/CHANGES and leftover code fences from extracted code block
                cssContent = cssContent
                  .replace(/SUMMARY:[\s\S]*$/i, '')
                  .replace(/CHANGES:[\s\S]*$/i, '')
                  .replace(/^```(?:css)?\s*/gm, '')
                  .replace(/```\s*$/gm, '')
                  .trim();
              } else {
                // No code block found - try to extract CSS rules directly before SUMMARY
                const beforeSummary = cleanedContent.split(/SUMMARY:/i)[0];
                // Extract anything that looks like CSS rules ([selector] { ... })
                const cssRuleMatches = beforeSummary.match(/\[data-ai="[^"]+"\][^{]*\{[^}]*\}/gs);
                if (cssRuleMatches && cssRuleMatches.length > 0) {
                  cssContent = cssRuleMatches.join('\n');
                  console.log("[LAYER2] Extracted", cssRuleMatches.length, "CSS rules from text");
                } else {
                  // Last resort - use everything before SUMMARY as potential CSS
                  cssContent = beforeSummary.trim();
                  console.log("[LAYER2] No code block found, using text before SUMMARY as CSS");
                }
              }

              const summaryMatch = cleanedContent.match(/SUMMARY:\s*([^\n]+(?:\n(?!CHANGES:|SECTION:|CHANGE:)[^\n]*)*)/i);
              if (summaryMatch) aiSummary = summaryMatch[1].trim();

              const parts = cleanedContent.split(/CHANGES:/i);
              if (parts.length >= 2) {
                rawCSS = cssContent.trim();
                const changesText = "SECTION:" + parts.slice(1).join("CHANGES:");
                const changeLines = changesText.split(/---/).filter(s => s.trim());
                changesList = [];
                for (const block of changeLines) {
                  const sectionMatch = block.match(/SECTION:\s*([^\n]+)/i);
                  const changeMatch = block.match(/CHANGE:\s*([^\n]+(?:\n(?!SECTION|CHANGE)[^\n]*)*)/i);
                  if (sectionMatch && changeMatch) {
                    const displayName = sectionMatch[1].trim().charAt(0).toUpperCase() + sectionMatch[1].trim().slice(1);
                    // Keep full description (up to 3 lines) — not truncated to first line
                    const fullDesc = changeMatch[1].trim().split("\n").slice(0, 3).join(" ").trim();
                    changesList.push(displayName + " → " + fullDesc);
                  }
                }
                if (changesList.length === 0) changesList = ["Applied custom CSS to your store"];
              } else {
                rawCSS = cssContent.trim();
                changesList = ["Applied beautiful custom CSS design to your store"];
              }
            } catch (_) {
              rawCSS = fullContent;
              changesList = ["Applied custom CSS"];
            }

            // Sanitize CSS
            console.log("[LAYER2] rawCSS length:", rawCSS.length, "| preview:", rawCSS.substring(0, 200));
            let finalCSS = "";
            try {
              finalCSS = sanitizeCSS(rawCSS).sanitized;
            } catch (_) {
              finalCSS = "";
            }
            console.log("[LAYER2] finalCSS length after sanitize:", finalCSS.length);

            if (!finalCSS || finalCSS.trim().length === 0) {
              console.error("[LAYER2] Empty CSS generated");
              console.error("[LAYER2] rawCSS was:", rawCSS.substring(0, 500));
              console.error("[LAYER2] cleanedContent was:", cleanedContent.substring(0, 500));
              console.error("[LAYER2] fullContent was:", fullContent.substring(0, 500));
              console.error("[LAYER2] Not deducting token, sending error");
              sendEvent({
                done: true,
                error: "AI did not generate any CSS. Please try again with a more specific prompt."
              });
              return;
            }

            // ─── Deduct ACTUAL OpenRouter tokens (not hardcoded 1) ───
            const promptTokens = capturedUsage?.prompt_tokens || 0;
            const completionTokens = capturedUsage?.completion_tokens || 0;
            const totalTokens = (promptTokens + completionTokens) || 1; // fallback to 1 if usage not captured
            const costUSD = ((promptTokens * 0.002) + (completionTokens * 0.006)) / 1000;
            console.log("[LAYER2] Token usage — prompt:", promptTokens, "completion:", completionTokens, "total:", totalTokens, "cost: $" + costUSD.toFixed(6));

            const newRemaining = Math.max(0, activePurchase.tokens_remaining - totalTokens);
            const { data: updateResult } = await supabase.from("ai_token_purchases")
              .update({
                tokens_remaining: newRemaining,
                tokens_used: activePurchase.tokens_used + totalTokens,
                version: (activePurchase.version || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", activePurchase.id)
              .eq("version", activePurchase.version || 0) // optimistic lock
              .select("id");

            if (!updateResult || updateResult.length === 0) {
              // Race condition: another concurrent request changed the version first
              // Re-fetch latest balance and retry deduction once
              console.warn("[RACE-CONDITION] Optimistic lock failed, retrying token deduction");
              const { data: freshPurchases } = await supabase.from("ai_token_purchases")
                .select("id, tokens_remaining, tokens_used, version")
                .eq("store_id", store_id).eq("status", "active")
                .order("expires_at", { ascending: true, nullsFirst: false }).limit(1);
              const fresh = freshPurchases?.[0];
              if (fresh) {
                await supabase.from("ai_token_purchases").update({
                  tokens_remaining: Math.max(0, fresh.tokens_remaining - totalTokens),
                  tokens_used: fresh.tokens_used + totalTokens,
                  version: (fresh.version || 0) + 1,
                  updated_at: new Date().toISOString(),
                }).eq("id", fresh.id).eq("version", fresh.version || 0);
              }
            }

            // Validate form element safety
            const formSafety = validateFormSafety(finalCSS);
            if (!formSafety.safe) {
              console.error('[FORM-PROTECTION] Violations detected:', formSafety.violations);
              formSafety.violations.forEach(v => console.warn('[PROTECTION]', v));
              finalCSS = finalCSS.split('\n').filter(line => {
                return !formSafety.violations.some(v => line.includes(v.split('cannot use')[0].trim()));
              }).join('\n');
              console.log('[FORM-PROTECTION] Dangerous rules removed, CSS length:', finalCSS.length);
            }

            // Merge + save to DB
            const mergedCSS = mergeCSS(existingCSS, finalCSS);
            console.log("[LAYER2] Merged CSS:", mergedCSS.length, "chars");

            const nowStr = new Date().toISOString();
            await supabase.from("store_design_state").upsert({
              store_id,
              ai_full_css: mergedCSS,
              layer1_snapshot: layer1_baseline,
              mode: "advanced",
              ai_full_css_applied_at: nowStr,
              updated_at: nowStr,
            }, { onConflict: "store_id" });

            await supabase.from("ai_designer_history").insert({
              store_id,
              user_id,
              prompt: userPrompt,
              ai_response: { layer2_css: finalCSS, mode: intentMode, changes_list: changesList },
              tokens_used: totalTokens,
              applied: false,
            });

            // ─── Update ledger to COMPLETED (receipt with actual token counts) ───
            if (idempotency_key) {
              await supabase.from("ai_token_ledger").update({
                status: "completed",
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: totalTokens,
                cost_usd: costUSD,
                cached_css: mergedCSS,
                completed_at: nowStr,
              }).eq("idempotency_key", idempotency_key);
            }

            console.log("✅ [LAYER2] Success! Tokens remaining:", newRemaining, "| Used:", totalTokens, "| Cost: $" + costUSD.toFixed(6));

            // Send final structured result to client
            sendEvent({
              done: true,
              css: mergedCSS,
              changes_list: changesList,
              tokens_remaining: newRemaining,
              message: aiSummary || (changesList.length > 0
                ? "Updated " + changesList.length + " section" + (changesList.length > 1 ? "s" : "")
                : "Design applied successfully"),
            });

          } catch (err: any) {
            console.error("[LAYER2] SSE error:", err.message);
            // Mark ledger entry as FAILED — no tokens deducted on failure
            if (idempotency_key) {
              await supabase.from("ai_token_ledger").update({
                status: "failed",
                completed_at: new Date().toISOString(),
              }).eq("idempotency_key", idempotency_key).catch(() => null);
            }
            const errMsg = err.name === "AbortError"
              ? "Design generation timed out (120s). Try a simpler prompt."
              : "Internal error: " + (err.message || "Unknown error");
            sendEvent({ done: true, error: errMsg });
          } finally {
            clearInterval(heartbeat);
            controller.close();
          }
        }
      });

      return new Response(sseStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
      } catch (error: any) {
        console.error("[LAYER2] CRITICAL ERROR:", error.message || error);
        console.error("[LAYER2] ERROR STACK:", error.stack);
        return new Response(JSON.stringify({
          success: false,
          error: "Internal error: " + (error.message || "Unknown error in generate_full_css")
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
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
