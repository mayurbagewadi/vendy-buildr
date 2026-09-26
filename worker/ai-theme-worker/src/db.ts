import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import type { GtPageType } from "./prompt.js";

export const supabase: SupabaseClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});

export interface AiThemeJob {
  id: string;
  store_id: string;
  user_id: string;
  page_type: GtPageType;
  prompt: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  attempt: number;
  max_attempts: number;
}

export async function claimNextJob(): Promise<AiThemeJob | null> {
  const { data, error } = await supabase.rpc("claim_next_ai_theme_job", {
    p_worker: config.workerName,
    p_lease_seconds: config.leaseSeconds,
  });
  if (error) {
    console.error("[claimNextJob] rpc error:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function completeJob(
  jobId: string,
  attempt: number,
  htmlLength: number,
  missingIds: string[],
  versionId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("complete_ai_theme_job", {
    p_job_id: jobId,
    p_worker: config.workerName,
    p_attempt: attempt,
    p_html_length: htmlLength,
    p_missing_ids: missingIds,
    p_version_id: versionId,
  });
  if (error) {
    console.error("[completeJob] rpc error:", error.message);
    return false;
  }
  return !!data;
}

export async function failJob(
  jobId: string,
  attempt: number,
  errorMessage: string,
  retryable: boolean
): Promise<boolean> {
  const { data, error } = await supabase.rpc("fail_ai_theme_job", {
    p_job_id: jobId,
    p_worker: config.workerName,
    p_attempt: attempt,
    p_error: errorMessage.slice(0, 500),
    p_retryable: retryable,
  });
  if (error) {
    console.error("[failJob] rpc error:", error.message);
    return false;
  }
  return !!data;
}

export async function extendLease(
  jobId: string,
  attempt: number
): Promise<{ stillOwned: boolean; cancelRequested: boolean }> {
  const { data, error } = await supabase.rpc("extend_ai_theme_job_lease", {
    p_job_id: jobId,
    p_worker: config.workerName,
    p_attempt: attempt,
    p_lease_seconds: config.leaseSeconds,
  });
  if (error) {
    console.error("[extendLease] rpc error:", error.message);
    return { stillOwned: false, cancelRequested: false };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { stillOwned: !!row?.still_owned, cancelRequested: !!row?.cancel_requested };
}

// ─── Store context (same 3 queries the edge function used to make) ────────
export async function loadStoreContext(storeId: string) {
  const [storeRes, productsRes, categoriesRes] = await Promise.all([
    supabase.from("stores").select("name, description, logo_url, whatsapp_number, address").eq("id", storeId).single(),
    supabase.from("products").select("id, name, slug, base_price, offer_price, images, category")
      .eq("store_id", storeId).eq("status", "published").limit(10),
    supabase.from("categories").select("id, name, image_url").eq("store_id", storeId).limit(10),
  ]);

  const store = storeRes.data;
  if (!store) return null;

  const products: any[] = productsRes.data || [];
  const categories: any[] = categoriesRes.data || [];

  const categoriesStr = categories.length > 0 ? categories.map((c) => `- ${c.name}`).join("\n") : "No categories added yet";
  const productsStr = products.length > 0
    ? products.map((p) => `- ${p.name} (Rs.${p.offer_price || p.base_price || 0}, category: ${p.category || "General"})`).join("\n")
    : "No products added yet";

  return {
    storeName: store.name || "Store",
    description: store.description || "Quality products at great prices",
    whatsapp: store.whatsapp_number || "",
    categoriesStr,
    categoriesCount: categories.length,
    productsStr,
    productsCount: products.length,
  };
}

// ─── Platform OpenRouter settings ──────────────────────────────────────────
const SETTINGS_ID = "00000000-0000-0000-0000-000000000000";

export async function loadOpenRouterSettings(): Promise<{ apiKey: string; model: string } | null> {
  const { data } = await supabase.from("platform_settings")
    .select("openrouter_api_key, openrouter_model, openrouter_fallback_model").eq("id", SETTINGS_ID).single();
  if (!data?.openrouter_api_key) return null;
  const model = ((data.openrouter_model || data.openrouter_fallback_model) as string || "").trim();
  if (!model) return null;
  return { apiKey: data.openrouter_api_key, model };
}

// ─── Save results — identical shape/tables as the old synchronous path ────
export async function saveHomePage(
  storeId: string,
  html: string,
  prompt: string,
  versionId: string
): Promise<void> {
  const nowStr = new Date().toISOString();
  const { data: existing } = await supabase.from("store_ai_themes").select("version_history").eq("store_id", storeId).single();
  let versionHistory: any[] = Array.isArray(existing?.version_history) ? existing.version_history : [];
  versionHistory.unshift({ id: versionId, prompt: prompt.slice(0, 200), created_at: nowStr });
  if (versionHistory.length > 5) versionHistory = versionHistory.slice(0, 5);

  const { error } = await supabase.from("store_ai_themes").upsert({
    store_id: storeId,
    draft_html: html,
    draft_prompt: prompt.slice(0, 500),
    draft_created_at: nowStr,
    version_history: versionHistory,
    updated_at: nowStr,
  }, { onConflict: "store_id" });
  if (error) throw new Error(`home upsert failed: ${error.message}`);
}

export async function saveOtherPage(storeId: string, pageType: GtPageType, html: string): Promise<void> {
  const nowStr = new Date().toISOString();
  const { error } = await supabase.from("store_ai_theme_pages").upsert({
    store_id: storeId,
    page_type: pageType,
    draft_html: html,
    draft_created_at: nowStr,
    updated_at: nowStr,
  }, { onConflict: "store_id,page_type" });
  if (error) throw new Error(`${pageType} upsert failed: ${error.message}`);
}

// ─── Token accounting — same FIFO-across-purchases logic as before ────────
export async function getActiveTokenBalance(storeId: string) {
  const { data } = await supabase.from("ai_token_purchases")
    .select("id, tokens_remaining, tokens_used")
    .eq("store_id", storeId).eq("status", "active").gt("tokens_remaining", 0)
    .order("expires_at", { ascending: true, nullsFirst: false });
  const purchases = (data || []) as { id: string; tokens_remaining: number; tokens_used: number }[];
  const total = purchases.reduce((sum, p) => sum + p.tokens_remaining, 0);
  return { purchases, total };
}

export async function deductOneToken(storeId: string): Promise<void> {
  const { purchases } = await getActiveTokenBalance(storeId);
  const target = purchases.find((p) => p.tokens_remaining > 0);
  if (!target) return; // Shouldn't happen (checked at enqueue time), but never block a save over it.
  await supabase.from("ai_token_purchases").update({
    tokens_remaining: target.tokens_remaining - 1,
    tokens_used: target.tokens_used + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", target.id);
}

export async function logHistory(
  storeId: string,
  userId: string,
  prompt: string,
  pageType: GtPageType,
  htmlLength: number,
  missing: string[],
  versionId: string
): Promise<void> {
  const { error } = await supabase.from("ai_designer_history").insert({
    store_id: storeId,
    user_id: userId,
    prompt,
    ai_response: { type: "theme_html_page", page_type: pageType, html_length: htmlLength, missing, version_id: versionId },
    tokens_used: 1,
    applied: false,
  });
  if (error) console.error("[logHistory] insert failed:", error.message);
}
