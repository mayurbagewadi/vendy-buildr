-- Add missing social media columns to stores table
-- youtube_url and linkedin_url were missing from the initial SEO migration

ALTER TABLE stores ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN stores.youtube_url IS 'YouTube channel URL for SEO and store display';
COMMENT ON COLUMN stores.linkedin_url IS 'LinkedIn company page URL for SEO and store display';
