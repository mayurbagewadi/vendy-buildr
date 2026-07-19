-- Backfill existing stores into the plural runtime theme model.
-- This keeps legacy stores.* theme columns unchanged as fallback.
-- It only creates a first published runtime version when one is missing.

WITH stores_missing_published_runtime AS (
  SELECT
    s.id AS store_id,
    COALESCE(NULLIF(s.storefront_template, ''), 'default') AS legacy_template,
    COALESCE(NULLIF(s.storefront_theme, ''), 'dark') AS legacy_theme_mode,
    COALESCE(NULLIF(s.storefront_color_palette, ''), 'default') AS legacy_color_palette
  FROM public.stores s
  LEFT JOIN public.store_theme_states sts ON sts.store_id = s.id
  LEFT JOIN public.store_theme_versions stv ON stv.id = sts.published_version_id
  WHERE stv.id IS NULL
),
runtime_seed AS (
  SELECT
    store_id,
    CASE
      WHEN legacy_template IN ('ecosoap-boutique', 'playful') THEN 'ecosoap-boutique'
      ELSE 'default'
    END AS theme_id,
    CASE
      WHEN legacy_template IN ('ecosoap-boutique', 'playful') THEN '1.0.0'
      ELSE NULL
    END AS theme_version,
    jsonb_build_object(
      'legacy_storefront_template', legacy_template,
      'legacy_storefront_theme', legacy_theme_mode,
      'legacy_storefront_color_palette', legacy_color_palette
    ) AS settings
  FROM stores_missing_published_runtime
),
runtime_seed_with_version AS (
  SELECT
    seed.*,
    COALESCE(existing_versions.max_version_number, 0) + 1 AS version_number
  FROM runtime_seed seed
  LEFT JOIN LATERAL (
    SELECT MAX(version_number) AS max_version_number
    FROM public.store_theme_versions versions
    WHERE versions.store_id = seed.store_id
  ) existing_versions ON true
),
inserted_versions AS (
  INSERT INTO public.store_theme_versions (
    store_id,
    version_number,
    theme_id,
    theme_version,
    settings,
    layout,
    assets,
    reason
  )
  SELECT
    store_id,
    version_number,
    theme_id,
    theme_version,
    settings,
    '{}'::jsonb,
    '{}'::jsonb,
    'legacy-backfill'
  FROM runtime_seed_with_version
  ON CONFLICT (store_id, version_number) DO NOTHING
  RETURNING
    id,
    store_id,
    version_number,
    theme_id,
    theme_version,
    settings
)
INSERT INTO public.store_theme_states (
  store_id,
  draft_theme_id,
  draft_theme_version,
  draft_settings,
  draft_layout,
  draft_assets,
  published_version_id,
  publish_sequence
)
SELECT
  store_id,
  theme_id,
  theme_version,
  settings,
  '{}'::jsonb,
  '{}'::jsonb,
  id,
  version_number
FROM inserted_versions
ON CONFLICT (store_id) DO UPDATE
SET
  published_version_id = EXCLUDED.published_version_id,
  publish_sequence = GREATEST(public.store_theme_states.publish_sequence, EXCLUDED.publish_sequence),
  updated_at = NOW();

COMMENT ON TABLE public.store_theme_states IS
'Current draft pointer and published version pointer for runtime storefront themes. Legacy stores.* theme columns remain fallback only.';

COMMENT ON TABLE public.store_theme_versions IS
'Immutable published runtime theme snapshots used for live storefront reads and rollback history.';
