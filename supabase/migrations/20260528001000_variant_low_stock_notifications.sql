-- Variant-aware low-stock notification events.
-- Keeps the existing product-level behavior, and adds per-variant alert state
-- for stock stored inside products.variants JSON.

ALTER TABLE public.product_stock_alert_state
  ADD COLUMN IF NOT EXISTS stock_scope text NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS variant_name text NOT NULL DEFAULT '';

ALTER TABLE public.product_stock_alert_state
  DROP CONSTRAINT IF EXISTS product_stock_alert_state_pkey;

ALTER TABLE public.product_stock_alert_state
  ADD CONSTRAINT product_stock_alert_state_pkey
  PRIMARY KEY (store_id, product_id, stock_scope, variant_name);

ALTER TABLE public.product_stock_alert_state
  DROP CONSTRAINT IF EXISTS product_stock_alert_state_scope_check;

ALTER TABLE public.product_stock_alert_state
  ADD CONSTRAINT product_stock_alert_state_scope_check
  CHECK (stock_scope IN ('product', 'variant'));

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
  variant_item jsonb;
  variant_name_value text;
  variant_stock_text text;
  variant_stock_value integer;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR (
       NEW.stock IS NOT DISTINCT FROM OLD.stock
       AND COALESCE(NEW.variants, '[]'::jsonb) IS NOT DISTINCT FROM COALESCE(OLD.variants, '[]'::jsonb)
     ) THEN
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

  IF NEW.stock IS DISTINCT FROM OLD.stock THEN
    -- NULL means unlimited. Stock above threshold is healthy. Both reset product alert state.
    IF NEW.stock IS NULL OR NEW.stock > threshold_value THEN
      DELETE FROM public.product_stock_alert_state
       WHERE store_id = NEW.store_id
         AND product_id = NEW.id
         AND stock_scope = 'product'
         AND variant_name = '';
    ELSE
      INSERT INTO public.product_stock_alert_state (store_id, product_id, stock_scope, variant_name)
      VALUES (NEW.store_id, NEW.id, 'product', '')
      ON CONFLICT (store_id, product_id, stock_scope, variant_name) DO NOTHING;

      SELECT *
        INTO alert_state
        FROM public.product_stock_alert_state
       WHERE store_id = NEW.store_id
         AND product_id = NEW.id
         AND stock_scope = 'product'
         AND variant_name = ''
       FOR UPDATE;

      IF NEW.stock = 0 THEN
        IF NOT alert_state.out_of_stock_alerted THEN
          alert_kind := 'out_of_stock';
          alert_title := 'Product out of stock';
          alert_body := COALESCE(NEW.name, 'Product') || ' is now out of stock.';

          UPDATE public.product_stock_alert_state
             SET out_of_stock_alerted = true,
                 last_out_of_stock_alert_at = now()
           WHERE store_id = NEW.store_id
             AND product_id = NEW.id
             AND stock_scope = 'product'
             AND variant_name = '';

          INSERT INTO public.notification_events (
            store_id, user_id, event_key, type, title, body, action_url, metadata
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
              'alert_kind', alert_kind,
              'stock_scope', 'product'
            )
          );
        END IF;
      ELSE
        IF NOT alert_state.low_stock_alerted THEN
          alert_kind := 'low_stock';
          alert_title := 'Low stock alert';
          alert_body := COALESCE(NEW.name, 'Product') || ' has only ' || NEW.stock::text || ' left.';

          UPDATE public.product_stock_alert_state
             SET low_stock_alerted = true,
                 last_low_stock_alert_at = now()
           WHERE store_id = NEW.store_id
             AND product_id = NEW.id
             AND stock_scope = 'product'
             AND variant_name = '';

          INSERT INTO public.notification_events (
            store_id, user_id, event_key, type, title, body, action_url, metadata
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
              'alert_kind', alert_kind,
              'stock_scope', 'product'
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  IF COALESCE(NEW.variants, '[]'::jsonb) IS DISTINCT FROM COALESCE(OLD.variants, '[]'::jsonb) THEN
    DELETE FROM public.product_stock_alert_state state
     WHERE state.store_id = NEW.store_id
       AND state.product_id = NEW.id
       AND state.stock_scope = 'variant'
       AND NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(COALESCE(NEW.variants, '[]'::jsonb)) AS current_variant(item)
          WHERE COALESCE(NULLIF(current_variant.item->>'name', ''), current_variant.item->>'sku') = state.variant_name
       );

    FOR variant_item IN
      SELECT item
      FROM jsonb_array_elements(COALESCE(NEW.variants, '[]'::jsonb)) AS variants(item)
    LOOP
      variant_name_value := COALESCE(NULLIF(variant_item->>'name', ''), variant_item->>'sku');
      variant_stock_text := NULLIF(variant_item->>'stock', '');

      IF variant_name_value IS NULL THEN
        CONTINUE;
      END IF;

      -- Missing/NULL/blank variant stock means unlimited. Non-numeric stock is ignored safely.
      IF variant_stock_text IS NULL OR variant_stock_text !~ '^[0-9]+$' THEN
        DELETE FROM public.product_stock_alert_state
         WHERE store_id = NEW.store_id
           AND product_id = NEW.id
           AND stock_scope = 'variant'
           AND variant_name = variant_name_value;
        CONTINUE;
      END IF;

      variant_stock_value := variant_stock_text::integer;

      IF variant_stock_value > threshold_value THEN
        DELETE FROM public.product_stock_alert_state
         WHERE store_id = NEW.store_id
           AND product_id = NEW.id
           AND stock_scope = 'variant'
           AND variant_name = variant_name_value;
        CONTINUE;
      END IF;

      INSERT INTO public.product_stock_alert_state (store_id, product_id, stock_scope, variant_name)
      VALUES (NEW.store_id, NEW.id, 'variant', variant_name_value)
      ON CONFLICT (store_id, product_id, stock_scope, variant_name) DO NOTHING;

      SELECT *
        INTO alert_state
        FROM public.product_stock_alert_state
       WHERE store_id = NEW.store_id
         AND product_id = NEW.id
         AND stock_scope = 'variant'
         AND variant_name = variant_name_value
       FOR UPDATE;

      IF variant_stock_value = 0 THEN
        IF alert_state.out_of_stock_alerted THEN
          CONTINUE;
        END IF;

        alert_kind := 'variant_out_of_stock';
        alert_title := 'Variant out of stock';
        alert_body := COALESCE(NEW.name, 'Product') || ' - ' || variant_name_value || ' is now out of stock.';

        UPDATE public.product_stock_alert_state
           SET out_of_stock_alerted = true,
               last_out_of_stock_alert_at = now()
         WHERE store_id = NEW.store_id
           AND product_id = NEW.id
           AND stock_scope = 'variant'
           AND variant_name = variant_name_value;
      ELSE
        IF alert_state.low_stock_alerted THEN
          CONTINUE;
        END IF;

        alert_kind := 'variant_low_stock';
        alert_title := 'Variant low stock alert';
        alert_body := COALESCE(NEW.name, 'Product') || ' - ' || variant_name_value || ' has only ' || variant_stock_value::text || ' left.';

        UPDATE public.product_stock_alert_state
           SET low_stock_alerted = true,
               last_low_stock_alert_at = now()
         WHERE store_id = NEW.store_id
           AND product_id = NEW.id
           AND stock_scope = 'variant'
           AND variant_name = variant_name_value;
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
        'product:' || NEW.id::text || ':variant:' || md5(variant_name_value) || ':' || alert_kind || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
        'low_stock',
        alert_title,
        alert_body,
        '/admin/products/edit/' || NEW.id::text,
        jsonb_build_object(
          'product_id', NEW.id,
          'product_name', NEW.name,
          'variant_name', variant_name_value,
          'stock', variant_stock_value,
          'threshold', threshold_value,
          'alert_kind', alert_kind,
          'stock_scope', 'variant'
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS products_create_low_stock_notification_event ON public.products;
CREATE TRIGGER products_create_low_stock_notification_event
AFTER UPDATE OF stock, variants ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.create_low_stock_notification_event();
