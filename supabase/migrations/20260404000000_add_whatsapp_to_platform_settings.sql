-- Add WhatsApp support number to platform_settings for the landing page button
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS support_whatsapp_number text DEFAULT '';
