-- ===================================================================
-- COMPLETE FIX FOR SUBSCRIPTION ISSUES
-- This script will:
-- 1. Add INSERT policy for users to create subscriptions
-- 2. Clean up all duplicate subscriptions
-- 3. Verify the fixes
-- ===================================================================

-- Step 1: Add INSERT policy for users (if it doesn't already exist)
-- This allows users to create their own subscriptions during onboarding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'subscriptions'
    AND policyname = 'Users can insert their own subscription'
  ) THEN
    CREATE POLICY "Users can insert their own subscription"
      ON public.subscriptions FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    RAISE NOTICE 'INSERT policy created successfully';
  ELSE
    RAISE NOTICE 'INSERT policy already exists';
  END IF;
END $$;

-- Step 2: Show current state (BEFORE cleanup)
SELECT
  'BEFORE CLEANUP' as status,
  user_id,
  COUNT(*) as subscription_count,
  STRING_AGG(status || ' (' || id::text || ')', ', ' ORDER BY created_at DESC) as subscriptions
FROM subscriptions
WHERE status IN ('trial', 'active', 'pending_payment')
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Step 3: Cancel all duplicate subscriptions
-- Keep only the most recent active or trial subscription per user
WITH latest_subscriptions AS (
  SELECT DISTINCT ON (user_id)
    id,
    user_id,
    status
  FROM subscriptions
  WHERE status IN ('active', 'trial', 'pending_payment')
  ORDER BY user_id,
           -- Prioritize active over trial over pending
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
  status,
  cancelled_at;

-- Step 4: Verify cleanup (AFTER)
-- This should return NO ROWS if successful
SELECT
  'AFTER CLEANUP - Should be empty' as status,
  user_id,
  COUNT(*) as subscription_count,
  STRING_AGG(status, ', ') as statuses
FROM subscriptions
WHERE status IN ('trial', 'active', 'pending_payment')
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Step 5: Show final state for all users
SELECT
  'FINAL STATE' as status,
  s.user_id,
  s.status,
  sp.name as plan_name,
  s.billing_cycle,
  s.created_at,
  s.cancelled_at
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
ORDER BY s.user_id,
         CASE
           WHEN s.status = 'active' THEN 1
           WHEN s.status = 'trial' THEN 2
           WHEN s.status = 'cancelled' THEN 3
           ELSE 4
         END,
         s.created_at DESC;

-- Step 6: Verify policies exist
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'subscriptions'
ORDER BY policyname;
