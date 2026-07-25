-- Provider-neutral shipment records for Shopify-style fulfillment.
-- Keep provider responses out of orders so Delhivery, Shiprocket, and future couriers share one model.

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_order_id TEXT,
  external_shipment_id TEXT,
  awb TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_url TEXT,
  label_url TEXT,
  pickup_id TEXT,
  pickup_status TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipments_provider_check
    CHECK (provider IN ('delhivery', 'shiprocket')),
  CONSTRAINT shipments_status_check
    CHECK (status IN (
      'pending',
      'manifested',
      'pickup_scheduled',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'failed',
      'rto_initiated',
      'returned',
      'cancelled'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS shipments_order_provider_idx
  ON public.shipments(order_id, provider);

CREATE INDEX IF NOT EXISTS shipments_store_status_idx
  ON public.shipments(store_id, status);

CREATE INDEX IF NOT EXISTS shipments_awb_idx
  ON public.shipments(provider, awb);

DROP TRIGGER IF EXISTS update_shipments_updated_at ON public.shipments;

CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location TEXT,
  message TEXT,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_event JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipment_events_shipment_time_idx
  ON public.shipment_events(shipment_id, happened_at DESC);

CREATE TABLE IF NOT EXISTS public.shipping_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipping_action_logs_store_action_time_idx
  ON public.shipping_action_logs(store_id, action, created_at DESC);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view own shipments"
  ON public.shipments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores
      WHERE stores.id = shipments.store_id
        AND stores.user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can view own shipment events"
  ON public.shipment_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.shipments
      JOIN public.stores ON stores.id = shipments.store_id
      WHERE shipments.id = shipment_events.shipment_id
        AND stores.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.shipments IS
  'Provider-neutral shipment state for all courier integrations.';

COMMENT ON TABLE public.shipment_events IS
  'Normalized tracking timeline events for shipments.';
