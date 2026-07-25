-- Add Delhivery as a separate installable marketplace plugin.
-- The legacy "shipping" slug remains Shiprocket-backed for existing stores.

UPDATE marketplace_features
SET
  name = 'Shiprocket Shipping',
  description = 'Connect Shiprocket for order shipping, tracking, and delivery management.'
WHERE slug = 'shipping'
  AND name = 'Shipping';

INSERT INTO marketplace_features (
  name,
  slug,
  description,
  icon,
  item_type,
  is_free,
  price,
  is_active,
  menu_order
)
VALUES (
  'Delhivery Shipping',
  'delhivery',
  'Connect Delhivery with a secure API token for store-level shipping automation.',
  'Truck',
  'plugin',
  true,
  0,
  true,
  3
)
ON CONFLICT (slug) DO NOTHING;

UPDATE stores
SET enabled_features = array_append(COALESCE(enabled_features, '{}'::text[]), 'delhivery')
WHERE EXISTS (
  SELECT 1
  FROM store_shipping_integrations
  WHERE store_shipping_integrations.store_id = stores.id
    AND store_shipping_integrations.provider = 'delhivery'
)
AND NOT ('delhivery' = ANY(COALESCE(enabled_features, '{}'::text[])));
