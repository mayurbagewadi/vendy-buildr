-- ===================================================================
-- FINAL FIX FOR ALL STORE OWNERS - SUBSCRIPTION ISSUES
-- This SQL will fix subscription display issues for ALL users
-- ===================================================================

-- Step 1: Show current state (BEFORE cleanup)
SELECT
  'BEFORE CLEANUP - Users with multiple subscriptions' as info,
  user_id,
  COUNT(*) as subscription_count,
  STRING_AGG(status || ' (' || sp.name || ')', ', ' ORDER BY s.created_at DESC) as subscriptions
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Step 2: Cancel all old subscriptions for ALL users
-- Keep only the most recent active subscription per user
-- Priority: Active > Trial > Pending Payment
WITH latest_subscriptions AS (
  SELECT DISTINCT ON (user_id)
    id,
    user_id,
    status
  FROM subscriptions
  WHERE status IN ('active', 'trial', 'pending_payment')
  ORDER BY user_id,
           -- Priority: active=1, trial=2, pending_payment=3
           CASE
             WHEN status = 'active' THEN 1
             WHEN status = 'trial' THEN 2
             WHEN status = 'pending_payment' THEN 3
             ELSE 4
           END,
           created_at DESC
)
UPDATE subscriptions
SET
  status = 'cancelled',
  cancelled_at = NOW(),
  updated_at = NOW()
WHERE status IN ('trial', 'pending_payment', 'active')
  AND id NOT IN (SELECT id FROM latest_subscriptions)
RETURNING
  id,
  user_id,
  status as new_status,
  cancelled_at;

-- Step 3: Verify cleanup (should return NO ROWS)
SELECT
  'AFTER CLEANUP - Should be empty (no duplicates)' as info,
  user_id,
  COUNT(*) as subscription_count,
  STRING_AGG(status, ', ') as statuses
FROM subscriptions
WHERE status IN ('trial', 'active', 'pending_payment')
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Step 4: Show final state for all users with subscriptions
SELECT
  'FINAL STATE - Each user should have only 1 active/trial subscription' as info,
  s.user_id,
  p.email,
  s.status,
  sp.name as plan_name,
  s.billing_cycle,
  s.created_at,
  s.cancelled_at
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
JOIN profiles p ON s.user_id = p.user_id
ORDER BY
  CASE
    WHEN s.status = 'active' THEN 1
    WHEN s.status = 'trial' THEN 2
    WHEN s.status = 'cancelled' THEN 3
    ELSE 4
  END,
  s.created_at DESC;

-- Step 5: Summary statistics
SELECT
  'SUMMARY' as info,
  COUNT(DISTINCT user_id) as total_users_with_subscriptions,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
  COUNT(CASE WHEN status = 'trial' THEN 1 END) as trial_subscriptions,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_subscriptions,
  COUNT(CASE WHEN status = 'pending_payment' THEN 1 END) as pending_subscriptions
FROM subscriptions;
