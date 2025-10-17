-- Add last_admin_visit column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_admin_visit timestamp with time zone;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_stores_last_admin_visit ON stores(last_admin_visit);