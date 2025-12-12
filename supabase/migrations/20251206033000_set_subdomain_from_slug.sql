-- Set subdomain to slug for all stores where subdomain is null
-- This ensures all existing stores get proper subdomain URLs like store-name.yesgive.shop

UPDATE stores
SET subdomain = slug
WHERE subdomain IS NULL;
