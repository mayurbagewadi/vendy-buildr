-- Allow anonymous users to read support_whatsapp_number from platform_settings
-- This enables the landing page WhatsApp button to display on mobile devices
CREATE POLICY "Anyone can read support_whatsapp_number"
  ON public.platform_settings FOR SELECT
  TO anon
  USING (true);
