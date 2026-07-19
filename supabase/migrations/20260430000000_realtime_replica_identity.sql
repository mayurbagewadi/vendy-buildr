-- Required for Supabase Realtime to include old row values in UPDATE event payloads.
-- Without REPLICA IDENTITY FULL, payload.old only contains the primary key.
-- useNotifications.tsx handleProductUpdate reads payload.old.stock to detect
-- when stock crosses the LOW_STOCK_THRESHOLD — it cannot work without this.
--
-- Also adds indexes that Supabase Realtime row-level filters rely on.
-- Without the index, the filter still works but causes a full table scan
-- on every change event instead of an index seek.

ALTER TABLE products REPLICA IDENTITY FULL;

-- Supabase Realtime filter: store_id=eq.${storeId}
CREATE INDEX IF NOT EXISTS idx_products_store_id_status
  ON products(store_id, status)
  WHERE status = 'published';

-- Supabase Realtime filter: store_id=eq.${storeId}
CREATE INDEX IF NOT EXISTS idx_orders_store_id_created
  ON orders(store_id, created_at DESC);
