import { supabase } from "@/integrations/supabase/client";

type ThemeQueryResult<T> = {
  data: T;
  error: Error | null;
};

type ThemeQueryBuilder<T> = PromiseLike<ThemeQueryResult<T>> & {
  select: (columns: string) => ThemeQueryBuilder<T>;
  eq: (column: string, value: unknown) => ThemeQueryBuilder<T>;
  order: (column: string, options: { ascending: boolean }) => ThemeQueryBuilder<T>;
  limit: (count: number) => ThemeQueryBuilder<T>;
  update: (values: Record<string, unknown>) => ThemeQueryBuilder<T>;
  insert: (values: Record<string, unknown>) => ThemeQueryBuilder<T>;
  maybeSingle: () => Promise<ThemeQueryResult<T | null>>;
  single: () => Promise<ThemeQueryResult<T>>;
};

type ThemeStateDbClient = {
  from: <T>(table: string) => ThemeQueryBuilder<T>;
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<ThemeQueryResult<T>>;
};

const themeStateDb = supabase as unknown as ThemeStateDbClient;

export type StoreThemeState = {
  store_id: string;
  draft_theme_id: string;
  draft_theme_version: string | null;
  draft_settings: Record<string, unknown>;
  draft_page_layout: Record<string, unknown>;
  draft_updated_at: string | null;
  published_version_id: string | null;
  published_theme_id: string;
  published_theme_version: string | null;
  published_settings: Record<string, unknown>;
  published_page_layout: Record<string, unknown>;
  published_assets: Record<string, unknown>;
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
  assets: Record<string, unknown>;
  reason: string;
  created_at: string | null;
  created_by: string | null;
};

const STORE_THEME_STATE_COLUMNS = `
  store_id,
  draft_theme_id,
  draft_theme_version,
  draft_settings,
  draft_layout,
  draft_assets,
  published_version_id,
  publish_sequence,
  created_at,
  updated_at
`;

type StoreThemeStateRow = {
  store_id: string;
  draft_theme_id: string;
  draft_theme_version: string | null;
  draft_settings: Record<string, unknown> | null;
  draft_layout: Record<string, unknown> | null;
  draft_assets: Record<string, unknown> | null;
  published_version_id: string | null;
  publish_sequence: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type StoreThemeVersionRow = {
  id: string;
  store_id: string;
  version_number: number;
  theme_id: string;
  theme_version: string | null;
  settings: Record<string, unknown> | null;
  layout: Record<string, unknown> | null;
  assets: Record<string, unknown> | null;
  published_by: string | null;
  published_at: string | null;
  reason: string | null;
  created_at: string | null;
};

const STORE_THEME_VERSION_COLUMNS = `
  id,
  store_id,
  version_number,
  theme_id,
  theme_version,
  settings,
  layout,
  assets,
  published_by,
  published_at,
  reason,
  created_at
`;

const emptyObject = (): Record<string, unknown> => ({});

const toPublicState = (
  state: StoreThemeStateRow,
  publishedVersion: StoreThemeVersionRow | null
): StoreThemeState => ({
  store_id: state.store_id,
  draft_theme_id: state.draft_theme_id,
  draft_theme_version: state.draft_theme_version,
  draft_settings: state.draft_settings ?? emptyObject(),
  draft_page_layout: state.draft_layout ?? emptyObject(),
  draft_updated_at: state.updated_at,
  published_version_id: state.published_version_id,
  published_theme_id: publishedVersion?.theme_id ?? "default",
  published_theme_version: publishedVersion?.theme_version ?? null,
  published_settings: publishedVersion?.settings ?? emptyObject(),
  published_page_layout: publishedVersion?.layout ?? emptyObject(),
  published_assets: publishedVersion?.assets ?? emptyObject(),
  published_at: publishedVersion?.published_at ?? null,
  published_by: publishedVersion?.published_by ?? null,
  version: state.publish_sequence ?? 0,
  created_at: state.created_at,
  updated_at: state.updated_at,
});

const loadPublishedVersion = async (
  versionId: string | null
): Promise<StoreThemeVersionRow | null> => {
  if (!versionId) return null;

  const { data, error } = await themeStateDb
    .from<StoreThemeVersionRow>("store_theme_versions")
    .select(STORE_THEME_VERSION_COLUMNS)
    .eq("id", versionId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as StoreThemeVersionRow | null;
};

const loadStoreThemeStateRow = async (storeId: string): Promise<StoreThemeStateRow | null> => {
  const { data, error } = await themeStateDb
    .from<StoreThemeStateRow>("store_theme_states")
    .select(STORE_THEME_STATE_COLUMNS)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as StoreThemeStateRow | null;
};

const loadNormalizedStoreThemeState = async (storeId: string): Promise<StoreThemeState | null> => {
  const state = await loadStoreThemeStateRow(storeId);
  if (!state) return null;

  const publishedVersion = await loadPublishedVersion(state.published_version_id);
  return toPublicState(state, publishedVersion);
};

export const loadStoreThemeState = async (storeId: string): Promise<StoreThemeState | null> => {
  return loadNormalizedStoreThemeState(storeId);
};

export const saveDraftThemeState = async ({
  storeId,
  themeId,
  themeVersion,
  settings,
  pageLayout = {},
  initialPublishedThemeId = "default",
  initialPublishedThemeVersion = null,
  initialPublishedSettings = {},
  initialPublishedPageLayout = {},
}: {
  storeId: string;
  themeId: string;
  themeVersion: string | null;
  settings: Record<string, unknown>;
  pageLayout?: Record<string, unknown>;
  initialPublishedThemeId?: string;
  initialPublishedThemeVersion?: string | null;
  initialPublishedSettings?: Record<string, unknown>;
  initialPublishedPageLayout?: Record<string, unknown>;
}): Promise<StoreThemeState> => {
  const draftPatch = {
    draft_theme_id: themeId,
    draft_theme_version: themeVersion,
    draft_settings: settings,
    draft_layout: pageLayout,
    draft_assets: {},
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await themeStateDb
    .from<StoreThemeStateRow>("store_theme_states")
    .update(draftPatch)
    .eq("store_id", storeId)
    .select(STORE_THEME_STATE_COLUMNS)
    .maybeSingle();

  if (updateError) throw updateError;
  if (updated) {
    const publishedVersion = await loadPublishedVersion((updated as StoreThemeStateRow).published_version_id);
    return toPublicState(updated as StoreThemeStateRow, publishedVersion);
  }

  const { data: inserted, error: insertError } = await themeStateDb
    .from<StoreThemeStateRow>("store_theme_states")
    .insert({
      store_id: storeId,
      ...draftPatch,
    })
    .select(STORE_THEME_STATE_COLUMNS)
    .single();

  if (insertError) throw insertError;
  return toPublicState(inserted as StoreThemeStateRow, null);
};

export const publishDraftThemeState = async (storeId: string): Promise<StoreThemeState> => {
  const { data, error } = await themeStateDb.rpc<StoreThemeState>("publish_store_theme_draft", {
    p_store_id: storeId,
  });

  if (error) throw error;
  return (await loadNormalizedStoreThemeState(storeId)) ?? (data as StoreThemeState);
};

export const loadStoreThemeSnapshots = async (storeId: string): Promise<StoreThemeSnapshot[]> => {
  const { data, error } = await themeStateDb
    .from<StoreThemeVersionRow[]>("store_theme_versions")
    .select(STORE_THEME_VERSION_COLUMNS)
    .eq("store_id", storeId)
    .order("version_number", { ascending: false })
    .limit(10);

  if (error) throw error;
  return ((data ?? []) as StoreThemeVersionRow[]).map((version) => ({
    id: version.id,
    store_id: version.store_id,
    version: version.version_number,
    theme_id: version.theme_id,
    theme_version: version.theme_version,
    settings: version.settings ?? emptyObject(),
    page_layout: version.layout ?? emptyObject(),
    assets: version.assets ?? emptyObject(),
    reason: version.reason ?? "publish",
    created_at: version.published_at ?? version.created_at,
    created_by: version.published_by,
  }));
};

export const rollbackStoreThemeSnapshot = async (
  storeId: string,
  snapshotId: string
): Promise<StoreThemeState> => {
  const { data, error } = await themeStateDb.rpc<StoreThemeState>("rollback_store_theme_version", {
    p_store_id: storeId,
    p_version_id: snapshotId,
    p_reason: "rollback",
  });

  if (error) throw error;
  return (await loadNormalizedStoreThemeState(storeId)) ?? (data as StoreThemeState);
};
