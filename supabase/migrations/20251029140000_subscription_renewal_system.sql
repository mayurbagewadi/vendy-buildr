-- Function to handle subscription expiration and renewal
CREATE OR REPLACE FUNCTION check_and_process_expired_subscriptions()
RETURNS void AS $$
DECLARE
  sub_record RECORD;
  new_period_end timestamp with time zone;
BEGIN
  -- Loop through all subscriptions where current_period_end has passed
  FOR sub_record IN
    SELECT
      s.*,
      sp.slug as plan_slug,
      sp.name as plan_name
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.current_period_end < NOW()
      AND s.status IN ('active', 'trial')
  LOOP

    -- Check if this is a free plan or trial
    IF sub_record.status = 'trial' OR sub_record.plan_slug = 'free' THEN
      -- Free plans and trials don't auto-renew
      -- Just expire them, DON'T reset order counts
      UPDATE subscriptions
      SET
        status = 'expired',
        updated_at = NOW()
      WHERE id = sub_record.id;

      RAISE NOTICE 'Expired subscription % (Free/Trial plan)', sub_record.id;

    -- Check if this is a paid plan WITHOUT payment gateway (one-time purchase)
    ELSIF sub_record.payment_gateway IS NULL THEN
      -- One-time purchases don't auto-renew
      -- Expire and wait for manual renewal
      UPDATE subscriptions
      SET
        status = 'expired',
        updated_at = NOW()
      WHERE id = sub_record.id;

      RAISE NOTICE 'Expired subscription % (No payment gateway - manual renewal required)', sub_record.id;

    -- This is a paid plan WITH payment gateway (auto-renew)
    ELSE
      -- TODO: In future, integrate with Razorpay/Stripe API here
      -- For now, we'll prepare the data structure
      -- Payment gateway integration will handle actual charging

      -- Calculate new period end based on billing cycle
      IF sub_record.billing_cycle = 'yearly' THEN
        new_period_end := sub_record.current_period_end + INTERVAL '1 year';
      ELSE
        new_period_end := sub_record.current_period_end + INTERVAL '1 month';
      END IF;

      -- For now, mark as 'pending_payment' so admin can manually verify payment
      -- Once payment gateway is integrated, this will be automatic
      UPDATE subscriptions
      SET
        status = 'pending_payment',
        updated_at = NOW()
      WHERE id = sub_record.id;

      RAISE NOTICE 'Subscription % marked pending_payment - awaiting payment gateway integration', sub_record.id;
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to manually renew a subscription (for super admin)
CREATE OR REPLACE FUNCTION renew_subscription(
  subscription_id uuid,
  reset_counters boolean DEFAULT true
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Function to process successful payment (for payment gateway webhook)
CREATE OR REPLACE FUNCTION process_successful_payment(
  subscription_id uuid,
  payment_gateway_name text,
  payment_id text DEFAULT NULL
)
RETURNS void AS $$
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
  new_period_start := GREATEST(sub_record.current_period_end, NOW());

  IF sub_record.billing_cycle = 'yearly' THEN
    new_period_end := new_period_start + INTERVAL '1 year';
  ELSE
    new_period_end := new_period_start + INTERVAL '1 month';
  END IF;

  -- Update subscription - reset counters on successful payment
  UPDATE subscriptions
  SET
    status = 'active',
    current_period_start = new_period_start,
    current_period_end = new_period_end,
    next_billing_at = new_period_end,
    payment_gateway = payment_gateway_name,
    whatsapp_orders_used = 0,
    website_orders_used = 0,
    updated_at = NOW()
  WHERE id = subscription_id;

  -- Log the payment (optional - if you have a payments table)
  -- INSERT INTO subscription_payments (subscription_id, payment_id, amount, status)
  -- VALUES (subscription_id, payment_id, amount, 'success');

  RAISE NOTICE 'Subscription % renewed via payment gateway until %', subscription_id, new_period_end;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily check for expired subscriptions
-- This will run at 2:00 AM every day
SELECT cron.schedule(
  'check-expired-subscriptions-daily',
  '0 2 * * *', -- Every day at 2:00 AM
  $$
  SELECT check_and_process_expired_subscriptions();
  $$
);

-- Add comment
COMMENT ON FUNCTION check_and_process_expired_subscriptions() IS 'Checks and processes expired subscriptions daily. Free/trial plans expire without renewal. Paid plans with payment gateway are marked for auto-renewal.';
COMMENT ON FUNCTION renew_subscription(uuid, boolean) IS 'Manually renew a subscription (for super admin). Optionally reset order counters.';
COMMENT ON FUNCTION process_successful_payment(uuid, text, text) IS 'Process successful payment from payment gateway webhook. Renews subscription and resets order counters.';
