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
  };
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
}

export async function chatWithAI(
  storeId: string,
  userId: string,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: { action: "chat", store_id: storeId, user_id: userId, messages },
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return {
    type: data.type,
    message: data.message,
    design: data.design || undefined,
    history_id: data.history_id,
    tokens_remaining: data.tokens_remaining,
  };
}

export async function getAppliedDesign(storeId: string): Promise<AIDesignResult | null> {
  const { data } = await supabase
    .from("store_design_state")
    .select("current_design")
    .eq("store_id", storeId)
    .maybeSingle();
  return (data?.current_design as AIDesignResult) || null;
}

// Build a CSS string from design variables to inject into a style tag
export function buildDesignCSS(design: AIDesignResult): string {
  const lightVars = Object.entries(design.css_variables || {})
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const darkVars = Object.entries(design.dark_css_variables || {})
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  let css = `:root {\n${lightVars}\n}`;
  if (darkVars) {
    css += `\n.dark {\n${darkVars}\n}`;
  }
  return css;
}
