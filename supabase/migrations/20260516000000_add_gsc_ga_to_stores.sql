-- Add Google Search Console OAuth columns and GA Measurement ID to stores table
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS gsc_access_token TEXT,
  ADD COLUMN IF NOT EXISTS gsc_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS gsc_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ga_measurement_id TEXT;
