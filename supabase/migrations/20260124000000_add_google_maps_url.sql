-- Add google_maps_url column to stores table for full reviews widget
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
