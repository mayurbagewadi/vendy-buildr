-- ============================================================
-- DIAGNOSTIC: Check if Razorpay deployment is complete
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This will show you what's missing
-- ============================================================

-- Check 1: Does platform_settings table exist?
SELECT
  'platform_settings table' as component,
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'platform_settings'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run deploy-razorpay-migrations.sql'
  END as status;

-- Check 2: Does the default settings row exist?
SELECT
  'platform_settings default row' as component,
  CASE
    WHEN EXISTS (
      SELECT FROM platform_settings
      WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run deploy-razorpay-migrations.sql'
  END as status;

-- Check 3: Are Razorpay credentials configured?
SELECT
  'Razorpay credentials' as component,
  CASE
    WHEN EXISTS (
      SELECT FROM platform_settings
      WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
      AND razorpay_key_id IS NOT NULL
      AND razorpay_key_id != ''
      AND razorpay_key_secret IS NOT NULL
      AND razorpay_key_secret != ''
    ) THEN '✅ CONFIGURED'
    ELSE '⚠️ NOT CONFIGURED - Enter in Super Admin Settings'
  END as status;

-- Check 4: Do transactions have Razorpay columns?
SELECT
  'transactions razorpay columns' as component,
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'razorpay_order_id'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run deploy-razorpay-migrations.sql'
  END as status;

-- Check 5: Show current platform settings (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'platform_settings'
  ) THEN
    RAISE NOTICE 'Current platform_settings:';
    PERFORM * FROM platform_settings;
  END IF;
END $$;

SELECT
  razorpay_key_id,
  CASE
    WHEN razorpay_key_secret IS NOT NULL AND razorpay_key_secret != ''
    THEN '***configured***'
    ELSE 'NOT SET'
  END as razorpay_key_secret_status,
  razorpay_test_mode,
  created_at,
  updated_at
FROM platform_settings
WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;

-- ============================================================
-- INTERPRETATION:
-- ============================================================
-- If platform_settings table is MISSING:
--   → You need to run deploy-razorpay-migrations.sql first
--
-- If table EXISTS but credentials are NOT CONFIGURED:
--   → Login to Super Admin → Settings → Enter Razorpay keys
--
-- If everything is ✅:
--   → The Edge Function needs to be deployed
--   → Run: supabase functions deploy razorpay-payment
-- ============================================================
