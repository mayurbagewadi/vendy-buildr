-- Add google_reviews_display_type column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_reviews_display_type TEXT DEFAULT 'carousel' CHECK (google_reviews_display_type IN ('carousel', 'column'));
