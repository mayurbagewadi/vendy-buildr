-- Add delivery mode and tiered rules to stores table
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS delivery_tiers JSONB DEFAULT NULL;
