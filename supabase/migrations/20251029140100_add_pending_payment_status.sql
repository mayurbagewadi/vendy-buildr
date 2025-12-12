-- Add 'pending_payment' to subscription status if not exists
-- This status indicates subscription renewal is pending payment gateway processing

DO $$
BEGIN
  -- Check if we need to update the check constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'subscriptions' AND constraint_name LIKE '%status%'
  ) THEN
    -- Drop existing constraint if any
    ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
  END IF;

  -- Add new constraint with pending_payment status
  ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trial', 'active', 'cancelled', 'expired', 'pending_payment'));

EXCEPTION
  WHEN OTHERS THEN
    -- If constraint doesn't exist or other error, just continue
    RAISE NOTICE 'Status constraint updated or already exists';
END $$;

-- Add index for pending_payment status for quick queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_payment
ON subscriptions(status)
WHERE status = 'pending_payment';

COMMENT ON COLUMN subscriptions.status IS 'Subscription status: trial, active, cancelled, expired, pending_payment';
