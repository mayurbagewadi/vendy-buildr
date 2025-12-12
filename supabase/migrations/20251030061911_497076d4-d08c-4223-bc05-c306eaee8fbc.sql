-- Drop and recreate the renew_subscription function to refresh schema cache
DROP FUNCTION IF EXISTS public.renew_subscription(uuid, boolean);

-- Recreate the function with the exact signature
CREATE OR REPLACE FUNCTION public.renew_subscription(
  subscription_id uuid, 
  reset_counters boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  sub_record RECORD;
  new_period_start timestamp with time zone;
  new_period_end timestamp with time zone;
BEGIN
  -- Get subscription details
  SELECT * INTO sub_record
  FROM subscriptions
  WHERE id = subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Calculate new period dates
  new_period_start := NOW();

  IF sub_record.billing_cycle = 'yearly' THEN
    new_period_end := new_period_start + INTERVAL '1 year';
  ELSE
    new_period_end := new_period_start + INTERVAL '1 month';
  END IF;

  -- Update subscription
  UPDATE subscriptions
  SET
    status = 'active',
    current_period_start = new_period_start,
    current_period_end = new_period_end,
    next_billing_at = new_period_end,
    whatsapp_orders_used = CASE WHEN reset_counters THEN 0 ELSE whatsapp_orders_used END,
    website_orders_used = CASE WHEN reset_counters THEN 0 ELSE website_orders_used END,
    updated_at = NOW()
  WHERE id = subscription_id;

  RAISE NOTICE 'Subscription % renewed until %', subscription_id, new_period_end;
END;
$$;