-- Add SEO columns to stores table
-- These columns store SEO and schema markup data for better Google search visibility

-- Alternate names for the store (comma-separated)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS alternate_names TEXT;

-- SEO description (meta description)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- Business contact information
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_phone TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_email TEXT;

-- Business address
ALTER TABLE stores ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'IN';

-- Business hours
ALTER TABLE stores ADD COLUMN IF NOT EXISTS opening_hours TEXT;

-- Social media links
ALTER TABLE stores ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS twitter_url TEXT;

-- Price range indicator
ALTER TABLE stores ADD COLUMN IF NOT EXISTS price_range TEXT DEFAULT '₹₹';

-- Add comment for documentation
COMMENT ON COLUMN stores.alternate_names IS 'Comma-separated alternative names for SEO (e.g., "Sasu Masale, SasuMasaale")';
COMMENT ON COLUMN stores.seo_description IS 'Meta description for search engines (max 160 chars recommended)';
COMMENT ON COLUMN stores.price_range IS 'Price range indicator: ₹, ₹₹, ₹₹₹, or ₹₹₹₹';
