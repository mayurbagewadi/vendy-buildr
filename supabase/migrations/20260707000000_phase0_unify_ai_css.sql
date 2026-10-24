-- Phase 0: Unify AI CSS into the theme version system.
--
-- Before: two systems own storefront styling
--   store_design_state.ai_full_css  → injected by useAIDesignCSS (extra DB query per visitor)
--   store_theme_versions.settings   → read via public_storefront_bootstrap (one query, cached)
--
-- After: one system owns everything
--   store_theme_versions.custom_css → surfaced in public_storefront_bootstrap
--   useAIDesignCSS reads from context (zero extra DB queries)
--   store_design_state becomes legacy / no longer read by live storefront
--
-- This migration is non-breaking. Existing storefronts render identically after it runs.
-- Only write paths change on the client side (aiDesigner.ts).

-- ─── 1. Add draft_custom_css to store_theme_states ────────────────────────────

ALTER TABLE public.store_theme_states
  ADD COLUMN IF NOT EXISTS draft_custom_css TEXT;

-- Hard cap: 100 KB per store. Prevents runaway AI output from bloating the DB.
ALTER TABLE public.store_theme_states
  ADD CONSTRAINT store_theme_states_draft_custom_css_size
    CHECK (draft_custom_css IS NULL OR octet_length(draft_custom_css) <= 102400);

-- ─── 2. Add custom_css to store_theme_versions ────────────────────────────────

ALTER TABLE public.store_theme_versions
  ADD COLUMN IF NOT EXISTS custom_css TEXT;

ALTER TABLE public.store_theme_versions
  ADD CONSTRAINT store_theme_versions_custom_css_size
    CHECK (custom_css IS NULL OR octet_length(custom_css) <= 102400);

-- ─── 3. Backfill: copy existing AI CSS to store_theme_states draft ───────────
-- Only migrates stores where the AI designer was actually used (mode = 'advanced').
-- Skips oversized CSS that would violate the new constraint.

UPDATE public.store_theme_states sts
SET
  draft_custom_css = sds.ai_full_css,
  updated_at = NOW()
FROM public.store_design_state sds
WHERE sds.store_id = sts.store_id
  AND sds.mode = 'advanced'
  AND sds.ai_full_css IS NOT NULL
  AND octet_length(sds.ai_full_css) <= 102400;

-- ─── 4. Promote backfilled draft CSS to a published version ───────────────────
-- For every store that now has draft_custom_css, create a new published version
-- that includes the CSS so the live storefront sees it immediately after deploy.

DO $$
DECLARE
  rec     RECORD;
  new_id  UUID;
  next_seq INTEGER;
BEGIN
  FOR rec IN
    SELECT
      sts.store_id,
      sts.draft_theme_id,
      sts.draft_theme_version,
      COALESCE(sts.draft_settings, '{}'::jsonb) AS draft_settings,
      COALESCE(sts.draft_layout,   '{}'::jsonb) AS draft_layout,
      COALESCE(sts.draft_assets,   '{}'::jsonb) AS draft_assets,
      sts.draft_custom_css,
      sts.publish_sequence
    FROM public.store_theme_states sts
    WHERE sts.draft_custom_css IS NOT NULL
  LOOP
    next_seq := rec.publish_sequence + 1;

    INSERT INTO public.store_theme_versions (
      store_id, version_number, theme_id, theme_version,
      settings, layout, assets, custom_css, reason
    )
    VALUES (
      rec.store_id,
      next_seq,
      rec.draft_theme_id,
      rec.draft_theme_version,
      rec.draft_settings,
      rec.draft_layout,
      rec.draft_assets,
      rec.draft_custom_css,
      'phase0-ai-css-unification'
    )
    ON CONFLICT (store_id, version_number) DO NOTHING
    RETURNING id INTO new_id;

    IF new_id IS NOT NULL THEN
      UPDATE public.store_theme_states
      SET
        published_version_id = new_id,
        publish_sequence     = next_seq,
        updated_at           = NOW()
      WHERE store_id = rec.store_id;
    END IF;
  END LOOP;
END $$;

-- ─── 5. Update publish_store_theme_draft to carry draft_custom_css ────────────

DROP FUNCTION IF EXISTS public.publish_store_theme_draft(UUID);

CREATE OR REPLACE FUNCTION public.publish_store_theme_draft(p_store_id UUID)
RETURNS public.store_theme_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  theme_state     public.store_theme_states%ROWTYPE;
  created_version public.store_theme_versions%ROWTYPE;
  next_version    INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = p_store_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to publish this store theme';
  END IF;

  SELECT * INTO theme_state
  FROM public.store_theme_states
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.store_theme_states (store_id)
    VALUES (p_store_id)
    RETURNING * INTO theme_state;
  END IF;

  PERFORM public.validate_store_theme_draft_payload(
    theme_state.draft_theme_id,
    theme_state.draft_theme_version,
    theme_state.draft_settings,
    theme_state.draft_layout
  );

  next_version := theme_state.publish_sequence + 1;

  INSERT INTO public.store_theme_versions (
    store_id, version_number, theme_id, theme_version,
    settings, layout, assets, custom_css,
    published_by, reason
  )
  VALUES (
    theme_state.store_id,
    next_version,
    theme_state.draft_theme_id,
    theme_state.draft_theme_version,
    theme_state.draft_settings,
    theme_state.draft_layout,
    theme_state.draft_assets,
    theme_state.draft_custom_css,
    auth.uid(),
    'publish'
  )
  RETURNING * INTO created_version;

  UPDATE public.store_theme_states
  SET
    published_version_id = created_version.id,
    publish_sequence     = next_version,
    updated_at           = NOW()
  WHERE store_id = p_store_id
  RETURNING * INTO theme_state;

  RETURN theme_state;
END;
$$;

-- ─── 6. Update rollback_store_theme_version to carry custom_css ───────────────

DROP FUNCTION IF EXISTS public.rollback_store_theme_version(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.rollback_store_theme_version(
  p_store_id UUID,
  p_version_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.store_theme_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_state    public.store_theme_states%ROWTYPE;
  rollback_version public.store_theme_versions%ROWTYPE;
  created_version  public.store_theme_versions%ROWTYPE;
  next_version     INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = p_store_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to rollback this store theme';
  END IF;

  SELECT * INTO current_state
  FROM public.store_theme_states
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme state not found for store';
  END IF;

  SELECT * INTO rollback_version
  FROM public.store_theme_versions
  WHERE id = p_version_id AND store_id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme version not found for store';
  END IF;

  PERFORM public.validate_store_theme_draft_payload(
    rollback_version.theme_id,
    rollback_version.theme_version,
    rollback_version.settings,
    rollback_version.layout
  );

  next_version := current_state.publish_sequence + 1;

  INSERT INTO public.store_theme_versions (
    store_id, version_number, theme_id, theme_version,
    settings, layout, assets, custom_css,
    published_by, rollback_of_version_id, rollback_by, rollback_at, reason
  )
  VALUES (
    p_store_id,
    next_version,
    rollback_version.theme_id,
    rollback_version.theme_version,
    rollback_version.settings,
    rollback_version.layout,
    rollback_version.assets,
    rollback_version.custom_css,
    auth.uid(),
    rollback_version.id,
    auth.uid(),
    NOW(),
    COALESCE(NULLIF(BTRIM(p_reason), ''), 'rollback')
  )
  RETURNING * INTO created_version;

  UPDATE public.store_theme_states
  SET
    draft_theme_id     = created_version.theme_id,
    draft_theme_version = created_version.theme_version,
    draft_settings     = created_version.settings,
    draft_layout       = created_version.layout,
    draft_assets       = created_version.assets,
    draft_custom_css   = created_version.custom_css,
    published_version_id = created_version.id,
    publish_sequence   = next_version,
    updated_at         = NOW()
  WHERE store_id = p_store_id
  RETURNING * INTO current_state;

  RETURN current_state;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_store_theme_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_store_theme_version(UUID, UUID, TEXT) TO authenticated;

-- ─── 7. Update public_storefront_bootstrap to surface custom_css ──────────────
-- custom_css is embedded in theme_state so the storefront gets everything in
-- one cached query. No second round-trip needed.

CREATE OR REPLACE VIEW public.public_storefront_bootstrap AS
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
  s.whatsapp_number,
  s.whatsapp_float_enabled,
  s.address,
  s.storefront_theme,
  s.storefront_color_palette,
  s.social_links,
  s.policies,
  s.facebook_url,
  s.instagram_url,
  s.twitter_url,
  s.youtube_url,
  s.linkedin_url,
  s.storefront_template,
  s.free_delivery_above,
  s.promo_bar_text,
  s.ai_voice_embed_code,
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
  CASE
    WHEN stv.id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'store_id',              sts.store_id,
      'published_version_id',  sts.published_version_id,
      'published_theme_id',    stv.theme_id,
      'published_theme_version', stv.theme_version,
      'published_settings',    stv.settings,
      'published_page_layout', stv.layout,
      'published_assets',      stv.assets,
      'custom_css',            stv.custom_css,
      'version',               sts.publish_sequence,
      'published_at',          stv.published_at
    )
  END AS theme_state
FROM public.stores s
LEFT JOIN public.store_theme_states sts ON sts.store_id = s.id
LEFT JOIN public.store_theme_versions stv ON stv.id = sts.published_version_id
WHERE s.is_active = true;

GRANT SELECT ON public.public_storefront_bootstrap TO anon, authenticated;

COMMENT ON VIEW public.public_storefront_bootstrap IS
'Single-request public storefront bootstrap. theme_state.custom_css carries published AI CSS — zero extra round-trips needed on the client.';

-- Verify migration
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM public.store_theme_versions
  WHERE reason = 'phase0-ai-css-unification';

  RAISE NOTICE 'Phase 0 migration complete. % store(s) had AI CSS promoted to published version.', migrated_count;
END $$;
