-- Add Google Sheets columns to platform_settings for superadmin store tracker
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS superadmin_google_access_token TEXT,
ADD COLUMN IF NOT EXISTS superadmin_google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS superadmin_google_token_expiry TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS superadmin_google_sheet_id TEXT,
ADD COLUMN IF NOT EXISTS superadmin_google_sheet_url TEXT;

COMMENT ON COLUMN public.platform_settings.superadmin_google_access_token IS 'Google OAuth access token for superadmin Sheets sync — encrypted at app level';
COMMENT ON COLUMN public.platform_settings.superadmin_google_refresh_token IS 'Google OAuth refresh token for superadmin Sheets sync';
COMMENT ON COLUMN public.platform_settings.superadmin_google_sheet_id IS 'Master Google Sheet ID for all-stores tracker';
COMMENT ON COLUMN public.platform_settings.superadmin_google_sheet_url IS 'Full URL of the master stores tracker sheet';
