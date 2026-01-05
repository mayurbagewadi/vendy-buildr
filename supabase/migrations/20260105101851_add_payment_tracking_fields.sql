-- Add payment tracking fields to orders table for online payment gateway integration

-- Add payment status field
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

-- Add payment gateway transaction ID
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_id TEXT;

-- Add payment gateway name (which gateway was used)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_gateway TEXT;

-- Add full payment response from gateway (for debugging and verification)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_response JSONB;

-- Add payment gateway order ID (for gateway-specific order tracking)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN orders.payment_status IS 'Payment status: pending (COD/awaiting payment), paid (completed), failed (payment failed), refunded (payment refunded)';
COMMENT ON COLUMN orders.payment_id IS 'Payment gateway transaction/payment ID';
COMMENT ON COLUMN orders.payment_gateway IS 'Payment gateway used: razorpay, phonepe, cashfree, payu, paytm, stripe, or cod';
COMMENT ON COLUMN orders.payment_response IS 'Full payment response from gateway for verification and debugging';
COMMENT ON COLUMN orders.gateway_order_id IS 'Gateway-specific order ID for order tracking';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_gateway ON orders(payment_gateway);
CREATE INDEX IF NOT EXISTS idx_orders_gateway_order_id ON orders(gateway_order_id);

-- Update existing COD orders to have proper payment_status and payment_gateway
UPDATE orders
SET
  payment_status = 'pending',
  payment_gateway = 'cod'
WHERE payment_method = 'cod' AND payment_status IS NULL;
