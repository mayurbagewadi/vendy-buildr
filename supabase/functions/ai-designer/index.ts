import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SETTINGS_ID = "00000000-0000-0000-0000-000000000000";

// Zod schema for AI design responses
const DesignSchema = z.object({
  summary: z.string(),
  css_variables: z.record(z.string()).optional(),
  dark_css_variables: z.record(z.string()).optional(),
  layout: z.object({
    product_grid_cols: z.enum(["2", "3", "4"]).optional(),
    section_padding: z.enum(["compact", "normal", "spacious"]).optional(),
    hero_style: z.enum(["image", "gradient"]).optional(),
  }).optional(),
  css_overrides: z.string().optional(),
  changes_list: z.array(z.string()),
});

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

// Classify if prompt needs full design context or is casual chat
function isDesignRequest(prompt: string): boolean {
  const designKeywords = [
    "color", "colour", "blue", "red", "green", "yellow", "purple", "pink", "orange",
    "design", "style", "layout", "change", "make", "update", "modify", "add",
    "button", "card", "section", "header", "footer", "banner", "product",
    "font", "text", "size", "padding", "margin", "border", "radius", "round",
    "shadow", "gradient", "background", "foreground", "theme",
    "dark", "light", "modern", "elegant", "minimalist", "bold",
    "spacing", "grid", "column", "row", "align", "center"
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

// Build system prompt for design requests
function buildDesignSystemPrompt(storeName: string, currentDesign: any): string {
  const designContext = currentDesign
    ? "Current store design: " + JSON.stringify(currentDesign) + "\nPreserve existing settings unless user asks to change them."
    : "Store is using platform defaults.";

  // Store sections with data-ai selectors for targeted CSS
  const storeSections =
    "STORE SECTIONS (use data-ai selectors in css_overrides):\n" +
    "1. Header [data-ai=\"header\"] - Logo, navigation, cart icon, search\n" +
    "2. Hero Banner [data-ai=\"section-hero\"] - Main promotional banner with CTA\n" +
    "3. Categories Grid [data-ai=\"section-categories\"] - Category cards with images\n" +
    "4. Featured Products [data-ai=\"section-featured\"] - Product cards grid\n" +
    "5. Product Card [data-ai=\"product-card\"] - Image, title, price, add-to-cart\n" +
    "6. Testimonials [data-ai=\"section-testimonials\"] - Customer reviews carousel\n" +
    "7. Footer [data-ai=\"footer\"] - Links, contact info, social icons\n" +
    "8. Product Detail [data-ai=\"product-detail\"] - Full product page\n" +
    "9. Cart Page [data-ai=\"cart-page\"] - Shopping cart items and totals\n" +
    "10. Checkout [data-ai=\"checkout\"] - Checkout form and payment\n";

  // CSS variables reference
  const cssVariables =
    "CSS VARIABLES (HSL format without hsl() wrapper):\n" +
    "--primary: 217 91% 60%        (buttons, links, accents - blue default)\n" +
    "--primary-foreground: 0 0% 100%   (text on primary color)\n" +
    "--background: 0 0% 100%       (page background - white default)\n" +
    "--foreground: 222 47% 11%     (main text color - dark default)\n" +
    "--card: 0 0% 100%             (card backgrounds)\n" +
    "--card-foreground: 222 47% 11%    (text on cards)\n" +
    "--muted: 210 40% 96%          (subtle backgrounds)\n" +
    "--muted-foreground: 215 16% 47%   (secondary text)\n" +
    "--border: 214 32% 91%         (border color)\n" +
    "--accent: 210 40% 96%         (accent backgrounds)\n" +
    "--radius: 0.5rem              (border radius)\n";

  // Dark mode variables
  const darkVariables =
    "DARK MODE (use dark_css_variables):\n" +
    "--background: 222 47% 11%     (dark background)\n" +
    "--foreground: 210 40% 98%     (light text)\n" +
    "--card: 222 47% 15%           (darker cards)\n" +
    "--muted: 217 33% 17%          (dark muted)\n" +
    "--border: 217 33% 20%         (dark borders)\n";

  // CSS override examples
  const cssOverrideExamples =
    "CSS_OVERRIDES EXAMPLES (target specific sections):\n" +
    "[data-ai=\"section-hero\"] { background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%); }\n" +
    "[data-ai=\"product-card\"] { border-radius: 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }\n" +
    "[data-ai=\"product-card\"]:hover { transform: translateY(-8px); }\n" +
    "[data-ai=\"header\"] { backdrop-filter: blur(10px); background: hsl(var(--background)/0.9); }\n" +
    "[data-ai=\"section-categories\"] .category-card { border: 2px solid hsl(var(--primary)/0.2); }\n" +
    "[data-ai=\"footer\"] { background: hsl(var(--muted)); }\n";

  // Layout options
  const layoutOptions =
    "LAYOUT OPTIONS:\n" +
    "- product_grid_cols: \"2\", \"3\", or \"4\" (products per row)\n" +
    "- section_padding: \"compact\", \"normal\", or \"spacious\"\n" +
    "- hero_style: \"image\" or \"gradient\"\n";

  // Response format
  const responseFormat =
    "RESPOND IN JSON FORMAT ONLY:\n" +
    "For text/chat: {\"type\":\"text\",\"message\":\"your response\"}\n" +
    "For design changes: {\"type\":\"design\",\"message\":\"description of changes\",\"design\":{" +
    "\"summary\":\"Brief summary\",\"css_variables\":{\"--primary\":\"217 91% 60%\"}," +
    "\"dark_css_variables\":{\"--primary\":\"217 91% 70%\"}," +
    "\"layout\":{\"product_grid_cols\":\"3\"}," +
    "\"css_overrides\":\"[data-ai=\\\"section-hero\\\"] { ... }\"," +
    "\"changes_list\":[\"Change 1\",\"Change 2\"]}}\n\n" +
    "Start response with { and end with }. No markdown code blocks.";

  return "You are an expert UI/UX designer for the e-commerce store: " + storeName + ".\n" +
    designContext + "\n\n" +
    storeSections + "\n" +
    cssVariables + "\n" +
    darkVariables + "\n" +
    cssOverrideExamples + "\n" +
    layoutOptions + "\n" +
    responseFormat;
}

// Build lightweight prompt for casual chat
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

// Build FULL detailed system prompt for design requests in chat (original 1415-line version content)
function buildFullChatSystemPrompt(storeName: string, storeDescription: string, currentDesign: any, historyRecords: any[]): string {
  const currentDesignContext = currentDesign
    ? "\n===== CURRENT PUBLISHED DESIGN =====\n" +
      "This store currently has these customizations applied:\n" +
      JSON.stringify(currentDesign, null, 2) + "\n\n" +
      "CRITICAL: PRESERVE all above settings unless the user explicitly asks to change them.\n" +
      "Only modify what the user specifically requests. Build on existing design incrementally.\n" +
      "=====\n"
    : "\n===== CURRENT DESIGN =====\nStore is using platform defaults (no customizations yet).\n=====\n";

  // Problem 1 fix - Option B: Pass last 10-20 history records as context
  let historyContext = "";
  if (historyRecords && historyRecords.length > 0) {
    historyContext = "\n===== RECENT DESIGN HISTORY (last " + historyRecords.length + " changes) =====\n" +
      "Below are the user's recent design requests and your previous responses.\n" +
      "Use this to understand what has already been customized and make ONLY incremental changes.\n\n";
    historyRecords.slice(0, 10).forEach((record: any, idx: number) => {
      historyContext = historyContext + (idx + 1) + ". User asked: \"" + record.prompt + "\"\n" +
        "   Applied: " + (record.applied ? "YES" : "NO") + "\n\n";
    });
    historyContext = historyContext + "=====\n\n";
  }

  const intro = "!!!CRITICAL: YOU MUST RESPOND ONLY IN VALID JSON FORMAT. NO PLAIN TEXT ALLOWED!!!\n\n" +
    "You are an expert AI designer and consultant for an e-commerce store called \"" + storeName + "\"" +
    (storeDescription ? " - " + storeDescription : "") + ".\n" +
    currentDesignContext +
    historyContext +
    "You have full access to the store's frontend source code and structure below. Use it to give precise, accurate design suggestions.\n\n" +
    "!!! STRICT RULE (Problem 1 fix - Option A) !!!\n" +
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

  // Problem 2 fix: Show AI the actual HTML structure
  const htmlStructure = "===== ACTUAL HTML STRUCTURE (for reference - DO NOT MODIFY) =====\n" +
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
    "- [data-ai=\"product-card\"] button -> View Details button (variant=outline = white bg, can be invisible on white card)\n" +
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
    "   - [data-ai=\"section-categories\"]     -> Categories section (has bg-gradient-to-b from-muted/30 to-background)\n" +
    "   - [data-ai=\"section-featured\"]       -> Featured Products section (bg-background)\n" +
    "   - [data-ai=\"section-reviews\"]        -> Google Reviews section (bg-muted/30)\n" +
    "   - [data-ai=\"section-new-arrivals\"]   -> New Arrivals section\n" +
    "   - [data-ai=\"section-cta\"]            -> CTA banner section (bg-primary text-primary-foreground)\n" +
    "   - [data-ai=\"section-reels\"]          -> Instagram Reels section\n" +
    "   - [data-ai=\"section-footer\"]         -> Footer (bg-muted border-t border-border, 4-col grid)\n\n" +
    "   CARD SELECTORS (target individual cards):\n" +
    "   - [data-ai=\"category-card\"]          -> each category card wrapper\n" +
    "   - [data-ai=\"category-card\"] .rounded-2xl -> card outer border-radius\n" +
    "   - [data-ai=\"category-card\"] .rounded-xl  -> image container border-radius\n" +
    "   - [data-ai=\"product-card\"]           -> each product card wrapper\n" +
    "   - [data-ai=\"product-card\"] .card     -> product card inner element\n\n" +
    "   ELEMENT SELECTORS (target text/buttons inside sections):\n" +
    "   - [data-ai=\"section-categories\"] h2  -> \"Shop by Category\" title (text-4xl md:text-5xl)\n" +
    "   - [data-ai=\"section-categories\"] p   -> subtitle text\n" +
    "   - [data-ai=\"section-featured\"] h2    -> \"Featured Products\" title (text-3xl)\n" +
    "   - [data-ai=\"section-new-arrivals\"] h2 -> \"New Arrivals\" title (text-3xl)\n" +
    "   - [data-ai=\"section-cta\"] h2         -> CTA title text\n" +
    "   - [data-ai=\"section-footer\"] footer  -> footer background/border\n" +
    "   - [data-ai=\"product-card\"] .text-lg  -> product price (text-primary font-bold)\n" +
    "   - [data-ai=\"product-card\"] img       -> product image\n\n";

  const examples = "   EXAMPLES:\n" +
    "   Make category cards circular:\n" +
    "   \"[data-ai='category-card'] .rounded-2xl, [data-ai='category-card'] .rounded-xl { border-radius: 9999px !important; }\"\n\n" +
    "   Change categories section background:\n" +
    "   \"[data-ai='section-categories'] { background: linear-gradient(to bottom, hsl(var(--primary)/0.1), hsl(var(--background))) !important; }\"\n\n" +
    "   Make section titles bigger:\n" +
    "   \"[data-ai='section-featured'] h2, [data-ai='section-new-arrivals'] h2 { font-size: 2.5rem !important; }\"\n\n" +
    "   Add shadow to product cards:\n" +
    "   \"[data-ai='product-card'] .card { box-shadow: 0 8px 30px hsl(var(--primary)/0.15) !important; }\"\n\n" +
    "   Dark footer:\n" +
    "   \"[data-ai='section-footer'] { background: hsl(222 47% 8%) !important; color: hsl(0 0% 95%) !important; }\"\n\n" +
    "   Change CTA section padding/style:\n" +
    "   \"[data-ai='section-cta'] { padding: 5rem 0 !important; background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.7)) !important; }\"\n\n";

  const responseRules = "===== CRITICAL RESPONSE RULES =====\n" +
    "YOU MUST RESPOND WITH VALID JSON ONLY. ABSOLUTELY NO PLAIN TEXT, NO MARKDOWN, NO EXPLANATIONS OUTSIDE JSON.\n\n" +
    "YOUR ENTIRE RESPONSE MUST BE ONE OF THESE TWO JSON FORMATS:\n\n" +
    "FORMAT 1 - Text response (for questions, suggestions, advice):\n" +
    "{\"type\": \"text\", \"message\": \"Your helpful response here\"}\n\n" +
    "FORMAT 2 - Design response (when user wants to change/create/apply design):\n" +
    "{\"type\": \"design\", \"message\": \"Brief explanation of changes\", \"design\": {" +
    "\"summary\": \"Brief description\", " +
    "\"css_variables\": {\"--primary\": \"142 71% 45%\"}, " +
    "\"dark_css_variables\": {\"--primary\": \"142 71% 50%\"}, " +
    "\"layout\": {\"product_grid_cols\": \"3\", \"section_padding\": \"normal\", \"hero_style\": \"gradient\"}, " +
    "\"css_overrides\": \"[data-ai='category-card'] * { border-radius: 9999px !important; }\", " +
    "\"changes_list\": [\"Change 1\", \"Change 2\"]}}\n\n" +
    "EXAMPLE VALID RESPONSES:\n" +
    "User: \"What colors should I use?\"\n" +
    "You: {\"type\": \"text\", \"message\": \"I recommend a vibrant primary color like teal (180 70% 45%) for modern appeal.\"}\n\n" +
    "User: \"Make it purple\"\n" +
    "You: {\"type\": \"design\", \"message\": \"Updated to vibrant purple theme\", \"design\": {\"summary\": \"Applied purple color scheme\", \"css_variables\": {\"--primary\": \"270 75% 60%\"}, \"changes_list\": [\"Changed primary to purple\"]}}\n\n" +
    "DO NOT RESPOND WITH PLAIN TEXT LIKE \"I've updated the search bar...\" - THIS WILL CAUSE SYSTEM FAILURE.\n" +
    "START YOUR RESPONSE WITH { AND END WITH }. NOTHING ELSE.";

  return intro + storeStructure + sections + htmlStructure + cssVars + capabilities + selectors + examples + responseRules;
}

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
      const now = new Date().toISOString();
      await supabase.from("ai_token_purchases").update({ status: "expired" })
        .eq("store_id", store_id).eq("status", "active").lt("expires_at", now).not("expires_at", "is", null);
      await supabase.from("ai_token_purchases").delete()
        .eq("store_id", store_id).eq("status", "expired");

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

    // ========== GENERATE DESIGN ==========
    if (action === "generate_design") {
      const startTime = Date.now();

      if (!store_id || !user_id || !prompt) {
        return new Response(JSON.stringify({ success: false, error: "Missing required fields" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      // Check tokens
      const { data: purchases } = await supabase.from("ai_token_purchases")
        .select("id, tokens_remaining, tokens_used")
        .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0)
        .order("expires_at", { ascending: true, nullsFirst: false }).limit(1);

      if (!purchases || purchases.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "No tokens remaining. Please purchase tokens." }),
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

      const { data: designState } = await supabase.from("store_design_state")
        .select("current_design").eq("store_id", store_id).single();

      const systemPrompt = buildDesignSystemPrompt(storeName, designState?.current_design);

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
            temperature: 0.7,
            max_tokens: 1000
          },
          controller.signal
        );
        modelUsed = aiResult.modelUsed;
      } catch (error: any) {
        clearTimeout(timeout);
        const errMsg = error.name === "AbortError" ? "Request timed out" : "AI service failed";
        await logMetrics(supabase, { store_id, user_id, action: "generate_design", success: false, error_type: errMsg, prompt_length: prompt.length });
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      clearTimeout(timeout);

      if (!aiResult.response.ok) {
        await logMetrics(supabase, { store_id, user_id, action: "generate_design", success: false, error_type: "api_error" });
        return new Response(JSON.stringify({ success: false, error: "AI API error" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const aiData = await aiResult.response.json();
      const aiContent = aiData.choices?.[0]?.message?.content;

      let parsedDesign;
      try {
        parsedDesign = extractJSON(aiContent);
      } catch {
        await logMetrics(supabase, { store_id, user_id, action: "generate_design", model_used: modelUsed, success: false, error_type: "parse_error" });
        return new Response(JSON.stringify({ success: false, error: "Invalid AI response. No token charged." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      // Validate with Zod
      const validation = DesignSchema.safeParse(parsedDesign);
      if (!validation.success) {
        await logMetrics(supabase, { store_id, user_id, action: "generate_design", model_used: modelUsed, success: false, error_type: "validation_error" });
        return new Response(JSON.stringify({ success: false, error: "AI returned incomplete design. No token charged." }),
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
        parsedDesign.css_overrides = sanitization.sanitized;
      }

      // Deduct token
      await supabase.from("ai_token_purchases").update({
        tokens_remaining: activePurchase.tokens_remaining - 1,
        tokens_used: (activePurchase.tokens_used || 0) + 1,
        updated_at: new Date().toISOString()
      }).eq("id", activePurchase.id);

      // Save history
      const { data: historyRecord } = await supabase.from("ai_designer_history")
        .insert({ store_id, user_id, prompt, ai_response: parsedDesign, tokens_used: 1, applied: false })
        .select("id").single();

      // Get new balance
      const { data: updatedPurchases } = await supabase.from("ai_token_purchases")
        .select("tokens_remaining").eq("store_id", store_id).eq("status", "active");
      const newBalance = (updatedPurchases || []).reduce((s: number, p: any) => s + (p.tokens_remaining || 0), 0);

      // Log metrics
      await logMetrics(supabase, {
        store_id, user_id, action: "generate_design", model_used: modelUsed,
        tokens_consumed: 1, latency_ms: Date.now() - startTime, success: true,
        prompt_length: prompt.length, css_sanitized: cssSanitized
      });

      return new Response(JSON.stringify({
        success: true, design: parsedDesign, history_id: historyRecord?.id, tokens_remaining: newBalance
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== CHAT ==========
    if (action === "chat") {
      const startTime = Date.now();

      if (!store_id || !user_id || !messages?.length) {
        return new Response(JSON.stringify({ success: false, error: "Missing required fields" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
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

      // Check if design request
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
      const userPrompt = lastUserMsg?.content || "";
      const needsFullContext = isDesignRequest(userPrompt);
      const storeDescription = store?.description || "";

      // Fetch last 10-20 design history records for context (Problem 1 fix - Option B)
      const { data: historyRecords } = await supabase.from("ai_designer_history")
        .select("prompt, ai_response, applied, created_at")
        .eq("store_id", store_id)
        .order("created_at", { ascending: false })
        .limit(20);

      let systemPrompt: string;
      if (needsFullContext) {
        const { data: designState } = await supabase.from("store_design_state")
          .select("current_design").eq("store_id", store_id).single();
        // Use the FULL detailed system prompt with all store structure info
        systemPrompt = buildFullChatSystemPrompt(storeName, storeDescription, designState?.current_design, historyRecords || []);
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
            max_tokens: 1500
          },
          controller.signal
        );
        modelUsed = aiResult.modelUsed;
      } catch (error: any) {
        clearTimeout(timeout);
        return new Response(JSON.stringify({ success: false, error: error.name === "AbortError" ? "Request timed out" : "AI service failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      clearTimeout(timeout);

      if (!aiResult.response.ok) {
        return new Response(JSON.stringify({ success: false, error: "AI API error" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const aiData = await aiResult.response.json();
      const aiContent = aiData.choices?.[0]?.message?.content;

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
        // Validate design
        const validation = DesignSchema.safeParse(parsed.design);
        if (!validation.success) {
          return new Response(JSON.stringify({ success: false, error: "AI returned incomplete design. No token charged." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
        }
        parsed.design = validation.data;

        // Sanitize CSS
        if (parsed.design.css_overrides) {
          const sanitization = sanitizeCSS(parsed.design.css_overrides);
          cssSanitized = !sanitization.safe;
          parsed.design.css_overrides = sanitization.sanitized;
        }

        // Check and deduct tokens
        const { data: purchases } = await supabase.from("ai_token_purchases")
          .select("id, tokens_remaining, tokens_used")
          .eq("store_id", store_id).eq("status", "active").gt("tokens_remaining", 0).limit(1);

        if (!purchases?.length) {
          return new Response(JSON.stringify({ success: false, error: "No tokens remaining" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 });
        }

        await supabase.from("ai_token_purchases").update({
          tokens_remaining: purchases[0].tokens_remaining - 1,
          tokens_used: (purchases[0].tokens_used || 0) + 1
        }).eq("id", purchases[0].id);

        const { data: hr } = await supabase.from("ai_designer_history")
          .insert({ store_id, user_id, prompt: userPrompt, ai_response: parsed.design, tokens_used: 1 })
          .select("id").single();
        historyId = hr?.id;

        const { data: up } = await supabase.from("ai_token_purchases")
          .select("tokens_remaining").eq("store_id", store_id).eq("status", "active");
        newTokenBalance = (up || []).reduce((s: number, p: any) => s + (p.tokens_remaining || 0), 0);
      }

      // Log metrics
      await logMetrics(supabase, {
        store_id, user_id, action: "chat", model_used: modelUsed,
        tokens_consumed: parsed.type === "design" ? 1 : 0,
        latency_ms: Date.now() - startTime, success: true,
        prompt_length: userPrompt.length, css_sanitized: cssSanitized
      });

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

      await supabase.from("store_design_state").upsert({
        store_id, current_design: design,
        version: (currentState?.version || 0) + 1,
        version_history: newVersionHistory,
        last_applied_at: now, updated_at: now
      }, { onConflict: "store_id" });

      if (history_id) {
        await supabase.from("ai_designer_history").update({ applied: true }).eq("id", history_id);
      }

      await logMetrics(supabase, { store_id, action: "apply_design", success: true, design_published: true, css_sanitized: cssSanitized });

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
        return new Response(JSON.stringify({ success: false, error: "Failed to create payment order" }),
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
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
