-- Check if authenticated users can update subscriptions table
SELECT
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND grantee IN ('authenticated', 'anon', 'service_role');

-- Check RLS policies on subscriptions
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'subscriptions';
