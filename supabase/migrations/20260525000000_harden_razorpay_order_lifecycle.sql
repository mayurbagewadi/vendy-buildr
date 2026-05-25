-- Razorpay hardening: support backend-owned order lifecycle and support tracing.

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  gateway_order_id text,
  payment_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view payment events" ON payment_events;
CREATE POLICY "Store owners can view payment events"
ON payment_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM stores
    WHERE stores.id = payment_events.store_id
      AND stores.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_events_store_created
ON payment_events(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_order_created
ON payment_events(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_gateway_order
ON payment_events(gateway_order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM orders
    WHERE gateway_order_id IS NOT NULL
    GROUP BY gateway_order_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_gateway_order_id_not_null
    ON orders(gateway_order_id)
    WHERE gateway_order_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM orders
    WHERE payment_id IS NOT NULL
    GROUP BY payment_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_payment_id_not_null
    ON orders(payment_id)
    WHERE payment_id IS NOT NULL;
  END IF;
END $$;
