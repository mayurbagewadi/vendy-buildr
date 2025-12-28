-- =====================================================
-- Clean Up Leftover Commission Data
-- =====================================================
-- This script removes leftover commission values that don't match the commission_model
-- For example: when model is "onetime", it clears recurring_value
--              when model is "recurring", it clears onetime_value
--              when model is "hybrid", it keeps all values

BEGIN;

-- =====================================================
-- 1. Clean up plan_commission table
-- =====================================================

-- Clear recurring values when model is 'onetime'
UPDATE plan_commission
SET
  recurring_value = 0,
  recurring_duration = 0
WHERE
  commission_model = 'onetime'
  AND (recurring_value != 0 OR recurring_duration != 0);

-- Clear onetime values when model is 'recurring'
UPDATE plan_commission
SET
  onetime_value = 0
WHERE
  commission_model = 'recurring'
  AND onetime_value != 0;

-- =====================================================
-- 2. Clean up network_commission table
-- =====================================================

-- Clear recurring values when model is 'onetime'
UPDATE network_commission
SET
  recurring_value = 0,
  recurring_duration = 0
WHERE
  commission_model = 'onetime'
  AND (recurring_value != 0 OR recurring_duration != 0);

-- Clear onetime values when model is 'recurring'
UPDATE network_commission
SET
  onetime_value = 0
WHERE
  commission_model = 'recurring'
  AND onetime_value != 0;

-- =====================================================
-- 3. Show cleanup summary
-- =====================================================

-- Count records that were cleaned in plan_commission
SELECT
  'plan_commission' as table_name,
  COUNT(*) as records_cleaned
FROM plan_commission
WHERE
  (commission_model = 'onetime' AND (recurring_value = 0 AND recurring_duration = 0))
  OR (commission_model = 'recurring' AND onetime_value = 0)
  OR commission_model = 'hybrid';

-- Count records that were cleaned in network_commission
SELECT
  'network_commission' as table_name,
  COUNT(*) as records_cleaned
FROM network_commission
WHERE
  (commission_model = 'onetime' AND (recurring_value = 0 AND recurring_duration = 0))
  OR (commission_model = 'recurring' AND onetime_value = 0)
  OR commission_model = 'hybrid';

COMMIT;

-- =====================================================
-- Verification: Find any remaining leftover data
-- =====================================================

-- Should return 0 rows if cleanup was successful
SELECT
  'plan_commission - leftover onetime in recurring model' as issue,
  id,
  plan_id,
  subscription_type,
  commission_model,
  onetime_value
FROM plan_commission
WHERE commission_model = 'recurring' AND onetime_value != 0;

SELECT
  'plan_commission - leftover recurring in onetime model' as issue,
  id,
  plan_id,
  subscription_type,
  commission_model,
  recurring_value,
  recurring_duration
FROM plan_commission
WHERE commission_model = 'onetime' AND (recurring_value != 0 OR recurring_duration != 0);

SELECT
  'network_commission - leftover onetime in recurring model' as issue,
  id,
  subscription_type,
  commission_model,
  onetime_value
FROM network_commission
WHERE commission_model = 'recurring' AND onetime_value != 0;

SELECT
  'network_commission - leftover recurring in onetime model' as issue,
  id,
  subscription_type,
  commission_model,
  recurring_value,
  recurring_duration
FROM network_commission
WHERE commission_model = 'onetime' AND (recurring_value != 0 OR recurring_duration != 0);
