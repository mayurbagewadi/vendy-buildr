-- Create marketplace_features table (managed by superadmin)
CREATE TABLE IF NOT EXISTS marketplace_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Package',
  is_free BOOLEAN DEFAULT true,
  price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  menu_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add enabled_features column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS enabled_features TEXT[] DEFAULT '{}';

-- Enable RLS
ALTER TABLE marketplace_features ENABLE ROW LEVEL SECURITY;

-- Superadmin can do everything
CREATE POLICY "Superadmin full access to marketplace_features"
  ON marketplace_features
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Everyone can read active features
CREATE POLICY "Anyone can read active marketplace_features"
  ON marketplace_features
  FOR SELECT
  USING (is_active = true);

-- Insert default Shipping feature
INSERT INTO marketplace_features (name, slug, description, icon, is_free, price, is_active, menu_order)
VALUES (
  'Shipping',
  'shipping',
  'Integrate Shiprocket for seamless order shipping, tracking, and delivery management.',
  'Truck',
  true,
  0,
  true,
  1
) ON CONFLICT (slug) DO NOTHING;
