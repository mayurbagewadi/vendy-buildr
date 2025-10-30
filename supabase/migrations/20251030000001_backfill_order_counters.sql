-- Backfill order counters for existing orders
-- This will count all orders within the current billing period

-- Update whatsapp_orders_used based on actual orders in the current period
UPDATE subscriptions s
SET whatsapp_orders_used = (
  SELECT COUNT(*)
  FROM orders o
  JOIN stores st ON st.id = o.store_id
  WHERE st.user_id = s.user_id
    AND (
      s.current_period_start IS NULL
      OR o.created_at >= s.current_period_start
    )
    AND (
      s.current_period_end IS NULL
      OR o.created_at <= s.current_period_end
    )
),
updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM stores
  WHERE stores.user_id = s.user_id
);

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % subscription records with accurate order counts', updated_count;
END $$;
