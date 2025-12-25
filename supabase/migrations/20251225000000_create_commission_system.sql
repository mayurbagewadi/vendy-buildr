-- =====================================================
-- HELPER COMMISSION SYSTEM - DATABASE SCHEMA
-- Created: 2025-12-25
-- Purpose: Manage helper commissions for network and direct sales
-- =====================================================

-- =====================================================
-- 1. MAIN COMMISSION SETTINGS TABLE (Versioned)
-- Stores all commission configurations with versioning
-- =====================================================
CREATE TABLE IF NOT EXISTS public.commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Feature Toggles
  enable_multi_tier BOOLEAN DEFAULT true NOT NULL,
  auto_approve_applications BOOLEAN DEFAULT false NOT NULL,
  send_welcome_email BOOLEAN DEFAULT true NOT NULL,
  send_commission_notifications BOOLEAN DEFAULT true NOT NULL,

  -- Payment Settings
  min_payout_threshold DECIMAL(10,2) DEFAULT 500.00 NOT NULL,
  payment_schedule VARCHAR(20) DEFAULT 'monthly' NOT NULL,
  payment_day VARCHAR(20) DEFAULT '1st' NOT NULL,

  -- Recruitment Settings
  max_helpers_per_recruiter INTEGER DEFAULT -1 NOT NULL, -- -1 = unlimited
  referral_code_prefix VARCHAR(10) DEFAULT 'HELP' NOT NULL,
  auto_generate_codes BOOLEAN DEFAULT true NOT NULL,

  CONSTRAINT valid_payment_schedule CHECK (payment_schedule IN ('weekly', 'biweekly', 'monthly')),
  CONSTRAINT valid_payout_threshold CHECK (min_payout_threshold >= 0),
  CONSTRAINT valid_max_helpers CHECK (max_helpers_per_recruiter >= -1)
);

-- Only one active setting at a time
CREATE UNIQUE INDEX idx_active_commission_settings
  ON public.commission_settings(is_active)
  WHERE is_active = true;

COMMENT ON TABLE public.commission_settings IS 'Versioned commission settings - one active version at a time';
COMMENT ON COLUMN public.commission_settings.version IS 'Increments with each save - allows rollback';
COMMENT ON COLUMN public.commission_settings.max_helpers_per_recruiter IS '-1 means unlimited recruitment';

-- =====================================================
-- 2. NETWORK COMMISSION CONFIG (Helper → Helper)
-- Multi-tier recruitment commissions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.network_commission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id UUID REFERENCES public.commission_settings(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Subscription type
  subscription_type VARCHAR(10) NOT NULL, -- 'monthly' or 'yearly'

  -- Commission model
  commission_model VARCHAR(10) NOT NULL, -- 'onetime', 'recurring', 'hybrid'

  -- One-time commission
  onetime_type VARCHAR(10), -- 'percentage' or 'fixed'
  onetime_value DECIMAL(10,2) DEFAULT 0,

  -- Recurring commission
  recurring_type VARCHAR(10), -- 'percentage' or 'fixed'
  recurring_value DECIMAL(10,2) DEFAULT 0,
  recurring_duration INTEGER DEFAULT 12,

  CONSTRAINT valid_subscription_type CHECK (subscription_type IN ('monthly', 'yearly')),
  CONSTRAINT valid_commission_model CHECK (commission_model IN ('onetime', 'recurring', 'hybrid')),
  CONSTRAINT valid_onetime_type CHECK (onetime_type IN ('percentage', 'fixed', NULL)),
  CONSTRAINT valid_recurring_type CHECK (recurring_type IN ('percentage', 'fixed', NULL)),
  CONSTRAINT valid_percentages CHECK (
    (onetime_type != 'percentage' OR (onetime_value >= 0 AND onetime_value <= 100)) AND
    (recurring_type != 'percentage' OR (recurring_value >= 0 AND recurring_value <= 100))
  ),
  CONSTRAINT valid_values CHECK (onetime_value >= 0 AND recurring_value >= 0),
  CONSTRAINT valid_duration CHECK (recurring_duration > 0 AND recurring_duration <= 24)
);

-- One config per (settings_id, subscription_type)
CREATE UNIQUE INDEX idx_network_commission_unique
  ON public.network_commission(settings_id, subscription_type);

COMMENT ON TABLE public.network_commission IS 'Commission for helper recruiting another helper (network)';

-- =====================================================
-- 3. PLAN COMMISSION CONFIG (Helper → Store Owner)
-- Direct sales commissions per subscription plan
-- =====================================================
CREATE TABLE IF NOT EXISTS public.plan_commission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id UUID REFERENCES public.commission_settings(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Subscription type
  subscription_type VARCHAR(10) NOT NULL, -- 'monthly' or 'yearly'

  -- Enable/disable commission for this plan
  enabled BOOLEAN DEFAULT false NOT NULL,

  -- Commission model
  commission_model VARCHAR(10) NOT NULL,

  -- One-time commission
  onetime_type VARCHAR(10),
  onetime_value DECIMAL(10,2) DEFAULT 0,

  -- Recurring commission
  recurring_type VARCHAR(10),
  recurring_value DECIMAL(10,2) DEFAULT 0,
  recurring_duration INTEGER DEFAULT 12,

  CONSTRAINT valid_subscription_type_plan CHECK (subscription_type IN ('monthly', 'yearly')),
  CONSTRAINT valid_commission_model_plan CHECK (commission_model IN ('onetime', 'recurring', 'hybrid')),
  CONSTRAINT valid_onetime_type_plan CHECK (onetime_type IN ('percentage', 'fixed', NULL)),
  CONSTRAINT valid_recurring_type_plan CHECK (recurring_type IN ('percentage', 'fixed', NULL)),
  CONSTRAINT valid_percentages_plan CHECK (
    (onetime_type != 'percentage' OR (onetime_value >= 0 AND onetime_value <= 100)) AND
    (recurring_type != 'percentage' OR (recurring_value >= 0 AND recurring_value <= 100))
  ),
  CONSTRAINT valid_values_plan CHECK (onetime_value >= 0 AND recurring_value >= 0),
  CONSTRAINT valid_duration_plan CHECK (recurring_duration > 0 AND recurring_duration <= 24)
);

-- One config per (settings_id, plan_id, subscription_type)
CREATE UNIQUE INDEX idx_plan_commission_unique
  ON public.plan_commission(settings_id, plan_id, subscription_type);

-- Index for fast plan lookups
CREATE INDEX idx_plan_commission_plan_id
  ON public.plan_commission(plan_id);

COMMENT ON TABLE public.plan_commission IS 'Commission for helper recruiting store owner (varies by plan)';
COMMENT ON COLUMN public.plan_commission.enabled IS 'FALSE = Helper gets NO commission for this plan';

-- =====================================================
-- 4. AUDIT TRAIL TABLE
-- Track all changes to commission settings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.commission_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id UUID REFERENCES public.commission_settings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Who changed it
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email VARCHAR(255),

  -- What changed
  action VARCHAR(20) NOT NULL, -- 'created', 'updated', 'deleted'
  table_name VARCHAR(50) NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  change_reason TEXT,

  CONSTRAINT valid_action CHECK (action IN ('created', 'updated', 'deleted'))
);

-- Indexes for fast audit queries
CREATE INDEX idx_audit_settings ON public.commission_audit(settings_id);
CREATE INDEX idx_audit_user ON public.commission_audit(changed_by);
CREATE INDEX idx_audit_date ON public.commission_audit(created_at DESC);

COMMENT ON TABLE public.commission_audit IS 'Complete audit trail of all commission setting changes';

-- =====================================================
-- 5. AUTOMATIC AUDIT LOGGING TRIGGER
-- Automatically log all changes
-- =====================================================
CREATE OR REPLACE FUNCTION log_commission_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_email VARCHAR(255);
  settings_id_value UUID;
BEGIN
  -- Get current user's email
  SELECT email INTO current_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Determine settings_id based on table
  IF TG_TABLE_NAME = 'commission_settings' THEN
    -- Main table uses its own ID
    settings_id_value := COALESCE(NEW.id, OLD.id);
  ELSE
    -- Child tables have settings_id field
    settings_id_value := COALESCE(NEW.settings_id, OLD.settings_id);
  END IF;

  -- Insert audit record
  INSERT INTO public.commission_audit (
    settings_id,
    changed_by,
    changed_by_email,
    action,
    table_name,
    record_id,
    old_value,
    new_value
  ) VALUES (
    settings_id_value,
    auth.uid(),
    current_user_email,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'created'
      WHEN TG_OP = 'UPDATE' THEN 'updated'
      WHEN TG_OP = 'DELETE' THEN 'deleted'
    END,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to all commission tables
CREATE TRIGGER audit_commission_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_settings
  FOR EACH ROW EXECUTE FUNCTION log_commission_change();

CREATE TRIGGER audit_network_commission
  AFTER INSERT OR UPDATE OR DELETE ON public.network_commission
  FOR EACH ROW EXECUTE FUNCTION log_commission_change();

CREATE TRIGGER audit_plan_commission
  AFTER INSERT OR UPDATE OR DELETE ON public.plan_commission
  FOR EACH ROW EXECUTE FUNCTION log_commission_change();

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- Only super admins can modify commission settings
-- =====================================================
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_commission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_commission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_audit ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin full access to settings"
  ON public.commission_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to network commission"
  ON public.network_commission FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to plan commission"
  ON public.plan_commission FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Everyone can read audit trail (transparency)
CREATE POLICY "Anyone can read audit trail"
  ON public.commission_audit FOR SELECT
  USING (true);

-- Only super admin can write audit (via triggers only)
CREATE POLICY "Super admin write audit"
  ON public.commission_audit FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- =====================================================
-- 7. HELPER FUNCTION - Get Active Settings
-- Returns the current active commission configuration
-- =====================================================
CREATE OR REPLACE FUNCTION get_active_commission_settings()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', cs.id,
    'version', cs.version,
    'features', json_build_object(
      'enable_multi_tier', cs.enable_multi_tier,
      'auto_approve_applications', cs.auto_approve_applications,
      'send_welcome_email', cs.send_welcome_email,
      'send_commission_notifications', cs.send_commission_notifications
    ),
    'payment', json_build_object(
      'min_payout_threshold', cs.min_payout_threshold,
      'payment_schedule', cs.payment_schedule,
      'payment_day', cs.payment_day
    ),
    'recruitment', json_build_object(
      'max_helpers_per_recruiter', cs.max_helpers_per_recruiter,
      'referral_code_prefix', cs.referral_code_prefix,
      'auto_generate_codes', cs.auto_generate_codes
    ),
    'network_commission', (
      SELECT json_object_agg(
        subscription_type,
        json_build_object(
          'model', commission_model,
          'onetime', json_build_object('type', onetime_type, 'value', onetime_value),
          'recurring', json_build_object('type', recurring_type, 'value', recurring_value, 'duration_months', recurring_duration)
        )
      )
      FROM public.network_commission
      WHERE settings_id = cs.id
    ),
    'plan_commissions', (
      SELECT json_object_agg(
        plan_id::text,
        json_build_object(
          'enabled', enabled,
          subscription_type, json_build_object(
            'model', commission_model,
            'onetime', json_build_object('type', onetime_type, 'value', onetime_value),
            'recurring', json_build_object('type', recurring_type, 'value', recurring_value, 'duration_months', recurring_duration)
          )
        )
      )
      FROM public.plan_commission
      WHERE settings_id = cs.id
    )
  )
  INTO result
  FROM public.commission_settings cs
  WHERE cs.is_active = true
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_active_commission_settings() IS 'Returns current active commission configuration as JSON';

-- =====================================================
-- 8. INSERT DEFAULT SETTINGS
-- Initialize with default configuration
-- =====================================================
DO $$
DECLARE
  settings_id UUID;
BEGIN
  -- Insert default commission settings
  INSERT INTO public.commission_settings (
    version,
    enable_multi_tier,
    auto_approve_applications,
    send_welcome_email,
    send_commission_notifications,
    min_payout_threshold,
    payment_schedule,
    payment_day,
    max_helpers_per_recruiter,
    referral_code_prefix,
    auto_generate_codes,
    is_active
  ) VALUES (
    1,                    -- version
    true,                 -- enable_multi_tier
    false,                -- auto_approve_applications
    true,                 -- send_welcome_email
    true,                 -- send_commission_notifications
    500.00,               -- min_payout_threshold (₹500)
    'monthly',            -- payment_schedule
    '1st',                -- payment_day
    -1,                   -- max_helpers_per_recruiter (unlimited)
    'HELP',               -- referral_code_prefix
    true,                 -- auto_generate_codes
    true                  -- is_active
  )
  RETURNING id INTO settings_id;

  -- Insert default network commission (monthly)
  INSERT INTO public.network_commission (
    settings_id,
    subscription_type,
    commission_model,
    onetime_type,
    onetime_value,
    recurring_type,
    recurring_value,
    recurring_duration
  ) VALUES (
    settings_id,
    'monthly',
    'recurring',
    'percentage',
    0,
    'percentage',
    0,
    12
  );

  -- Insert default network commission (yearly)
  INSERT INTO public.network_commission (
    settings_id,
    subscription_type,
    commission_model,
    onetime_type,
    onetime_value,
    recurring_type,
    recurring_value,
    recurring_duration
  ) VALUES (
    settings_id,
    'yearly',
    'recurring',
    'percentage',
    0,
    'percentage',
    0,
    12
  );
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
