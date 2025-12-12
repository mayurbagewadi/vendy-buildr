-- ============================================================
-- CHECK: Razorpay Credentials Status
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This will show if your credentials are saved
-- ============================================================

-- Check if data exists
SELECT
  id,
  razorpay_key_id,
  CASE
    WHEN razorpay_key_secret IS NOT NULL AND razorpay_key_secret != ''
    THEN '*** SECRET CONFIGURED ***'
    ELSE 'NOT SET'
  END as razorpay_key_secret_status,
  razorpay_test_mode,
  created_at,
  updated_at
FROM platform_settings
WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'platform_settings';

-- Verify current user role (if logged in via Supabase auth)
-- Note: This will only work if running with authenticated user context
SELECT
  ur.user_id,
  ur.role,
  u.email
FROM user_roles ur
LEFT JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'super_admin'
LIMIT 5;
