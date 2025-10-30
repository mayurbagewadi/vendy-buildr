-- Safe migration: only add columns/features that don't exist yet

-- Add subdomain column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE stores ADD COLUMN subdomain VARCHAR(63) UNIQUE;
  END IF;
END $$;

-- Add custom_domain_verified column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'custom_domain_verified'
  ) THEN
    ALTER TABLE stores ADD COLUMN custom_domain_verified BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add custom_domain_verification_token column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'custom_domain_verification_token'
  ) THEN
    ALTER TABLE stores ADD COLUMN custom_domain_verification_token VARCHAR(100);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_stores_subdomain ON stores(subdomain);
CREATE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores(custom_domain);

-- Add constraints if they don't exist
DO $$
BEGIN
  -- Subdomain lowercase constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subdomain_lowercase'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT subdomain_lowercase CHECK (subdomain = LOWER(subdomain));
  END IF;

  -- Subdomain format constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subdomain_format'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT subdomain_format CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$');
  END IF;

  -- Subdomain length constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subdomain_length'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT subdomain_length CHECK (LENGTH(subdomain) >= 3 AND LENGTH(subdomain) <= 63);
  END IF;
END $$;

-- Create reserved_subdomains table if it doesn't exist
CREATE TABLE IF NOT EXISTS reserved_subdomains (
  subdomain VARCHAR(63) PRIMARY KEY
);

-- Insert reserved subdomains (ON CONFLICT DO NOTHING to avoid duplicates)
INSERT INTO reserved_subdomains (subdomain) VALUES
('www'), ('api'), ('admin'), ('superadmin'), ('app'), ('mail'), ('smtp'), ('ftp'),
('cdn'), ('static'), ('assets'), ('blog'), ('help'), ('support'), ('docs'),
('dashboard'), ('login'), ('register'), ('signin'), ('signup'), ('test'),
('dev'), ('staging'), ('prod'), ('production'), ('preview')
ON CONFLICT (subdomain) DO NOTHING;

-- Create function to validate subdomain isn't reserved
CREATE OR REPLACE FUNCTION check_subdomain_not_reserved()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reserved_subdomains WHERE subdomain = NEW.subdomain) THEN
    RAISE EXCEPTION 'Subdomain "%" is reserved and cannot be used', NEW.subdomain;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_check_subdomain_reserved ON stores;
CREATE TRIGGER trigger_check_subdomain_reserved
  BEFORE INSERT OR UPDATE OF subdomain ON stores
  FOR EACH ROW
  WHEN (NEW.subdomain IS NOT NULL)
  EXECUTE FUNCTION check_subdomain_not_reserved();

-- Update existing stores with subdomain based on slug (where subdomain is NULL)
UPDATE stores
SET subdomain = slug
WHERE subdomain IS NULL AND slug IS NOT NULL;

-- Add enable_custom_domain to subscription_plans if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'enable_custom_domain'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN enable_custom_domain BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Enable custom domain for PRO plan
UPDATE subscription_plans
SET enable_custom_domain = true
WHERE slug IN ('pro', 'premium', 'enterprise');

-- Keep disabled for FREE plan
UPDATE subscription_plans
SET enable_custom_domain = false
WHERE slug = 'free';

-- Add comments
COMMENT ON COLUMN stores.subdomain IS 'Store subdomain (e.g., "sasumasale" for sasumasale.yesgive.shop)';
COMMENT ON COLUMN stores.custom_domain IS 'Custom domain (e.g., "shop.example.com")';
COMMENT ON COLUMN stores.custom_domain_verified IS 'Whether custom domain DNS is verified';
COMMENT ON COLUMN stores.custom_domain_verification_token IS 'Token for verifying custom domain ownership';
COMMENT ON COLUMN subscription_plans.enable_custom_domain IS 'Whether this plan allows custom domains';

-- Verify what was created
SELECT
  'Stores columns' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'stores'
  AND column_name IN ('subdomain', 'custom_domain', 'custom_domain_verified', 'custom_domain_verification_token')
UNION ALL
SELECT
  'Subscription plans columns' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'subscription_plans'
  AND column_name = 'enable_custom_domain'
ORDER BY info, column_name;
