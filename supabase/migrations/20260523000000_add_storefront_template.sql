-- Add storefront_template column to stores table
-- Drives full page layout switching (independent of color palette)
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS storefront_template TEXT NOT NULL DEFAULT 'default';

-- Index for fast reads (theme settings page + storefront load both query this)
CREATE INDEX IF NOT EXISTS idx_stores_storefront_template ON stores (storefront_template);

COMMENT ON COLUMN stores.storefront_template IS
  'Page layout template for the customer-facing store. Values: default | playful. Drives full structural swap in Store.tsx.';
