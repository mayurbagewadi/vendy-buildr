-- Add payment_gateway_credentials column to stores table
-- This column will store credentials for various payment gateways as JSONB

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS payment_gateway_credentials JSONB DEFAULT '{}'::jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN stores.payment_gateway_credentials IS 'Store owner payment gateway credentials (Razorpay, PhonePe, Cashfree, PayU, Paytm, Stripe)';

-- Create an index for better query performance on the JSONB column
CREATE INDEX IF NOT EXISTS idx_stores_payment_gateway_credentials ON stores USING GIN (payment_gateway_credentials);
