-- Issue 6: Idempotency table for Razorpay payment verifications.
-- Prevents the same payment_id from being verified (and charged) more than once.
CREATE TABLE IF NOT EXISTS payment_verifications (
  razorpay_payment_id text        PRIMARY KEY,
  razorpay_order_id   text        NOT NULL,
  store_id            uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  verified_at         timestamptz NOT NULL DEFAULT now()
);

-- Issue 7: Track when order-confirmation email was sent.
-- email_sent_at NULL = not yet sent; set atomically via UPDATE ... WHERE email_sent_at IS NULL
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
