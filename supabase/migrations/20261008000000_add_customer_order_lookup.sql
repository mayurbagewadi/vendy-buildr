-- ─────────────────────────────────────────────────────────────────────────────
-- Customer "My Order" lookup — attempt log for rate limiting.
--
-- Customers have no login. The storefront "My Order" page finds a customer's
-- orders by phone + delivery pincode through the customer-order-lookup edge
-- function (service role). The orders table itself stays closed to the public.
--
-- This table records every lookup so the edge function can block repeated
-- guessing (e.g. trying many pincodes for one phone number). Phone and IP are
-- stored only as SHA-256 hashes — no raw customer data is kept here.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_order_lookup_attempts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  phone_hash  TEXT        NOT NULL,
  ip_hash     TEXT,
  success     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_colookup_store_phone_created
  ON customer_order_lookup_attempts (store_id, phone_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_colookup_ip_created
  ON customer_order_lookup_attempts (ip_hash, created_at DESC);

-- RLS on with no policies: only the service role (edge function) can read/write.
ALTER TABLE customer_order_lookup_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON customer_order_lookup_attempts FROM anon, authenticated;

-- Speeds up the edge function's phone lookup inside one store.
CREATE INDEX IF NOT EXISTS idx_orders_store_customer_phone
  ON orders (store_id, customer_phone);

-- Daily cleanup: attempts are only needed for the short rate-limit window.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-customer-order-lookup-attempts')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-customer-order-lookup-attempts');
END $$;

SELECT cron.schedule(
  'cleanup-customer-order-lookup-attempts',
  '30 3 * * *',  -- daily 03:30 UTC
  $$DELETE FROM public.customer_order_lookup_attempts WHERE created_at < now() - interval '2 days'$$
);
