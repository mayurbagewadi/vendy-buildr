-- Add google_analytics_id column to platform_settings
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS google_analytics_id text;
