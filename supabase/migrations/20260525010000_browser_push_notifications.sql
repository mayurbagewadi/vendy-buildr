-- Production browser notification system for store owners.
-- Source of truth is notification_events; browser push is only one delivery channel.

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  type text NOT NULL CHECK (type IN ('new_order', 'paid_order', 'low_stock', 'test')),
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'partial', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_events_event_key
  ON public.notification_events(event_key);

CREATE INDEX IF NOT EXISTS idx_notification_events_store_created
  ON public.notification_events(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_user_unread
  ON public.notification_events(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.browser_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  device_label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  failure_count integer NOT NULL DEFAULT 0,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_browser_push_subscriptions_endpoint
  ON public.browser_push_subscriptions(endpoint);

CREATE INDEX IF NOT EXISTS idx_browser_push_subscriptions_active_store
  ON public.browser_push_subscriptions(store_id, user_id, disabled_at)
  WHERE disabled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  browser_push_enabled boolean NOT NULL DEFAULT true,
  new_order_enabled boolean NOT NULL DEFAULT true,
  paid_order_enabled boolean NOT NULL DEFAULT true,
  low_stock_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.browser_push_subscriptions(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'browser_push',
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_event
  ON public.notification_delivery_logs(notification_event_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_events;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browser_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view notification events" ON public.notification_events;
CREATE POLICY "Store owners can view notification events"
ON public.notification_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = notification_events.store_id
      AND stores.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Store owners can mark notification events read" ON public.notification_events;
CREATE POLICY "Store owners can mark notification events read"
ON public.notification_events FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = notification_events.store_id
      AND stores.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = notification_events.store_id
      AND stores.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Store owners can manage browser push subscriptions" ON public.browser_push_subscriptions;
CREATE POLICY "Store owners can manage browser push subscriptions"
ON public.browser_push_subscriptions FOR ALL
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = browser_push_subscriptions.store_id
      AND stores.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = browser_push_subscriptions.store_id
      AND stores.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Store owners can manage notification preferences" ON public.notification_preferences;
CREATE POLICY "Store owners can manage notification preferences"
ON public.notification_preferences FOR ALL
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = notification_preferences.store_id
      AND stores.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = notification_preferences.store_id
      AND stores.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Store owners can view delivery logs" ON public.notification_delivery_logs;
CREATE POLICY "Store owners can view delivery logs"
ON public.notification_delivery_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.notification_events ne
    JOIN public.stores s ON s.id = ne.store_id
    WHERE ne.id = notification_delivery_logs.notification_event_id
      AND s.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.touch_browser_push_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS touch_browser_push_subscription_updated_at ON public.browser_push_subscriptions;
CREATE TRIGGER touch_browser_push_subscription_updated_at
BEFORE UPDATE ON public.browser_push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.touch_browser_push_subscription_updated_at();

CREATE OR REPLACE FUNCTION public.touch_notification_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS touch_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER touch_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_notification_preferences_updated_at();

CREATE OR REPLACE FUNCTION public.create_order_notification_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  store_owner uuid;
  event_type text;
  event_title text;
  event_key_value text;
BEGIN
  SELECT user_id INTO store_owner
  FROM public.stores
  WHERE id = NEW.store_id;

  IF store_owner IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.payment_method = 'cod' THEN
    event_type := 'new_order';
    event_title := 'New COD order received';
    event_key_value := NEW.id::text || ':new_order';
  ELSIF TG_OP = 'UPDATE'
    AND NEW.payment_status = 'completed'
    AND OLD.payment_status IS DISTINCT FROM 'completed' THEN
    event_type := 'paid_order';
    event_title := 'Paid order received';
    event_key_value := NEW.id::text || ':paid_order';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_events (
    store_id,
    user_id,
    order_id,
    event_key,
    type,
    title,
    body,
    action_url,
    metadata
  )
  VALUES (
    NEW.store_id,
    store_owner,
    NEW.id,
    event_key_value,
    event_type,
    event_title,
    'Order #' || COALESCE(NEW.order_number, NEW.id::text) || ' from ' || COALESCE(NEW.customer_name, 'Customer') || ' - Rs. ' || COALESCE(NEW.total, 0)::text,
    '/admin/orders?orderId=' || NEW.id::text,
    jsonb_build_object(
      'order_number', NEW.order_number,
      'customer_name', NEW.customer_name,
      'total', NEW.total,
      'payment_method', NEW.payment_method,
      'payment_status', NEW.payment_status
    )
  )
  ON CONFLICT (event_key) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_create_notification_event ON public.orders;
CREATE TRIGGER orders_create_notification_event
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_order_notification_event();

CREATE OR REPLACE FUNCTION public.dispatch_browser_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  anon_key text;
  internal_secret text;
BEGIN
  IF NEW.type = 'test' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key'
    LIMIT 1;

    SELECT decrypted_secret INTO internal_secret
    FROM vault.decrypted_secrets
    WHERE name = 'browser_push_internal_secret'
    LIMIT 1;

    IF anon_key IS NOT NULL AND internal_secret IS NOT NULL THEN
      PERFORM pg_net.http_post(
        url := 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/send-browser-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key,
          'x-internal-secret', internal_secret
        ),
        body := jsonb_build_object(
          'action', 'send_event',
          'eventId', NEW.id
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Browser push dispatch failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notification_events_dispatch_browser_push ON public.notification_events;
CREATE TRIGGER notification_events_dispatch_browser_push
AFTER INSERT ON public.notification_events
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_browser_push_for_notification();
