-- Automation support for tracking webhooks, batch sync, cancellation audit, and async notifications.

ALTER TABLE public.shipment_events
  ADD COLUMN IF NOT EXISTS event_key TEXT;

DROP INDEX IF EXISTS public.shipment_events_unique_event_key_idx;

CREATE UNIQUE INDEX shipment_events_unique_event_key_idx
  ON public.shipment_events(shipment_id, event_key);

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

CREATE TABLE IF NOT EXISTS public.shipping_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  awb TEXT,
  event_status TEXT,
  event_key TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS shipping_webhook_events_provider_awb_idx
  ON public.shipping_webhook_events(provider, awb, received_at DESC);

CREATE INDEX IF NOT EXISTS shipping_webhook_events_processed_idx
  ON public.shipping_webhook_events(processed, received_at DESC);

ALTER TABLE public.shipping_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view own shipping webhook events"
  ON public.shipping_webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores
      WHERE stores.id = shipping_webhook_events.store_id
        AND stores.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.shipping_notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  template TEXT NOT NULL,
  recipient TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipping_notification_jobs_channel_check
    CHECK (channel IN ('whatsapp', 'sms', 'email')),
  CONSTRAINT shipping_notification_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS shipping_notification_jobs_pending_idx
  ON public.shipping_notification_jobs(status, scheduled_at)
  WHERE status IN ('pending', 'failed');

DROP INDEX IF EXISTS public.shipping_notification_jobs_unique_shipped_idx;

CREATE UNIQUE INDEX shipping_notification_jobs_unique_shipped_idx
  ON public.shipping_notification_jobs(shipment_id, channel, template);

DROP TRIGGER IF EXISTS update_shipping_notification_jobs_updated_at
  ON public.shipping_notification_jobs;

CREATE TRIGGER update_shipping_notification_jobs_updated_at
  BEFORE UPDATE ON public.shipping_notification_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shipping_notification_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view own shipping notification jobs"
  ON public.shipping_notification_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores
      WHERE stores.id = shipping_notification_jobs.store_id
        AND stores.user_id = auth.uid()
    )
  );
