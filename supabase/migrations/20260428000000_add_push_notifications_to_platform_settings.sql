-- Add push notification columns to platform_settings (singleton table)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS push_notification_title text,
  ADD COLUMN IF NOT EXISTS push_notification_body text,
  ADD COLUMN IF NOT EXISTS push_notification_category text DEFAULT 'Feature',
  ADD COLUMN IF NOT EXISTS push_notification_version text,
  ADD COLUMN IF NOT EXISTS push_notification_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_notification_sent_at timestamp with time zone;
