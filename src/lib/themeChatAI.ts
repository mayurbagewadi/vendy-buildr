import { supabase } from "@/integrations/supabase/client";

export type ThemeChatSection = {
  id: string;
  type: string;
  order: number;
  visible: boolean;
  settings: Record<string, unknown>;
  blocks: unknown[];
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ThemeChatResult = {
  intent: "build" | "patch";
  sections: ThemeChatSection[];
  global_settings: Record<string, unknown>;
  custom_css: string;
  message: string;
  tokens_remaining: number;
};

export async function themeChatRequest(params: {
  storeId: string;
  userId: string;
  prompt: string;
  history: ChatTurn[];
  currentSections: Record<string, unknown>[];
  referenceImage?: string;
}): Promise<ThemeChatResult> {
  const { storeId, userId, prompt, history, currentSections, referenceImage } = params;

  const { data, error } = await supabase.functions.invoke("ai-designer", {
    body: {
      action: "theme_chat",
      store_id: storeId,
      user_id: userId,
      prompt,
      conversation_history: history,
      current_sections: currentSections,
      reference_image: referenceImage || undefined,
    },
  });

  if (error) throw new Error(error.message || "AI request failed");
  if (!data?.success) throw new Error(data?.error || "AI returned an error");

  return {
    intent: data.intent === "patch" ? "patch" : "build",
    sections: Array.isArray(data.sections) ? data.sections : [],
    global_settings: data.global_settings ?? {},
    custom_css: data.custom_css ?? "",
    message: data.message ?? "",
    tokens_remaining: data.tokens_remaining ?? 0,
  };
}
