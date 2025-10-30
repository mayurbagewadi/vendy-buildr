-- Auto-increment order counters when orders are created
-- This ensures whatsapp_orders_used is always accurate

-- Function to increment order counter
CREATE OR REPLACE FUNCTION increment_order_counter()
RETURNS TRIGGER AS $$
DECLARE
  store_user_id UUID;
BEGIN
  -- Get the user_id from the store
  SELECT user_id INTO store_user_id
  FROM stores
  WHERE id = NEW.store_id;

  -- Increment whatsapp_orders_used for the current billing period
  -- (All orders are WhatsApp orders in the current implementation)
  UPDATE subscriptions
  SET whatsapp_orders_used = COALESCE(whatsapp_orders_used, 0) + 1,
      updated_at = NOW()
  WHERE user_id = store_user_id
    AND status IN ('active', 'trial', 'pending_payment')
    AND (
      current_period_start IS NULL
      OR NEW.created_at >= current_period_start
    )
    AND (
      current_period_end IS NULL
      OR NEW.created_at <= current_period_end
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_increment_order_counter ON orders;
CREATE TRIGGER trigger_increment_order_counter
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_order_counter();

COMMENT ON FUNCTION increment_order_counter() IS 'Automatically increments whatsapp_orders_used when a new order is created';
COMMENT ON TRIGGER trigger_increment_order_counter ON orders IS 'Increments subscription order counter for each new order';
