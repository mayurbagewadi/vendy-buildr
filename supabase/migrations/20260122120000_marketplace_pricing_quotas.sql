-- Add pricing model and quota columns to marketplace_features
ALTER TABLE marketplace_features ADD COLUMN IF NOT EXISTS pricing_model TEXT DEFAULT 'onetime'; -- 'onetime', 'monthly', 'yearly', 'mixed'
ALTER TABLE marketplace_features ADD COLUMN IF NOT EXISTS price_onetime DECIMAL(10,2) DEFAULT 0;
ALTER TABLE marketplace_features ADD COLUMN IF NOT EXISTS price_monthly DECIMAL(10,2) DEFAULT 0;
ALTER TABLE marketplace_features ADD COLUMN IF NOT EXISTS price_yearly DECIMAL(10,2) DEFAULT 0;
ALTER TABLE marketplace_features ADD COLUMN IF NOT EXISTS quota_onetime INTEGER DEFAULT 15;
ALTER TABLE marketplace_features ADD COLUMN IF NOT EXISTS quota_monthly INTEGER DEFAULT 30;
ALTER TABLE marketplace_features ADD COLUMN IF NOT EXISTS quota_yearly INTEGER DEFAULT 50;
ALTER TABLE marketplace_features ADD COLUMN IF NOT EXISTS quota_period TEXT DEFAULT 'monthly'; -- 'monthly' or 'yearly'

-- Create marketplace_purchases table to track who bought what
CREATE TABLE IF NOT EXISTS marketplace_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  feature_slug TEXT NOT NULL,
  pricing_type TEXT NOT NULL, -- 'onetime', 'monthly', 'yearly'
  amount_paid DECIMAL(10,2) NOT NULL,
  quota_limit INTEGER DEFAULT 15,
  calls_used INTEGER DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'cancelled'
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL for onetime, date for subscriptions
  auto_renew BOOLEAN DEFAULT false,
  payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, feature_slug)
);

-- Enable RLS
ALTER TABLE marketplace_purchases ENABLE ROW LEVEL SECURITY;

-- Store owners can view their own purchases
CREATE POLICY "Store owners can view their own purchases"
  ON marketplace_purchases
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Store owners can insert their own purchases
CREATE POLICY "Store owners can insert their own purchases"
  ON marketplace_purchases
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE user_id = auth.uid()
    )
  );

-- Super admin can view all purchases
CREATE POLICY "Super admin can view all purchases"
  ON marketplace_purchases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_store_feature ON marketplace_purchases(store_id, feature_slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_user ON marketplace_purchases(user_id);

-- Update Google Reviews entry with mixed pricing model
UPDATE marketplace_features
SET
  pricing_model = 'mixed',
  price_onetime = 199,
  price_monthly = 50,
  price_yearly = 500,
  quota_onetime = 15,
  quota_monthly = 30,
  quota_yearly = 50,
  quota_period = 'monthly'
WHERE slug = 'google-reviews';

-- Remove old columns from stores (keep for backward compatibility, will deprecate later)
-- ALTER TABLE stores DROP COLUMN IF EXISTS google_reviews_calls_used;
-- ALTER TABLE stores DROP COLUMN IF EXISTS google_reviews_last_reset;
