-- Allow authenticated users to read public-safe platform settings fields
-- (razorpay_key_id is public-safe — it's a publishable key, not a secret)
CREATE POLICY "Authenticated users can read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);
