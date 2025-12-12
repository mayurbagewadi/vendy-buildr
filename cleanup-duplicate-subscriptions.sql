-- Clean up duplicate subscriptions for user
-- This cancels the old trial subscription and keeps the active paid subscription

-- Update old trial/pending subscriptions to cancelled status
UPDATE subscriptions
SET
  status = 'cancelled',
  cancelled_at = NOW(),
  updated_at = NOW()
WHERE user_id = '557b9050-98a2-46c1-89f2-c64df7a12b03'
  AND status IN ('trial', 'pending_payment')
  AND id NOT IN (
    -- Keep the most recent active subscription
    SELECT id
    FROM subscriptions
    WHERE user_id = '557b9050-98a2-46c1-89f2-c64df7a12b03'
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  );

-- Verify the result
SELECT
  id,
  status,
  billing_cycle,
  created_at,
  cancelled_at
FROM subscriptions
WHERE user_id = '557b9050-98a2-46c1-89f2-c64df7a12b03'
ORDER BY created_at DESC;
