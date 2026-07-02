-- ============================================
-- Store Theme State
-- Draft / publish / rollback foundation for runtime storefront themes.
-- ============================================

CREATE TABLE IF NOT EXISTS public.store_theme_state (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  draft_theme_id TEXT NOT NULL DEFAULT 'default',
  draft_theme_version TEXT,
  draft_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_page_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_updated_at TIMESTAMP WITH TIME ZONE,
  published_theme_id TEXT NOT NULL DEFAULT 'default',
  published_theme_version TEXT,
  published_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_page_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.store_theme_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  theme_id TEXT NOT NULL,
  theme_version TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL DEFAULT 'publish',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.store_theme_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_theme_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage their own theme state"
  ON public.store_theme_state
  FOR ALL
  USING (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  );

CREATE POLICY "Store owners can read their own theme snapshots"
  ON public.store_theme_snapshots
  FOR SELECT
  USING (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  );

CREATE POLICY "Store owners can create their own theme snapshots"
  ON public.store_theme_snapshots
  FOR INSERT
  WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_store_theme_state_updated_at
  ON public.store_theme_state(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_theme_state_published_theme
  ON public.store_theme_state(published_theme_id, published_theme_version);

CREATE INDEX IF NOT EXISTS idx_store_theme_snapshots_store_version
  ON public.store_theme_snapshots(store_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_store_theme_snapshots_created_at
  ON public.store_theme_snapshots(created_at DESC);

-- Published-only public read model. This intentionally exposes no draft fields.
-- It is a narrow public read model, not a general table access path.
CREATE OR REPLACE VIEW public.public_storefront_theme_state AS
SELECT
  sts.store_id,
  sts.published_theme_id,
  sts.published_theme_version,
  sts.published_settings,
  sts.published_page_layout,
  sts.version,
  sts.published_at
FROM public.store_theme_state sts
JOIN public.stores s ON s.id = sts.store_id
WHERE s.is_active = true;

GRANT SELECT ON public.public_storefront_theme_state TO anon, authenticated;

-- Backfill a first published state from the legacy storefront columns.
-- Existing stores keep rendering exactly as before, but the new runtime can
-- start reading from store_theme_state immediately.
INSERT INTO public.store_theme_state (
  store_id,
  draft_theme_id,
  draft_theme_version,
  published_theme_id,
  published_theme_version,
  version,
  published_at
)
SELECT
  id,
  COALESCE(NULLIF(storefront_template, ''), 'default'),
  NULL,
  COALESCE(NULLIF(storefront_template, ''), 'default'),
  NULL,
  1,
  NOW()
FROM public.stores
ON CONFLICT (store_id) DO NOTHING;

COMMENT ON TABLE public.store_theme_state IS
'Private per-store draft and published storefront theme state. Public storefronts must read only the published read model.';

COMMENT ON TABLE public.store_theme_snapshots IS
'Append-only published theme snapshots used for rollback. Keep history as rows, not a growing JSON array.';

COMMENT ON VIEW public.public_storefront_theme_state IS
'Published-only public storefront theme state. Exposes no draft settings or admin-only data.';
