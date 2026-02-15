-- ============================================
-- AI Designer System Migration
-- ============================================

-- 1. Add OpenRouter API Key to Platform Settings
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;

-- ============================================
-- 2. AI Token Packages Table (Super Admin Controls Pricing)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_token_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tokens_included INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO ai_token_packages (name, description, tokens_included, price, display_order) VALUES
('Basic', '100 AI design generations', 100, 199.00, 1),
('Pro', '500 AI design generations', 500, 799.00, 2),
('Enterprise', '2000 AI design generations', 2000, 2499.00, 3)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. AI Token Settings Table (Super Admin Controls Expiry)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_token_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  token_expiry_enabled BOOLEAN DEFAULT true,
  token_expiry_duration INTEGER DEFAULT 12,
  token_expiry_unit TEXT DEFAULT 'months',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO ai_token_settings (id, token_expiry_enabled, token_expiry_duration, token_expiry_unit)
VALUES ('00000000-0000-0000-0000-000000000001', true, 12, 'months')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. AI Token Purchases Table (Per Store)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_token_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES ai_token_packages(id),
  tokens_purchased INTEGER NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  tokens_remaining INTEGER NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_id TEXT,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. AI Designer History Table
-- ============================================
CREATE TABLE IF NOT EXISTS ai_designer_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  ai_response JSONB NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 1,
  applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. Store Design State Table (Current Applied Design)
-- Reset = delete this row → store falls back to hardcoded platform default
-- ============================================
CREATE TABLE IF NOT EXISTS store_design_state (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  current_design JSONB,
  last_applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. RLS Policies
-- ============================================

-- ai_token_packages
ALTER TABLE ai_token_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active token packages"
  ON ai_token_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admin can manage token packages"
  ON ai_token_packages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ai_token_settings
ALTER TABLE ai_token_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read token settings"
  ON ai_token_settings FOR SELECT
  USING (true);

CREATE POLICY "Super admin can manage token settings"
  ON ai_token_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ai_token_purchases
ALTER TABLE ai_token_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view their own token purchases"
  ON ai_token_purchases FOR SELECT
  USING (
    store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
  );

CREATE POLICY "Store owners can insert their own token purchases"
  ON ai_token_purchases FOR INSERT
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
  );

CREATE POLICY "Super admin can view all token purchases"
  ON ai_token_purchases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- ai_designer_history
ALTER TABLE ai_designer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view their own ai designer history"
  ON ai_designer_history FOR SELECT
  USING (
    store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
  );

CREATE POLICY "Store owners can insert their own ai designer history"
  ON ai_designer_history FOR INSERT
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
  );

-- store_design_state
ALTER TABLE store_design_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage their own design state"
  ON store_design_state FOR ALL
  USING (
    store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
  );

CREATE POLICY "Public can read store design state"
  ON store_design_state FOR SELECT
  USING (true);

-- ============================================
-- 8. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ai_token_purchases_store ON ai_token_purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_purchases_status ON ai_token_purchases(status);
CREATE INDEX IF NOT EXISTS idx_ai_token_purchases_expires ON ai_token_purchases(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_designer_history_store ON ai_designer_history(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_designer_history_created ON ai_designer_history(created_at DESC);
