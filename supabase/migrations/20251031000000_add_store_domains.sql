-- Add subdomain and custom domain support to stores table

-- Add new columns
ALTER TABLE stores
ADD COLUMN subdomain VARCHAR(63) UNIQUE,
ADD COLUMN custom_domain VARCHAR(255) UNIQUE,
ADD COLUMN custom_domain_verified BOOLEAN DEFAULT false,
ADD COLUMN custom_domain_verification_token VARCHAR(100);

-- Create index for faster subdomain/domain lookups
CREATE INDEX idx_stores_subdomain ON stores(subdomain);
CREATE INDEX idx_stores_custom_domain ON stores(custom_domain);

-- Add constraints
ALTER TABLE stores
ADD CONSTRAINT subdomain_lowercase CHECK (subdomain = LOWER(subdomain));

ALTER TABLE stores
ADD CONSTRAINT subdomain_format CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$');

ALTER TABLE stores
ADD CONSTRAINT subdomain_length CHECK (LENGTH(subdomain) >= 3 AND LENGTH(subdomain) <= 63);

-- Reserved subdomains that can't be used
CREATE TABLE reserved_subdomains (
  subdomain VARCHAR(63) PRIMARY KEY
);

INSERT INTO reserved_subdomains (subdomain) VALUES
('www'), ('api'), ('admin'), ('superadmin'), ('app'), ('mail'), ('smtp'), ('ftp'),
('cdn', 'static'), ('assets'), ('blog'), ('help'), ('support'), ('docs'),
('dashboard'), ('login'), ('register'), ('signin'), ('signup'), ('test'),
('dev'), ('staging'), ('prod'), ('production'), ('preview');

-- Function to validate subdomain isn't reserved
CREATE OR REPLACE FUNCTION check_subdomain_not_reserved()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reserved_subdomains WHERE subdomain = NEW.subdomain) THEN
    RAISE EXCEPTION 'Subdomain "%" is reserved and cannot be used', NEW.subdomain;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check reserved subdomains
CREATE TRIGGER trigger_check_subdomain_reserved
  BEFORE INSERT OR UPDATE OF subdomain ON stores
  FOR EACH ROW
  WHEN (NEW.subdomain IS NOT NULL)
  EXECUTE FUNCTION check_subdomain_not_reserved();

-- Update existing stores with subdomain based on slug
UPDATE stores
SET subdomain = slug
WHERE subdomain IS NULL AND slug IS NOT NULL;

COMMENT ON COLUMN stores.subdomain IS 'Store subdomain (e.g., "sasumasale" for sasumasale.yesgive.shop)';
COMMENT ON COLUMN stores.custom_domain IS 'Custom domain (e.g., "shop.example.com")';
COMMENT ON COLUMN stores.custom_domain_verified IS 'Whether custom domain DNS is verified';
COMMENT ON COLUMN stores.custom_domain_verification_token IS 'Token for verifying custom domain ownership';
