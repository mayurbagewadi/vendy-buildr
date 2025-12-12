-- Clean up duplicate subscriptions for ALL users
-- This script cancels old trial/pending subscriptions when users have multiple subscriptions

-- Step 1: Find all users with duplicate subscriptions
-- (This is just for information, run this to see who's affected)
SELECT
  user_id,
  COUNT(*) as subscription_count,
  STRING_AGG(status || ' (' || plan_id || ')', ', ') as statuses
FROM subscriptions
WHERE status IN ('trial', 'active', 'pending_payment')
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Step 2: Cancel old subscriptions for all users
-- Keep only the most recent active subscription per user
WITH latest_active_subscriptions AS (
  SELECT DISTINCT ON (user_id)
    id,
    user_id
  FROM subscriptions
  WHERE status IN ('active', 'trial')
  ORDER BY user_id,
           CASE
             WHEN status = 'active' THEN 1
             WHEN status = 'trial' THEN 2
             ELSE 3
           END,
           created_at DESC
)
UPDATE subscriptions
SET
  status = 'cancelled',
  cancelled_at = NOW(),
  updated_at = NOW()
WHERE status IN ('trial', 'pending_payment', 'active')
  AND id NOT IN (SELECT id FROM latest_active_subscriptions);

-- Step 3: Verify the cleanup
-- This should show only one active/trial subscription per user
SELECT
  user_id,
  COUNT(*) as active_subscription_count
FROM subscriptions
WHERE status IN ('trial', 'active')
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Step 4: Show all subscriptions status after cleanup
SELECT
  s.user_id,
  s.status,
  sp.name as plan_name,
  s.billing_cycle,
  s.created_at,
  s.cancelled_at
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
ORDER BY s.user_id, s.created_at DESC;
