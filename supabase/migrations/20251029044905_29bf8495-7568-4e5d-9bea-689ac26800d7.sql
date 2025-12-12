-- Add new column for multiple hero banner URLs
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS hero_banner_urls text[] DEFAULT ARRAY[]::text[];

-- Migrate existing hero_banner_url data to the new array column
UPDATE stores 
SET hero_banner_urls = ARRAY[hero_banner_url]::text[]
WHERE hero_banner_url IS NOT NULL AND hero_banner_url != '';

-- Keep the old column for backward compatibility but we'll primarily use the new one
COMMENT ON COLUMN stores.hero_banner_urls IS 'Array of hero banner URLs for carousel display';