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
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: { action: "chat", store_id: storeId, user_id: userId, messages, theme },
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error);
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

// Build a CSS string from design variables to inject into a style tag
export function buildDesignCSS(design: AIDesignResult): string {
  console.log('[AI-DEBUG] buildDesignCSS input — css_variables:', design.css_variables, 'dark_vars:', design.dark_css_variables, 'overrides length:', design.css_overrides?.length, 'fonts:', design.fonts, 'layout:', design.layout);

  const lightVars = Object.entries(design.css_variables || {})
    .map(([k, v]) => `  --${k}: ${v};`)
    .join("\n");

  const darkVars = Object.entries(design.dark_css_variables || {})
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
  return css;
}

// Inject Google Fonts <link> tags into a document head
export function injectGoogleFonts(doc: Document, fonts?: AIDesignResult["fonts"]) {
  // Remove previous AI font links
  doc.querySelectorAll('link[data-ai-font]').forEach(el => el.remove());
  if (!fonts) return;

  const families: string[] = [];
  if (fonts.heading) families.push(fonts.heading.replace(/ /g, "+") + ":wght@400;500;600;700;800;900");
  if (fonts.body) families.push(fonts.body.replace(/ /g, "+") + ":wght@300;400;500;600;700");
  if (families.length === 0) return;

  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join("&")}&display=swap`;
  link.setAttribute("data-ai-font", "true");
  doc.head.appendChild(link);
}
