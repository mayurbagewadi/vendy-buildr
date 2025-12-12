-- Check for users with multiple subscriptions
SELECT 
  user_id,
  COUNT(*) as subscription_count,
  STRING_AGG(status, ', ') as statuses
FROM subscriptions
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Show all subscriptions with details
SELECT 
  s.id,
  s.user_id,
  s.status,
  s.billing_cycle,
  sp.name as plan_name,
  s.created_at
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
ORDER BY s.user_id, s.created_at DESC;
