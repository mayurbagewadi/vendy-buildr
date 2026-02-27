import { supabase } from "@/integrations/supabase/client";

const EDGE_FUNCTION = "ai-designer";

export interface AIDesignResult {
  summary: string;
  css_variables: Record<string, string>;
  dark_css_variables?: Record<string, string>;
  layout?: {
    product_grid_cols?: string;
    section_padding?: string;
    hero_style?: string;
    button_style?: string;
    card_style?: string;
    header_style?: string;
    section_gap?: string;
  };
  fonts?: {
    heading?: string;
    body?: string;
  };
  css_overrides?: string;
  changes_list: string[];
}

export interface TokenBalance {
  tokens_remaining: number;
  expires_at: string | null;
  has_tokens: boolean;
}

export async function getTokenBalance(storeId: string): Promise<TokenBalance> {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: { action: "get_token_balance", store_id: storeId },
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return {
    tokens_remaining: data.tokens_remaining,
    expires_at: data.expires_at,
    has_tokens: data.has_tokens,
  };
}

export async function generateDesign(
  storeId: string,
  userId: string,
  prompt: string
): Promise<{ design: AIDesignResult; history_id: string; tokens_remaining: number }> {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: { action: "generate_design", store_id: storeId, user_id: userId, prompt },
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return {
    design: data.design,
    history_id: data.history_id,
    tokens_remaining: data.tokens_remaining,
  };
}

export async function applyDesign(
  storeId: string,
  design: AIDesignResult,
  historyId?: string
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: { action: "apply_design", store_id: storeId, design, history_id: historyId },
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error);
}

export async function resetDesign(storeId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: { action: "reset_design", store_id: storeId },
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  type: "text" | "design";
  message: string;
  design?: AIDesignResult;
  history_id?: string;
  tokens_remaining?: number;
  is_destructive?: boolean;
  destructive_info?: { changePercent: number; changedFields: string[]; message: string };
}

export async function chatWithAI(
  storeId: string,
  userId: string,
  messages: ChatMessage[],
  theme: "light" | "dark" = "light"
): Promise<ChatResponse> {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🤖 [AI-DESIGNER] Chat Request");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Store ID:", storeId);
  console.log("Messages:", messages.length);
  console.log("Last message:", messages[messages.length - 1]?.content);

  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: { action: "chat", store_id: storeId, user_id: userId, messages, theme },
  });

  if (error) {
    console.error("❌ [AI-DESIGNER] Error:", error);
    throw error;
  }
  if (!data.success) {
    console.error("❌ [AI-DESIGNER] Failed:", data.error);
    throw new Error(data.error);
  }

  console.log("\n✅ [AI-DESIGNER] Response received");
  console.log("Type:", data.type);
  console.log("Message:", data.message);

  if (data.design) {
    console.log("\n🎨 [DESIGN] AI Generated Design:");
    console.log("Summary:", data.design.summary);
    console.log("Changes:", data.design.changes_list);
    console.log("CSS Variables:", data.design.css_variables);
    console.log("Dark Variables:", data.design.dark_css_variables);
    console.log("Layout:", data.design.layout);
    console.log("Fonts:", data.design.fonts);
    console.log("CSS Overrides length:", data.design.css_overrides?.length || 0);

    if (data.design.css_overrides) {
      console.log("\n✨ [CSS-OVERRIDES] Custom CSS:");
      console.log(data.design.css_overrides);
    }
  }

  console.log("\n🪙 Tokens remaining:", data.tokens_remaining);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return {
    type: data.type,
    message: data.message,
    design: data.design || undefined,
    history_id: data.history_id,
    tokens_remaining: data.tokens_remaining,
    is_destructive: data.is_destructive || false,
    destructive_info: data.destructive_info || null,
  };
}

export async function getAppliedDesign(storeId: string): Promise<AIDesignResult | null> {
  const { data } = await supabase
    .from("store_design_state")
    .select("current_design")
    .eq("store_id", storeId)
    .maybeSingle();
  return (data?.current_design as unknown as AIDesignResult) || null;
}

// Validate CSS variable value completeness
function isValidCSSValue(varName: string, value: string): boolean {
  // For radius, check if it's a valid length unit
  if (varName === 'radius') {
    return /^[\d.]+\s*(rem|px|em|%)$/.test(value.trim());
  }

  // For color variables (HSL), ensure 3 space-separated values (Hue Saturation% Lightness%)
  const parts = value.trim().split(/\s+/);
  return parts.length === 3;
}

// Build a CSS string from design variables to inject into a style tag
export function buildDesignCSS(design: AIDesignResult): string {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎨 [BUILD-CSS] Generating CSS from Design");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log('[INPUT] css_variables:', design.css_variables);
  console.log('[INPUT] dark_vars:', design.dark_css_variables);
  console.log('[INPUT] layout:', design.layout);
  console.log('[INPUT] fonts:', design.fonts);
  console.log('[INPUT] overrides length:', design.css_overrides?.length || 0);

  // Default fallback values for incomplete CSS variables
  const cssDefaults: Record<string, string> = {
    'primary': '217 91% 60%',
    'background': '210 40% 98%',
    'foreground': '222 47% 11%',
    'card': '0 0% 100%',
    'card-foreground': '222 47% 11%',
    'muted': '210 40% 96%',
    'muted-foreground': '215 16% 47%',
    'border': '214 32% 91%',
    'radius': '0.75rem',
    'accent': '210 40% 96%',
    'secondary': '210 40% 96%',
  };

  // Validate and filter CSS variables
  const validatedVars: Record<string, string> = {};
  Object.entries(design.css_variables || {}).forEach(([k, v]) => {
    if (isValidCSSValue(k, v)) {
      validatedVars[k] = v;
    } else {
      console.warn(`[CSS-VALIDATION] Incomplete value for "--${k}: ${v}" - using default: ${cssDefaults[k] || v}`);
      validatedVars[k] = cssDefaults[k] || v;
    }
  });

  const lightVars = Object.entries(validatedVars)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join("\n");

  // Validate dark mode variables too
  const validatedDarkVars: Record<string, string> = {};
  Object.entries(design.dark_css_variables || {}).forEach(([k, v]) => {
    if (isValidCSSValue(k, v)) {
      validatedDarkVars[k] = v;
    } else {
      console.warn(`[CSS-VALIDATION] Incomplete dark mode value for "--${k}: ${v}" - using default: ${cssDefaults[k] || v}`);
      validatedDarkVars[k] = cssDefaults[k] || v;
    }
  });

  const darkVars = Object.entries(validatedDarkVars)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join("\n");

  let css = `:root {\n${lightVars}\n}`;
  if (darkVars) {
    css += `\n.dark {\n${darkVars}\n}`;
  }

  // Font injection
  if (design.fonts) {
    const fontImports: string[] = [];
    if (design.fonts.heading) {
      fontImports.push(design.fonts.heading.replace(/ /g, "+"));
      css += `\n:root { --font-heading: '${design.fonts.heading}', sans-serif; }`;
      css += `\nh1, h2, h3, h4, h5, h6, [data-ai="section-hero"] h1, [data-ai="section-hero"] h2 { font-family: var(--font-heading) !important; }`;
    }
    if (design.fonts.body) {
      fontImports.push(design.fonts.body.replace(/ /g, "+"));
      css += `\n:root { --font-body: '${design.fonts.body}', sans-serif; }`;
      css += `\nbody, p, span, a, li, td, th, input, textarea, select, button { font-family: var(--font-body) !important; }`;
    }
    // Note: Google Font <link> tags are injected separately by injectGoogleFonts()
  }

  // Component variant styles
  if (design.layout) {
    const { button_style, card_style, header_style } = design.layout;

    if (button_style) {
      const btnStyles: Record<string, string> = {
        sharp: "button, [role='button'], .btn { border-radius: 0 !important; }",
        pill: "button, [role='button'], .btn { border-radius: 9999px !important; }",
        soft: "button, [role='button'], .btn { border-radius: 12px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important; }",
        rounded: "", // default, no override needed
      };
      if (btnStyles[button_style]) css += `\n/* Button variant: ${button_style} */\n${btnStyles[button_style]}`;
    }

    if (card_style) {
      const cardStyles: Record<string, string> = {
        flat: "[data-ai='product-card'], .card, [class*='card'] { border: none !important; box-shadow: none !important; }",
        elevated: "[data-ai='product-card'], .card, [class*='card'] { border: none !important; box-shadow: 0 8px 30px rgba(0,0,0,0.12) !important; }",
        bordered: "[data-ai='product-card'], .card, [class*='card'] { border: 2px solid hsl(var(--primary) / 0.2) !important; box-shadow: none !important; }",
        glass: "[data-ai='product-card'], .card, [class*='card'] { background: hsl(var(--card) / 0.5) !important; backdrop-filter: blur(12px) !important; border: 1px solid rgba(255,255,255,0.1) !important; }",
        default: "", // no override
      };
      if (cardStyles[card_style]) css += `\n/* Card variant: ${card_style} */\n${cardStyles[card_style]}`;
    }

    if (header_style) {
      const headerStyles: Record<string, string> = {
        transparent: "[data-ai='header'] { background: transparent !important; border-bottom: none !important; }",
        gradient: "[data-ai='header'] { background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7)) !important; color: hsl(var(--primary-foreground)) !important; border-bottom: none !important; }",
        glass: "[data-ai='header'] { background: hsl(var(--background) / 0.7) !important; backdrop-filter: blur(20px) !important; border-bottom: 1px solid hsl(var(--border) / 0.3) !important; }",
        solid: "", // default
      };
      if (headerStyles[header_style]) css += `\n/* Header variant: ${header_style} */\n${headerStyles[header_style]}`;
    }
  }

  if (design.css_overrides) {
    css += `\n/* AI CSS Overrides */\n${design.css_overrides}`;
  }

  console.log("\n📄 [OUTPUT] Final CSS to inject:");
  console.log(css);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return css;
}

// Inject Google Fonts <link> tags into a document head
export function injectGoogleFonts(doc: Document, fonts?: AIDesignResult["fonts"]) {
  console.log("\n🔤 [FONTS] Injecting Google Fonts");
  console.log("Fonts config:", fonts);

  // Remove previous AI font links
  doc.querySelectorAll('link[data-ai-font]').forEach(el => el.remove());
  if (!fonts) {
    console.log("No fonts to inject");
    return;
  }

  const families: string[] = [];
  if (fonts.heading) families.push(fonts.heading.replace(/ /g, "+") + ":wght@400;500;600;700;800;900");
  if (fonts.body) families.push(fonts.body.replace(/ /g, "+") + ":wght@300;400;500;600;700");
  if (families.length === 0) {
    console.log("No font families to load");
    return;
  }

  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join("&")}&display=swap`;
  link.setAttribute("data-ai-font", "true");
  doc.head.appendChild(link);

  console.log("✅ Font link injected:", link.href);
}

/**
 * Debug helper: Show what's currently in iframe head
 */
export function debugIframeStyles(iframe: HTMLIFrameElement, label: string = "Debug"): void {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🔍 [${label}] Iframe Styles Inspection`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const doc = iframe.contentDocument;
  if (!doc) {
    console.warn("❌ Cannot access iframe document");
    return;
  }

  // Check all style tags
  const styleTags = Array.from(doc.head.querySelectorAll('style'));
  console.log(`📄 Found ${styleTags.length} <style> tags in <head>`);

  styleTags.forEach((style, idx) => {
    const id = style.id || "(no id)";
    const dataLayer = style.getAttribute('data-ai-layer') || "(no layer)";
    const length = style.textContent?.length || 0;
    console.log(`  ${idx + 1}. id="${id}" layer="${dataLayer}" length=${length} chars`);

    if (id.includes('ai-') || dataLayer !== "(no layer)") {
      console.log(`     Content preview:`, style.textContent?.substring(0, 200));
    }
  });

  // Check link tags (fonts)
  const linkTags = Array.from(doc.head.querySelectorAll('link[data-ai-font]'));
  console.log(`\n🔤 Found ${linkTags.length} AI font <link> tags`);
  linkTags.forEach((link, idx) => {
    console.log(`  ${idx + 1}.`, (link as HTMLLinkElement).href);
  });

  // Check computed style of :root
  const rootStyle = doc.defaultView?.getComputedStyle(doc.documentElement);
  if (rootStyle) {
    const primaryColor = rootStyle.getPropertyValue('--primary').trim();
    const backgroundColor = rootStyle.getPropertyValue('--background').trim();
    const radius = rootStyle.getPropertyValue('--radius').trim();

    console.log("\n🎨 Current CSS Variables on :root:");
    console.log(`  --primary: ${primaryColor || "(not set)"}`);
    console.log(`  --background: ${backgroundColor || "(not set)"}`);
    console.log(`  --radius: ${radius || "(not set)"}`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ══════════════════════════════════════════════════════════════
// LAYER 2 (Full CSS Generation) Functions
// ══════════════════════════════════════════════════════════════

/**
 * Generate full CSS (Layer 2) using AI
 * @param storeId - Store ID
 * @param userId - User ID
 * @param htmlStructure - HTML structure from iframe
 * @param layer1Baseline - Current styles baseline
 * @param prompt - User request
 */
export async function generateFullCSS(
  storeId: string,
  userId: string,
  htmlStructure: string,
  layer1Baseline: any,
  prompt: string
): Promise<{ css: string; tokens_remaining: number; changes_list?: string[]; message?: string }> {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: {
      action: "generate_full_css",
      store_id: storeId,
      user_id: userId,
      html_structure: htmlStructure,
      layer1_baseline: layer1Baseline,
      messages: [{ role: "user", content: prompt }],
    },
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error);

  return {
    css: data.css,
    tokens_remaining: data.tokens_remaining,
    changes_list: data.changes_list,
    message: data.message,
  };
}

/**
 * Get Layer 2 CSS from database
 */
export async function getLayer2CSS(storeId: string): Promise<string | null> {
  const { data } = await supabase
    .from("store_design_state")
    .select("ai_full_css, mode")
    .eq("store_id", storeId)
    .maybeSingle();

  if (data?.mode === "advanced" && data?.ai_full_css) {
    return data.ai_full_css;
  }
  return null;
}

/**
 * Apply Layer 2 CSS to store
 */
export async function applyLayer2CSS(storeId: string, css: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("store_design_state")
    .upsert({
      store_id: storeId,
      ai_full_css: css,
      mode: "advanced",
      ai_full_css_applied_at: now,
      updated_at: now,
    }, { onConflict: "store_id" });

  if (error) throw error;
}

/**
 * Reset Layer 2 (back to simple mode)
 */
export async function resetLayer2(storeId: string): Promise<void> {
  const { error } = await supabase
    .from("store_design_state")
    .update({
      ai_full_css: null,
      layer1_snapshot: null,
      mode: "simple",
      ai_full_css_applied_at: null,
    })
    .eq("store_id", storeId);

  if (error) throw error;
}

/**
 * Inject Layer 2 CSS into iframe
 */
export function injectLayer2CSS(iframe: HTMLIFrameElement, css: string): void {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💉 [INJECT-LAYER2] Injecting CSS into iframe");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const doc = iframe.contentDocument;
  if (!doc?.head) {
    console.warn('❌ [LAYER2] Cannot inject - iframe head not accessible');
    return;
  }

  // Remove existing Layer 2 style tag
  const existing = doc.getElementById('ai-layer2-styles');
  if (existing) {
    console.log('🗑️  [LAYER2] Removing existing Layer 2 styles');
    existing.remove();
  }

  // Create new style tag
  const styleEl = doc.createElement('style');
  styleEl.id = 'ai-layer2-styles';
  styleEl.setAttribute('data-ai-layer', '2');
  styleEl.textContent = css;
  doc.head.appendChild(styleEl);

  console.log('✅ [LAYER2] CSS injected successfully');
  console.log('   ├─ Length:', css.length, 'chars');
  console.log('   ├─ Style tag ID: ai-layer2-styles');
  console.log('   └─ Preview:');
  console.log(css.substring(0, 500));
  if (css.length > 500) {
    console.log('   ...(+' + (css.length - 500) + ' more chars)');
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}
