-- Add payment_mode column to stores table
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'online_and_cod' CHECK (payment_mode IN ('online_only', 'online_and_cod'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stores_payment_mode ON stores(payment_mode);

-- Update existing stores to have default payment mode
UPDATE stores
SET payment_mode = 'online_and_cod'
WHERE payment_mode IS NULL;

COMMENT ON COLUMN stores.payment_mode IS 'Payment mode configuration: online_only (only online payments) or online_and_cod (both online and COD)';
