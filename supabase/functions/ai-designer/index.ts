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
      console.log("[PARSER] Block " + blockIdx + ": " + section.name + " → " + section.change.slice(0, 50) + "...");
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
    // First try exact match, then fallback to includes
    let sectionName = sectionToVarMap[section.name.toLowerCase()] ? section.name.toLowerCase() : null;
    if (!sectionName) {
      sectionName = Object.keys(sectionToVarMap).find(key =>
        section.name.toLowerCase().includes(key)
      ) || 'section-hero';
    }

    // Add to changes list
    changesList.push((sectionName.charAt(0).toUpperCase() + sectionName.slice(1)) + " → " + section.change);

    // If color provided, apply it to the main variable for this section
    if (section.color) {
      const vars = sectionToVarMap[sectionName] || ['primary'];
      const mainVar = vars[0]; // Apply to first variable in the section

      // Validate CSS value before assigning
      if (isValidCSSValue(mainVar, section.color)) {
        cssVariables[mainVar] = section.color;
        console.log("[MAP] Section \"" + sectionName + "\" → variable \"--" + mainVar + "\" = " + section.color);
      } else {
        console.log("[VALIDATION] Rejected incomplete value for \"--" + mainVar + "\": \"" + section.color + "\" (keeping default: \"" + realVarDefaults[mainVar] + "\")");
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
  // Current CSS variables (compact)
  const currentVars = currentDesign?.css_variables || { primary: "217 91% 60%", background: "210 40% 98%", card: "0 0% 100%" };
  const varsText = Object.entries(currentVars).map(([k, v]) => k + "=" + v).join(", ");

  return "CSS-only design AI. Output PLAIN TEXT in SECTION/CHANGE/COLOR format.\n\n" +
    "FORMAT (output 3-5 sections):\n" +
    "SECTION: section-hero\n" +
    "CHANGE: Purple gradient hero section\n" +
    "COLOR: 280 95% 60%\n" +
    "---\n\n" +
    "AVAILABLE SECTIONS (use EXACT names):\n" +
    "- section-hero (hero banner)\n" +
    "- section-categories (category grid)\n" +
    "- section-featured (featured products)\n" +
    "- product-card (individual product cards)\n" +
    "- category-card (individual category cards)\n" +
    "- section-reviews (customer reviews)\n" +
    "- section-new-arrivals (new products)\n" +
    "- section-cta (call-to-action)\n" +
    "- section-footer (footer)\n\n" +
    "IMPORTANT: Use these EXACT section names (e.g., 'section-hero' not 'hero', 'product-card' not 'products')\n\n" +
    "AVAILABLE COLORS: 217 91% 60% (blue), 142 71% 45% (green), 38 92% 50% (orange), 0 84% 60% (red), 45 93% 47% (gold), 280 100% 60% (purple), 190 100% 50% (cyan)\n\n" +
    "CURRENT STATE: " + varsText + "\n\n" +
    "CAPABILITIES (CSS only, NO JavaScript):\n" +
    "✅ Colors, gradients, shadows, border-radius, glass effects\n" +
    "❌ NO scroll animations, NO parallax, NO particles, NO morphing\n\n" +
    "RULES:\n" +
    "1. Output 3-5 sections using EXACT section names from the list above\n" +
    "2. HSL format: \"280 95% 60%\" (3 values required)\n" +
    "3. Describe ONLY what CSS can do (colors, shadows, gradients, glass, rounded corners)\n" +
    "4. NO mentions of: scroll effects, parallax, animations, particles, morphing, floating, transitions\n" +
    "5. Be realistic - you're changing CSS variables, not adding interactive features\n" +
    "6. Plain text only - no JSON, no markdown, no code blocks";
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

// ─── Layer 2 System Prompt (Full CSS Generation) ─────────────
function buildLayer2SystemPrompt(htmlStructure: string, layer1Baseline: any, userPrompt: string, mode: "targeted" | "complete"): string {
  // Extract key info from Layer 1
  const cssVars = layer1Baseline.cssVariables || {};
  const varsText = Object.entries(cssVars)
    .slice(0, 10)
    .map(([k, v]) => "--" + k + ": " + v)
    .join("; ");

  const computedStyles = layer1Baseline.computedStyles || {};
  const stylesText = Object.entries(computedStyles)
    .slice(0, 5)
    .map(([name, style]: [string, any]) => {
      const radius = style.styles?.["border-radius"] || "none";
      const bg = style.styles?.["background-color"] || "transparent";
      return name + " (radius: " + radius + ", bg: " + bg + ")";
    })
    .join(", ");

  const isTargeted = mode === "targeted";

  console.log("[LAYER2] Mode detected:", mode, "for prompt:", userPrompt.slice(0, 50));

  const baseInstructions = "You are a CSS expert that generates CSS to modify websites.\n\n" +
    "HTML STRUCTURE:\n" + htmlStructure.slice(0, 2000) + "\n\n" +
    "CURRENT STYLES (Layer 1 - Baseline):\n" +
    "CSS Variables: " + varsText + "\n" +
    "Elements: " + stylesText + "\n\n" +
    "USER REQUEST: " + userPrompt + "\n\n";

  const capabilities = "WHAT YOU CAN DO (CSS ONLY):\n" +
    "✅ Colors, gradients, borders, shadows\n" +
    "✅ Border radius, spacing, sizing\n" +
    "✅ Typography, backgrounds, layout\n" +
    "✅ Effects, transforms, animations\n" +
    "✅ Hover states, pseudo-elements\n\n" +
    "WHAT YOU CANNOT DO:\n" +
    "❌ Add/remove HTML elements\n" +
    "❌ Change text content\n" +
    "❌ Add JavaScript\n\n" +
    "EXACT SELECTORS (use these precisely, they exist in the HTML):\n" +
    "[data-ai=\"header\"]           → sticky navigation header\n" +
    "[data-ai=\"section-hero\"]     → hero banner section\n" +
    "[data-ai=\"section-categories\"] → categories section container\n" +
    "[data-ai=\"category-card\"]    → individual category cards\n" +
    "[data-ai=\"product-card\"]     → individual product cards\n" +
    "[data-ai=\"section-featured\"] → featured products section\n" +
    "[data-ai=\"section-footer\"]   → footer section\n" +
    "button                       → all buttons\n\n";

  const outputFormat = "OUTPUT FORMAT (REQUIRED - ALWAYS INCLUDE BOTH):\n\n" +
    "1. Your CSS code first\n" +
    "2. Then ALWAYS add CHANGES section (MANDATORY - DO NOT SKIP)\n\n" +
    "EXACT FORMAT:\n" +
    "```css\nyour css code here\n```\n\n" +
    "CHANGES:\n" +
    "SECTION: section-name\n" +
    "CHANGE: detailed description of what changed\n" +
    "---\n" +
    "SECTION: another-section\n" +
    "CHANGE: another change description\n" +
    "---\n\n" +
    "REQUIRED:\n" +
    "• ALWAYS output CHANGES section (even if just one change)\n" +
    "• Each CHANGE must describe WHAT you changed and WHY\n" +
    "• Use human-readable descriptions, not CSS code\n" +
    "• Minimum 2-3 changes per request\n" +
    "• Do NOT skip the CHANGES section\n\n" +
    "Example:\n" +
    "[data-ai=\"product-card\"] { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }\n" +
    "[data-ai=\"section-header\"] { background: #2d3748; color: #f7fafc; }\n\n" +
    "CHANGES:\n" +
    "SECTION: product-card\n" +
    "CHANGE: Added vibrant purple gradient background and shadow effects\n" +
    "---\n" +
    "SECTION: section-header\n" +
    "CHANGE: Changed header to dark theme with light text for contrast\n" +
    "---\n\n";

  if (isTargeted) {
    // TARGETED MODE - Surgical changes
    return baseInstructions +
      "MODE: TARGETED CHANGE\n" +
      "Generate MINIMAL CSS that changes ONLY the specific elements mentioned in the user's request.\n" +
      "Leave everything else completely untouched.\n" +
      "Only output CSS for the elements explicitly requested.\n\n" +
      capabilities +
      outputFormat +
      "CRITICAL: Always output the CHANGES section with detailed descriptions of what you changed.\n\n" +
      "Now generate MINIMAL CSS for: " + userPrompt;
  } else {
    // COMPLETE MODE - Full redesign
    return baseInstructions +
      "MODE: COMPLETE REDESIGN\n" +
      "Generate COMPLETE CSS redesigning the entire store with cohesive, beautiful design.\n" +
      "Transform colors, gradients, spacing, shadows, and layout across all major elements.\n\n" +
      capabilities +
      outputFormat +
      "CRITICAL: ALWAYS output CHANGES section with 4-6 detailed descriptions.\n" +
      "List what you changed in each section: hero, cards, buttons, footer, etc.\n\n" +
      "Now generate COMPLETE CSS for: " + userPrompt;
  }
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
      const model = (platformSettings.openrouter_model || "moonshotai/kimi-k2-thinking").trim();
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
                console.log("[RETRY] New AI response received (" + rawContent.length + " chars) on attempt " + (attempt + 2));
              } else {
                console.error("[RETRY] Retry fetch failed: " + retryResponse.status);
              }
            } catch (retryErr) {
              console.error("[RETRY] Retry error:", retryErr);
            }
          } else {
            console.log("[RETRY] Max retries (" + maxRetries + ") exhausted. Will use fallback.");
          }
        }
      }

      // ─── FALLBACK HANDLER ───────────────────────────────────────
      if (!parsed) {
        console.error("[FALLBACK] All " + (maxRetries + 1) + " retry attempts exhausted. Error: " + lastError);
        console.error("[FALLBACK] Last AI output (first 500 chars): " + rawContent.substring(0, 500));

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
            model: (genSettings.openrouter_model || "moonshotai/kimi-k2-thinking").trim(),
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
      console.log("[GENERATE] Initial AI response (" + genContent.length + " chars): " + genContent.slice(0, 80) + "...");

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
                  model: (genSettings.openrouter_model || "moonshotai/kimi-k2-thinking").trim(),
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
          model: genSettings.openrouter_model || "moonshotai/kimi-k2-thinking",
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

    // ── generate_full_css (Layer 2) ───────────────────────────
    if (action === "generate_full_css") {
      try {
      console.log("\n╔══════════════════════════════════════════════════╗");
      console.log("║  [LAYER2] generate_full_css ACTION TRIGGERED     ║");
      console.log("╚══════════════════════════════════════════════════╝\n");
      console.log("📥 Request received at:", new Date().toISOString());

      const { html_structure, layer1_baseline } = body;
      console.log("📊 Payload sizes:");
      console.log("  ├─ HTML structure:", html_structure?.length || 0, "chars");
      console.log("  ├─ Layer1 baseline:", JSON.stringify(layer1_baseline || {}).length, "chars");
      console.log("  └─ Messages:", messages?.length || 0);

      if (!store_id || !user_id || !html_structure || !layer1_baseline || !messages || messages.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: store_id, user_id, html_structure, layer1_baseline, or messages"
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      const userPrompt = messages[messages.length - 1]?.content || "";

      // Check tokens
      const { data: activePurchases } = await supabase.from("ai_token_purchases")
        .select("id, tokens_remaining, tokens_used")
        .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0)
        .order("expires_at", { ascending: true, nullsFirst: false }).limit(1);

      const activePurchase = activePurchases?.[0];
      if (!activePurchase) {
        return new Response(JSON.stringify({
          success: false,
          error: "No tokens remaining. Please purchase more tokens to continue."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 });
      }

      // Fetch platform settings
      const { data: platformSettings } = await supabase.from("platform_settings")
        .select("openrouter_api_key, openrouter_model").eq("id", SETTINGS_ID).single();

      if (!platformSettings?.openrouter_api_key) {
        return new Response(JSON.stringify({
          success: false,
          error: "AI not configured. Please contact platform support."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const model = (platformSettings.openrouter_model || "moonshotai/kimi-k2-thinking").trim();
      const apiKey = platformSettings.openrouter_api_key.trim();

      // ═══ DEBUG LOGGING - LAYER 2 INTENT CLASSIFICATION ═══
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🎯 [LAYER2 DEBUG] Intent Classification");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      console.log("📝 User Prompt:", userPrompt);
      console.log("📊 HTML Structure Length:", html_structure.length, "chars");
      console.log("🎨 Layer 1 Variables:", Object.keys(layer1_baseline.cssVariables || {}).length);

      // Step 1: AI-based intent classification (TARGETED vs COMPLETE)
      const intentMode = classifyUserIntent(userPrompt);

      console.log("\n🤖 AI Classification Result:", intentMode.toUpperCase());
      console.log("   ├─ Meaning:", intentMode === "targeted" ? "Surgical changes to specific elements" : "Complete store redesign");
      console.log("   └─ CSS Output:", intentMode === "targeted" ? "Minimal (5-20 lines)" : "Comprehensive (100-300 lines)");
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // Step 2: Build Layer 2 system prompt based on intent
      const systemPrompt = buildLayer2SystemPrompt(html_structure, layer1_baseline, userPrompt, intentMode);

      console.log("[LAYER2] System prompt length:", systemPrompt.length, "chars");
      console.log("[LAYER2] ⏱️ TIMEOUT SAFETY: 45s abort (Supabase limit 60s)");

      // Call OpenRouter with strict timeout to fit within Supabase 60s limit
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout (leaves 15s buffer)

      let aiResponse: Response;
      try {
        aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
              { role: "user", content: userPrompt }
            ],
            max_tokens: 2000, // CSS generation needs ~600-800 tokens; 2000 is safe max
            temperature: 0.2,
          }),
          signal: controller.signal,
        });
      } catch (error: any) {
        clearTimeout(timeout);
        const isTimeout = error.name === "AbortError";
        const errMsg = isTimeout
          ? "Design request took too long (>45s). Try simplifying your request or use fewer selectors."
          : "Unable to connect to AI. Please try again in a moment.";
        console.error("[LAYER2]", isTimeout ? "TIMEOUT" : "CONNECTION ERROR", ":", errMsg);
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: isTimeout ? 504 : 500 });
      }
      clearTimeout(timeout);

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text().catch(() => "");
        console.error("[LAYER2] OpenRouter error:", aiResponse.status, errBody);
        return new Response(JSON.stringify({
          success: false,
          error: "AI service responded with error. Please try again."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: aiResponse.status || 500 });
      }

      const aiData = await aiResponse.json();
      const usage = aiData.usage || {};
      console.log("[LAYER2] Token usage:", usage.prompt_tokens, "prompt +", usage.completion_tokens, "completion =", usage.total_tokens, "total");

      let rawOutput = aiData.choices?.[0]?.message?.content || "";
      console.log("[LAYER2] AI returned output length:", rawOutput.length, "chars");

      // ═══ PARSE DUAL OUTPUT: CSS + CHANGES (with error handling) ═══
      let rawCSS = "";
      let changesList: string[] = [];

      try {
        // First, extract CSS from markdown code blocks if present
        let cssContent = rawOutput;
        const codeBlockMatch = rawOutput.match(/```css\n([\s\S]*?)\n```/) || rawOutput.match(/```\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
          cssContent = codeBlockMatch[1];
          console.log("[LAYER2] Extracted CSS from code block");
        }

        // Split by CHANGES: marker
        const parts = rawOutput.split(/CHANGES:/i);

        if (parts.length >= 2) {
          // Has CHANGES section
          rawCSS = cssContent.trim();
          const changesText = "SECTION:" + parts.slice(1).join("CHANGES:");

          console.log("[LAYER2] Found CHANGES section, parsing changes");

          // Parse CHANGES manually - more robust
          const changeLines = changesText.split(/---/).filter(s => s.trim());
          changesList = [];

          for (const block of changeLines) {
            const sectionMatch = block.match(/SECTION:\s*([^\n]+)/i);
            const changeMatch = block.match(/CHANGE:\s*([^\n]+(?:\n(?!SECTION|CHANGE)[^\n]*)*)/i);

            if (sectionMatch && changeMatch) {
              const sectionName = sectionMatch[1].trim();
              const changDesc = changeMatch[1].trim().split('\n')[0]; // First line only
              const displayName = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
              changesList.push(displayName + " → " + changDesc);
            }
          }

          if (changesList.length === 0) {
            console.warn("[LAYER2] No CHANGES parsed, using fallback");
            changesList = ["Applied custom CSS to your store"];
          } else {
            console.log("[LAYER2] Successfully parsed", changesList.length, "changes");
          }
        } else {
          // No CHANGES section - all CSS
          rawCSS = cssContent.trim();
          console.warn("[LAYER2] No CHANGES section found in output");
          changesList = ["Applied beautiful custom CSS design to your store"];
        }

      } catch (splitErr) {
        console.error("[LAYER2] Error splitting output:", splitErr);
        // Complete fallback - use entire output as CSS
        rawCSS = rawOutput;
        changesList = ["Applied custom CSS (split error)"];
      }

      // Sanitize CSS with error handling
      let finalCSS = "";
      let blockedCount = 0;
      try {
        const sanitization = sanitizeCSS(rawCSS);
        if (sanitization.blocked.length > 0) {
          console.warn("[LAYER2] Blocked dangerous CSS:", sanitization.blocked);
          blockedCount = sanitization.blocked.length;
        }
        finalCSS = sanitization.sanitized;
      } catch (sanitizeErr) {
        console.error("[LAYER2] CSS sanitization failed:", sanitizeErr);
        finalCSS = ""; // Empty CSS on sanitization failure
      }

      // ═══ DEBUG LOGGING - LAYER 2 CSS GENERATION COMPLETE ═══
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✨ [LAYER2 DEBUG] CSS Generation Complete");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      console.log("📊 Generation Stats:");
      console.log("  ├─ Mode:", intentMode.toUpperCase());
      console.log("  ├─ Raw AI Output:", rawCSS.length, "chars");
      console.log("  ├─ Final CSS:", finalCSS.length, "chars");
      console.log("  ├─ Blocked Elements:", blockedCount);
      console.log("  └─ Token Usage:", usage.total_tokens, "(prompt:", usage.prompt_tokens + ", completion:", usage.completion_tokens + ")");

      // Count CSS rules for insights
      const cssRuleCount = (finalCSS.match(/\{/g) || []).length;
      const importantCount = (finalCSS.match(/!important/g) || []).length;
      const selectorTypes = {
        elements: (finalCSS.match(/^[a-z]+[\s{,]/gm) || []).length,
        classes: (finalCSS.match(/\.[a-zA-Z]/g) || []).length,
        ids: (finalCSS.match(/#[a-zA-Z]/g) || []).length,
        attributes: (finalCSS.match(/\[data-/g) || []).length,
      };

      console.log("\n📐 CSS Analysis:");
      console.log("  ├─ Total Rules:", cssRuleCount);
      console.log("  ├─ !important Usage:", importantCount);
      console.log("  ├─ Element Selectors:", selectorTypes.elements);
      console.log("  ├─ Class Selectors:", selectorTypes.classes);
      console.log("  ├─ ID Selectors:", selectorTypes.ids);
      console.log("  └─ Data Attributes:", selectorTypes.attributes);

      console.log("\n🎨 CSS Preview (first 300 chars):");
      console.log("  " + finalCSS.substring(0, 300).replace(/\n/g, "\n  "));
      if (finalCSS.length > 300) {
        console.log("  ...(+" + (finalCSS.length - 300) + " more chars)");
      }

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // Deduct token
      const newRemaining = activePurchase.tokens_remaining - 1;
      const newUsed = activePurchase.tokens_used + 1;
      await supabase.from("ai_token_purchases")
        .update({ tokens_remaining: newRemaining, tokens_used: newUsed })
        .eq("id", activePurchase.id);

      // Store in database (Layer 2)
      const now = new Date().toISOString();
      await supabase.from("store_design_state").upsert({
        store_id,
        ai_full_css: finalCSS,
        layer1_snapshot: layer1_baseline,
        mode: "advanced",
        ai_full_css_applied_at: now,
        updated_at: now,
      }, { onConflict: "store_id" });

      // Log to history
      await supabase.from("ai_designer_history").insert({
        store_id,
        user_id,
        prompt: userPrompt,
        ai_response: {
          layer2_css: finalCSS,
          mode: intentMode,
          stats: { cssRuleCount, importantCount, selectorTypes },
          changes_list: changesList
        },
        tokens_used: 1,
        applied: false,
      });

      console.log("✅ [LAYER2] Success! CSS stored, changes:", changesList.length, "tokens remaining:", newRemaining);

      return new Response(JSON.stringify({
        success: true,
        css: finalCSS,
        changes_list: changesList,
        tokens_remaining: newRemaining,
        message: changesList.length > 0 ? "Updated " + changesList.length + " section" + (changesList.length > 1 ? "s" : "") : "Layer 2 CSS generated successfully"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
