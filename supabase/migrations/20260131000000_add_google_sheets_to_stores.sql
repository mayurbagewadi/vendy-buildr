-- Add Google Sheets tracking columns to stores table
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS google_sheet_id TEXT,
ADD COLUMN IF NOT EXISTS google_sheet_url TEXT,
ADD COLUMN IF NOT EXISTS google_sheet_created_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN stores.google_sheet_id IS 'Google Sheets ID for product import/export template';
COMMENT ON COLUMN stores.google_sheet_url IS 'Full URL of the Google Sheet template';
COMMENT ON COLUMN stores.google_sheet_created_at IS 'Timestamp when the template was created';
