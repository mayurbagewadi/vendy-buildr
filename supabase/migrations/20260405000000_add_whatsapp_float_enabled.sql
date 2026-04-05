-- Add whatsapp_float_enabled column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp_float_enabled BOOLEAN DEFAULT true;
