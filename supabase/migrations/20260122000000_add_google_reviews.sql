-- Create google_reviews_cache table
CREATE TABLE IF NOT EXISTS google_reviews_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  google_place_id TEXT NOT NULL,
  average_rating DECIMAL(2,1),
  total_reviews INTEGER DEFAULT 0,
  reviews JSONB DEFAULT '[]'::jsonb, -- [{author_name, rating, text, time, profile_photo_url, relative_time_description}]
  last_fetched TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id)
);

-- Add Google Reviews columns to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_reviews_enabled BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE google_reviews_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_reviews_cache
-- Store owners can read their own reviews
CREATE POLICY "Store owners can view their own reviews"
  ON google_reviews_cache
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Store owners can update their own reviews
CREATE POLICY "Store owners can update their own reviews"
  ON google_reviews_cache
  FOR ALL
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Public can read reviews for active stores
CREATE POLICY "Public can read reviews for active stores"
  ON google_reviews_cache
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE is_active = true
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_reviews_cache_store_id ON google_reviews_cache(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_google_place_id ON stores(google_place_id);

-- Add Google Reviews to marketplace_features with price
INSERT INTO marketplace_features (name, slug, description, icon, is_free, price, is_active, menu_order)
VALUES (
  'Google Reviews',
  'google-reviews',
  'Display Google reviews on your store to build trust and credibility with customers. Reviews cached daily to minimize costs.',
  'Star',
  false,
  199,
  true,
  2
) ON CONFLICT (slug) DO NOTHING;
