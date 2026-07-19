-- Public storefront bootstrap read model.
-- Combines public store config with published-only theme state so the live
-- storefront can start with one public request instead of two.
--
-- This view intentionally exposes no draft theme fields, owner IDs, secrets,
-- payment/shipping tokens, verification tokens, or admin integration state.

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
      'store_id', sts.store_id,
      'published_version_id', sts.published_version_id,
      'published_theme_id', stv.theme_id,
      'published_theme_version', stv.theme_version,
      'published_settings', stv.settings,
      'published_page_layout', stv.layout,
      'published_assets', stv.assets,
      'version', sts.publish_sequence,
      'published_at', stv.published_at
    )
  END AS theme_state
FROM public.stores s
LEFT JOIN public.store_theme_states sts ON sts.store_id = s.id
LEFT JOIN public.store_theme_versions stv ON stv.id = sts.published_version_id
WHERE s.is_active = true;

GRANT SELECT ON public.public_storefront_bootstrap TO anon, authenticated;

COMMENT ON VIEW public.public_storefront_bootstrap IS
'Single-request public storefront bootstrap config with published-only theme state. Exposes no draft/admin/private fields.';
