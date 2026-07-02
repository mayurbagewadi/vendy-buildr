-- Public storefront bootstrap read model.
-- The new storefront should read this view instead of querying raw stores rows.
-- Keep this column list intentionally narrow: no owner IDs, tokens, secrets,
-- domain verification tokens, or admin-only integration state.

CREATE OR REPLACE VIEW public.public_storefront_config
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  slug,
  subdomain,
  custom_domain,
  description,
  logo_url,
  hero_banner_url,
  hero_banner_urls,
  whatsapp_number,
  whatsapp_float_enabled,
  address,
  storefront_theme,
  storefront_color_palette,
  social_links,
  policies,
  facebook_url,
  instagram_url,
  twitter_url,
  youtube_url,
  linkedin_url,
  storefront_template,
  free_delivery_above,
  promo_bar_text,
  ai_voice_embed_code,
  alternate_names,
  seo_description,
  business_phone,
  business_email,
  street_address,
  city,
  state,
  postal_code,
  country,
  opening_hours,
  price_range,
  instagram_reels_settings,
  instagram_username,
  google_reviews_enabled,
  ga_measurement_id
FROM public.stores
WHERE is_active = true;

GRANT SELECT ON public.public_storefront_config TO anon, authenticated;

COMMENT ON VIEW public.public_storefront_config IS
'Public storefront bootstrap config for active stores. Excludes owner IDs, tokens, secrets, verification tokens, and admin-only integration data.';
