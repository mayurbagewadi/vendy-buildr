-- Fix payment_status check constraint to include all required values.
--
-- Original constraint (20260105101851_add_payment_tracking_fields.sql) only allowed:
--   'pending', 'paid', 'failed', 'refunded'
--
-- Missing values causing 400 errors:
--   'completed'       — set on INSERT after Razorpay onSuccess confirms payment
--   'awaiting_payment'— set on INSERT for PhonePe (redirect-based, pre-payment)

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN (
    'pending',           -- COD orders (pay on delivery)
    'paid',              -- legacy value, keep for existing rows
    'failed',            -- payment attempt failed
    'refunded',          -- payment returned to customer
    'completed',         -- online payment confirmed (Razorpay)
    'awaiting_payment'   -- online payment initiated but not yet confirmed (PhonePe redirect)
  ));
