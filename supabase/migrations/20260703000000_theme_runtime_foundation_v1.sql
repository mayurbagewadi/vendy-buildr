-- Theme Runtime Foundation V1.
-- Public storefronts get a safe read boundary.
-- Admin edits drafts; live storefronts read immutable published versions.
-- This migration does not touch AI Designer or payment systems.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS storefront_theme TEXT,
  ADD COLUMN IF NOT EXISTS storefront_color_palette TEXT;

CREATE TABLE IF NOT EXISTS public.store_theme_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  theme_id TEXT NOT NULL,
  theme_version TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  assets JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rollback_of_version_id UUID REFERENCES public.store_theme_versions(id) ON DELETE SET NULL,
  rollback_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rollback_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_theme_versions_theme_id_not_blank CHECK (BTRIM(theme_id) <> ''),
  CONSTRAINT store_theme_versions_version_number_positive CHECK (version_number > 0),
  CONSTRAINT store_theme_versions_settings_object CHECK (jsonb_typeof(settings) = 'object'),
  CONSTRAINT store_theme_versions_layout_object CHECK (jsonb_typeof(layout) = 'object'),
  CONSTRAINT store_theme_versions_assets_object CHECK (jsonb_typeof(assets) = 'object'),
  CONSTRAINT store_theme_versions_store_version_unique UNIQUE (store_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.store_theme_states (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  draft_theme_id TEXT NOT NULL DEFAULT 'default',
  draft_theme_version TEXT,
  draft_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_assets JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_version_id UUID REFERENCES public.store_theme_versions(id) ON DELETE SET NULL,
  publish_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_theme_states_draft_theme_id_not_blank CHECK (BTRIM(draft_theme_id) <> ''),
  CONSTRAINT store_theme_states_publish_sequence_non_negative CHECK (publish_sequence >= 0),
  CONSTRAINT store_theme_states_draft_settings_object CHECK (jsonb_typeof(draft_settings) = 'object'),
  CONSTRAINT store_theme_states_draft_layout_object CHECK (jsonb_typeof(draft_layout) = 'object'),
  CONSTRAINT store_theme_states_draft_assets_object CHECK (jsonb_typeof(draft_assets) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_store_theme_versions_store_published_at
  ON public.store_theme_versions(store_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_theme_states_published_version
  ON public.store_theme_states(published_version_id);

CREATE INDEX IF NOT EXISTS idx_products_store_category_status
  ON public.products(store_id, category, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'display_order'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_categories_store_display_order
      ON public.categories(store_id, display_order);
  END IF;
END;
$$;

ALTER TABLE public.store_theme_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_theme_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can read theme states" ON public.store_theme_states;
CREATE POLICY "Store owners can read theme states"
  ON public.store_theme_states
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_theme_states.store_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store owners can insert theme states" ON public.store_theme_states;
CREATE POLICY "Store owners can insert theme states"
  ON public.store_theme_states
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_theme_states.store_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store owners can update theme states" ON public.store_theme_states;
CREATE POLICY "Store owners can update theme states"
  ON public.store_theme_states
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_theme_states.store_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_theme_states.store_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store owners can read theme versions" ON public.store_theme_versions;
CREATE POLICY "Store owners can read theme versions"
  ON public.store_theme_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_theme_versions.store_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store owners can insert theme versions" ON public.store_theme_versions;
CREATE POLICY "Store owners can insert theme versions"
  ON public.store_theme_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = store_theme_versions.store_id
        AND s.user_id = auth.uid()
    )
  );

DROP VIEW IF EXISTS public.public_storefront_config;
CREATE VIEW public.public_storefront_config AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.subdomain,
  s.custom_domain,
  s.description,
  s.logo_url,
  s.hero_banner_url,
  s.hero_banner_urls,
  s.ai_voice_embed_code,
  s.whatsapp_number,
  s.whatsapp_float_enabled,
  s.address,
  s.social_links,
  s.policies,
  s.facebook_url,
  s.instagram_url,
  s.twitter_url,
  s.youtube_url,
  s.linkedin_url,
  s.free_delivery_above,
  s.promo_bar_text,
  s.alternate_names,
  s.seo_description,
  s.business_phone,
  s.business_email,
  s.street_address,
  s.city,
  s.state,
  s.postal_code,
  s.country,
  s.opening_hours,
  s.price_range,
  s.instagram_reels_settings,
  s.instagram_username,
  s.google_reviews_enabled,
  s.ga_measurement_id,
  s.storefront_theme,
  s.storefront_color_palette,
  s.storefront_template,
  sts.published_version_id,
  stv.theme_id AS published_theme_id,
  stv.theme_version AS published_theme_version,
  stv.settings AS published_theme_settings,
  stv.layout AS published_theme_layout,
  stv.assets AS published_theme_assets,
  stv.published_at AS theme_published_at,
  jsonb_build_object(
    'google_reviews_enabled', COALESCE(s.google_reviews_enabled, false),
    'whatsapp_float_enabled', COALESCE(s.whatsapp_float_enabled, true)
  ) AS public_feature_flags
FROM public.stores s
LEFT JOIN public.store_theme_states sts ON sts.store_id = s.id
LEFT JOIN public.store_theme_versions stv ON stv.id = sts.published_version_id
WHERE s.is_active = true;

GRANT SELECT ON public.public_storefront_config TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.store_theme_states TO authenticated;
GRANT SELECT, INSERT ON public.store_theme_versions TO authenticated;
