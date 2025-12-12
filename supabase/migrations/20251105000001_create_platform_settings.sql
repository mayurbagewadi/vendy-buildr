-- Create platform_settings table for storing global platform configuration
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Email settings
  sender_email text,
  sender_name text,
  platform_name text,

  -- Cleanup settings
  auto_cleanup_orders boolean DEFAULT false,
  orders_cleanup_months integer DEFAULT 6,
  auto_cleanup_active_logs boolean DEFAULT false,
  active_logs_cleanup_months integer DEFAULT 6,
  auto_cleanup_inactive_logs boolean DEFAULT false,
  inactive_logs_cleanup_months integer DEFAULT 6,

  -- Razorpay settings
  razorpay_key_id text,
  razorpay_key_secret text, -- This will be encrypted at application level
  razorpay_test_mode boolean DEFAULT false,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Ensure only one row exists (singleton pattern)
  CONSTRAINT single_row_constraint CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_id ON public.platform_settings(id);

-- Insert default settings row with the fixed UUID
INSERT INTO public.platform_settings (
  id,
  sender_email,
  sender_name,
  platform_name,
  auto_cleanup_orders,
  orders_cleanup_months,
  auto_cleanup_active_logs,
  active_logs_cleanup_months,
  auto_cleanup_inactive_logs,
  inactive_logs_cleanup_months,
  razorpay_test_mode
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'onboarding@resend.dev',
  'Super Admin',
  'Vendy Platform',
  false,
  6,
  false,
  6,
  false,
  6,
  false
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only super admins can read platform settings
CREATE POLICY "Super admins can read platform settings"
  ON public.platform_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Policy: Only super admins can update platform settings
CREATE POLICY "Super admins can update platform settings"
  ON public.platform_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_platform_settings_updated_at_trigger
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();

-- Add comments
COMMENT ON TABLE public.platform_settings IS 'Global platform configuration settings (singleton table)';
COMMENT ON COLUMN public.platform_settings.razorpay_key_secret IS 'Razorpay API Secret Key - should be encrypted at application level';
COMMENT ON CONSTRAINT single_row_constraint ON public.platform_settings IS 'Ensures only one settings row exists';
