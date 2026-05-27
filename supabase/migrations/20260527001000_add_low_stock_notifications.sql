-- Real low-stock notification events.
-- Browser push and the admin notification dropdown already consume
-- notification_events; this migration adds the missing stock event source.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_low_stock_threshold_check;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_low_stock_threshold_check
  CHECK (low_stock_threshold >= 0 AND low_stock_threshold <= 999999);

CREATE TABLE IF NOT EXISTS public.product_stock_alert_state (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  low_stock_alerted boolean NOT NULL DEFAULT false,
  out_of_stock_alerted boolean NOT NULL DEFAULT false,
  last_low_stock_alert_at timestamptz,
  last_out_of_stock_alert_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);

ALTER TABLE public.product_stock_alert_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view stock alert state" ON public.product_stock_alert_state;
CREATE POLICY "Store owners can view stock alert state"
ON public.product_stock_alert_state FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.stores
    WHERE stores.id = product_stock_alert_state.store_id
      AND stores.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.touch_product_stock_alert_state_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS touch_product_stock_alert_state_updated_at ON public.product_stock_alert_state;
CREATE TRIGGER touch_product_stock_alert_state_updated_at
BEFORE UPDATE ON public.product_stock_alert_state
FOR EACH ROW
EXECUTE FUNCTION public.touch_product_stock_alert_state_updated_at();

CREATE OR REPLACE FUNCTION public.create_low_stock_notification_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  store_owner uuid;
  pref record;
  alert_state record;
  threshold_value integer;
  alert_title text;
  alert_body text;
  alert_kind text;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.stock IS NOT DISTINCT FROM OLD.stock THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO store_owner
  FROM public.stores
  WHERE id = NEW.store_id;

  IF store_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT low_stock_enabled, low_stock_threshold
    INTO pref
    FROM public.notification_preferences
   WHERE store_id = NEW.store_id
     AND user_id = store_owner;

  IF COALESCE(pref.low_stock_enabled, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  threshold_value := GREATEST(COALESCE(pref.low_stock_threshold, 5), 0);

  -- NULL means unlimited. Stock above threshold is healthy. Both reset alert state.
  IF NEW.stock IS NULL OR NEW.stock > threshold_value THEN
    DELETE FROM public.product_stock_alert_state
     WHERE store_id = NEW.store_id
       AND product_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.product_stock_alert_state (store_id, product_id)
  VALUES (NEW.store_id, NEW.id)
  ON CONFLICT (store_id, product_id) DO NOTHING;

  SELECT *
    INTO alert_state
    FROM public.product_stock_alert_state
   WHERE store_id = NEW.store_id
     AND product_id = NEW.id
   FOR UPDATE;

  IF NEW.stock = 0 THEN
    IF alert_state.out_of_stock_alerted THEN
      RETURN NEW;
    END IF;

    alert_kind := 'out_of_stock';
    alert_title := 'Product out of stock';
    alert_body := COALESCE(NEW.name, 'Product') || ' is now out of stock.';

    UPDATE public.product_stock_alert_state
       SET out_of_stock_alerted = true,
           last_out_of_stock_alert_at = now()
     WHERE store_id = NEW.store_id
       AND product_id = NEW.id;
  ELSE
    IF alert_state.low_stock_alerted THEN
      RETURN NEW;
    END IF;

    alert_kind := 'low_stock';
    alert_title := 'Low stock alert';
    alert_body := COALESCE(NEW.name, 'Product') || ' has only ' || NEW.stock::text || ' left.';

    UPDATE public.product_stock_alert_state
       SET low_stock_alerted = true,
           last_low_stock_alert_at = now()
     WHERE store_id = NEW.store_id
       AND product_id = NEW.id;
  END IF;

  INSERT INTO public.notification_events (
    store_id,
    user_id,
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
    'product:' || NEW.id::text || ':' || alert_kind || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
    'low_stock',
    alert_title,
    alert_body,
    '/admin/products/edit/' || NEW.id::text,
    jsonb_build_object(
      'product_id', NEW.id,
      'product_name', NEW.name,
      'stock', NEW.stock,
      'threshold', threshold_value,
      'alert_kind', alert_kind
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS products_create_low_stock_notification_event ON public.products;
CREATE TRIGGER products_create_low_stock_notification_event
AFTER UPDATE OF stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.create_low_stock_notification_event();
