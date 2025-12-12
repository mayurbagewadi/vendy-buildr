-- Update all stores that don't have subdomains set
-- This sets subdomain = slug for existing stores
UPDATE stores
SET subdomain = slug
WHERE subdomain IS NULL;

-- Verify the update
SELECT slug, subdomain, custom_domain FROM stores;
