-- Instagram Reels Feature Migration
-- Supports both automatic fetching and manual URL embedding

-- Add Instagram reels settings to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_reels_settings JSONB DEFAULT '{"enabled": false, "display_mode": "auto", "max_reels": 6, "manual_reels": [], "show_on_homepage": true, "section_title": "Follow Us on Instagram"}'::jsonb;

-- Cache table for fetched Instagram reels
CREATE TABLE IF NOT EXISTS instagram_reels_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  instagram_id TEXT NOT NULL,
  media_id TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT NOT NULL,
  caption TEXT,
  timestamp TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_instagram_reels_cache_store_id ON instagram_reels_cache(store_id);
CREATE INDEX IF NOT EXISTS idx_instagram_reels_cache_fetched_at ON instagram_reels_cache(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_reels_cache_timestamp ON instagram_reels_cache(timestamp DESC);

-- Enable RLS
ALTER TABLE instagram_reels_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy - service role full access
CREATE POLICY "Service role full access to instagram_reels_cache" ON instagram_reels_cache
  FOR ALL USING (true) WITH CHECK (true);

-- Public read access for displaying on storefront
CREATE POLICY "Public read access to instagram_reels_cache" ON instagram_reels_cache
  FOR SELECT USING (true);

-- Settings structure: enabled (bool), display_mode (auto/manual/both), max_reels (1-12), manual_reels (array), show_on_homepage (bool), section_title (string)
