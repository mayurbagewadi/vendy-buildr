-- Add storage tracking columns to stores table
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS storage_used_mb DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS storage_limit_mb DECIMAL(10, 2) DEFAULT 100;

-- Add comment for documentation
COMMENT ON COLUMN stores.storage_used_mb IS 'Total storage used for VPS uploaded images in MB';
COMMENT ON COLUMN stores.storage_limit_mb IS 'Maximum storage allowed per store in MB (default 100MB = 20 images x 5MB)';
