import { supabase } from "@/integrations/supabase/client";

export type StoreThemeState = {
  store_id: string;
  draft_theme_id: string;
  draft_theme_version: string | null;
  draft_settings: Record<string, unknown>;
  draft_page_layout: Record<string, unknown>;
  draft_updated_at: string | null;
  published_theme_id: string;
  published_theme_version: string | null;
  published_settings: Record<string, unknown>;
  published_page_layout: Record<string, unknown>;
  published_at: string | null;
  published_by: string | null;
  version: number;
  created_at: string | null;
  updated_at: string | null;
};

export type StoreThemeSnapshot = {
  id: string;
  store_id: string;
  version: number;
  theme_id: string;
  theme_version: string | null;
  settings: Record<string, unknown>;
  page_layout: Record<string, unknown>;
  reason: string;
  created_at: string | null;
  created_by: string | null;
};

const STORE_THEME_STATE_COLUMNS = `
  store_id,
  draft_theme_id,
  draft_theme_version,
  draft_settings,
  draft_page_layout,
  draft_updated_at,
  published_theme_id,
  published_theme_version,
  published_settings,
  published_page_layout,
  published_at,
  published_by,
  version,
  created_at,
  updated_at
`;

export const loadStoreThemeState = async (storeId: string): Promise<StoreThemeState | null> => {
  const { data, error } = await (supabase as any)
    .from("store_theme_state")
    .select(STORE_THEME_STATE_COLUMNS)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as StoreThemeState | null;
};

export const saveDraftThemeState = async ({
  storeId,
  themeId,
  themeVersion,
  settings,
  pageLayout = {},
}: {
  storeId: string;
  themeId: string;
  themeVersion: string | null;
  settings: Record<string, unknown>;
  pageLayout?: Record<string, unknown>;
}): Promise<StoreThemeState> => {
  const draftPatch = {
    draft_theme_id: themeId,
    draft_theme_version: themeVersion,
    draft_settings: settings,
    draft_page_layout: pageLayout,
    draft_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await (supabase as any)
    .from("store_theme_state")
    .update(draftPatch)
    .eq("store_id", storeId)
    .select(STORE_THEME_STATE_COLUMNS)
    .maybeSingle();

  if (updateError) throw updateError;
  if (updated) return updated as StoreThemeState;

  const { data: inserted, error: insertError } = await (supabase as any)
    .from("store_theme_state")
    .insert({
      store_id: storeId,
      ...draftPatch,
      published_theme_id: themeId,
      published_theme_version: themeVersion,
      published_settings: settings,
      published_page_layout: pageLayout,
      version: 0,
    })
    .select(STORE_THEME_STATE_COLUMNS)
    .single();

  if (insertError) throw insertError;
  return inserted as StoreThemeState;
};

export const publishDraftThemeState = async (storeId: string): Promise<StoreThemeState> => {
  const { data, error } = await (supabase as any).rpc("publish_store_theme_draft", {
    p_store_id: storeId,
  });

  if (error) throw error;
  return data as StoreThemeState;
};

export const loadStoreThemeSnapshots = async (storeId: string): Promise<StoreThemeSnapshot[]> => {
  const { data, error } = await (supabase as any)
    .from("store_theme_snapshots")
    .select("id, store_id, version, theme_id, theme_version, settings, page_layout, reason, created_at, created_by")
    .eq("store_id", storeId)
    .order("version", { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data ?? []) as StoreThemeSnapshot[];
};

export const rollbackStoreThemeSnapshot = async (
  storeId: string,
  snapshotId: string
): Promise<StoreThemeState> => {
  const { data, error } = await (supabase as any).rpc("rollback_store_theme_snapshot", {
    p_store_id: storeId,
    p_snapshot_id: snapshotId,
  });

  if (error) throw error;
  return data as StoreThemeState;
};
