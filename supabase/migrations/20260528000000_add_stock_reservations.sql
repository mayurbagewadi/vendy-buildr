-- Razorpay stock reservations.
-- Keeps paid customers from losing stock after payment while still releasing
-- stock for failed or abandoned online payments.

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  gateway_order_id text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  CONSTRAINT stock_reservations_status_check
    CHECK (status IN ('active', 'completed', 'released', 'expired'))
);

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE UNIQUE INDEX IF NOT EXISTS stock_reservations_active_order_idx
  ON public.stock_reservations(order_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS stock_reservations_expiry_idx
  ON public.stock_reservations(status, expires_at);

CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(
  p_store_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_ttl_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_product record;
  v_quantity integer;
  v_variant_name text;
  v_variant_index integer;
  v_variant jsonb;
  v_variant_stock_text text;
  v_variant_stock integer;
  v_reserved_items jsonb := '[]'::jsonb;
  v_reservation_id uuid;
BEGIN
  IF p_ttl_minutes IS NULL OR p_ttl_minutes < 5 OR p_ttl_minutes > 60 THEN
    p_ttl_minutes := 15;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMPTY_ITEMS');
  END IF;

  IF EXISTS (
    SELECT 1 FROM stock_reservations
     WHERE order_id = p_order_id
       AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_reserved', true);
  END IF;

  -- First pass: lock and validate every finite-stock row before changing stock.
  FOR v_item IN
    SELECT jsonb_build_object(
      'product_id', product_id,
      'variant', variant,
      'quantity', quantity
    )
    FROM (
      SELECT
        product_id,
        NULLIF(variant, '') AS variant,
        SUM(quantity)::integer AS quantity
      FROM jsonb_to_recordset(p_items) AS x(product_id text, variant text, quantity integer)
      GROUP BY product_id, NULLIF(variant, '')
    ) grouped_items
  LOOP
    v_quantity := (v_item->>'quantity')::int;
    v_variant_name := NULLIF(v_item->>'variant', '');

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_QUANTITY');
    END IF;

    BEGIN
      SELECT id, stock, name, variants
        INTO STRICT v_product
        FROM products
       WHERE id       = (v_item->>'product_id')::uuid
         AND store_id = p_store_id
         AND status   = 'published'
       FOR UPDATE NOWAIT;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'PRODUCT_NOT_FOUND',
          'product_id', v_item->>'product_id'
        );
      WHEN lock_not_available THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'CONCURRENT_CHECKOUT',
          'product_id', v_item->>'product_id'
        );
    END;

    IF v_variant_name IS NOT NULL THEN
      SELECT (ordinality - 1)::integer, elem
        INTO v_variant_index, v_variant
        FROM jsonb_array_elements(COALESCE(v_product.variants, '[]'::jsonb)) WITH ORDINALITY AS arr(elem, ordinality)
       WHERE elem->>'name' = v_variant_name
       LIMIT 1;

      IF v_variant IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'VARIANT_NOT_FOUND',
          'product_id', v_item->>'product_id',
          'variant', v_variant_name
        );
      END IF;

      v_variant_stock_text := NULLIF(v_variant->>'stock', '');
      IF v_variant_stock_text IS NULL THEN
        CONTINUE;
      END IF;

      IF v_variant_stock_text !~ '^[0-9]+$' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'INVALID_VARIANT_STOCK',
          'product_id', v_item->>'product_id',
          'variant', v_variant_name
        );
      END IF;

      v_variant_stock := v_variant_stock_text::int;
      IF v_variant_stock < v_quantity THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'INSUFFICIENT_STOCK',
          'product_id', v_item->>'product_id',
          'variant', v_variant_name,
          'available', v_variant_stock,
          'name', v_product.name || ' - ' || v_variant_name
        );
      END IF;

      CONTINUE;
    END IF;

    IF v_product.stock IS NOT NULL AND v_product.stock < v_quantity THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_STOCK',
        'product_id', v_item->>'product_id',
        'available', v_product.stock,
        'name', v_product.name
      );
    END IF;
  END LOOP;

  -- Second pass: decrement only after all items are validated.
  FOR v_item IN
    SELECT jsonb_build_object(
      'product_id', product_id,
      'variant', variant,
      'quantity', quantity
    )
    FROM (
      SELECT
        product_id,
        NULLIF(variant, '') AS variant,
        SUM(quantity)::integer AS quantity
      FROM jsonb_to_recordset(p_items) AS x(product_id text, variant text, quantity integer)
      GROUP BY product_id, NULLIF(variant, '')
    ) grouped_items
  LOOP
    v_quantity := (v_item->>'quantity')::int;
    v_variant_name := NULLIF(v_item->>'variant', '');

    SELECT id, stock, name, variants
      INTO STRICT v_product
      FROM products
     WHERE id       = (v_item->>'product_id')::uuid
       AND store_id = p_store_id
       AND status   = 'published'
     FOR UPDATE;

    IF v_variant_name IS NOT NULL THEN
      SELECT (ordinality - 1)::integer, elem
        INTO v_variant_index, v_variant
        FROM jsonb_array_elements(COALESCE(v_product.variants, '[]'::jsonb)) WITH ORDINALITY AS arr(elem, ordinality)
       WHERE elem->>'name' = v_variant_name
       LIMIT 1;

      v_variant_stock_text := NULLIF(v_variant->>'stock', '');
      IF v_variant_stock_text IS NULL THEN
        CONTINUE;
      END IF;

      v_variant_stock := v_variant_stock_text::int;

      UPDATE products
         SET variants = jsonb_set(
                          COALESCE(variants, '[]'::jsonb),
                          ARRAY[v_variant_index::text, 'stock'],
                          to_jsonb(v_variant_stock - v_quantity),
                          false
                        ),
             updated_at = now()
       WHERE id = v_product.id;

      v_reserved_items := v_reserved_items || jsonb_build_array(jsonb_build_object(
        'product_id', v_product.id,
        'variant', v_variant_name,
        'quantity', v_quantity,
        'scope', 'variant'
      ));

      CONTINUE;
    END IF;

    IF v_product.stock IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE products
       SET stock = stock - v_quantity,
           updated_at = now()
     WHERE id = v_product.id;

    v_reserved_items := v_reserved_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'quantity', v_quantity,
      'scope', 'product'
    ));
  END LOOP;

  INSERT INTO stock_reservations (store_id, order_id, items, expires_at)
  VALUES (p_store_id, p_order_id, v_reserved_items, now() + make_interval(mins => p_ttl_minutes))
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'reserved_items', v_reserved_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock_reservation(
  p_order_id uuid,
  p_reason text DEFAULT 'released'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation record;
  v_item jsonb;
  v_product record;
  v_quantity integer;
  v_variant_name text;
  v_variant_index integer;
  v_variant jsonb;
  v_variant_stock_text text;
  v_variant_stock integer;
  v_new_status text := CASE WHEN p_reason = 'expired' THEN 'expired' ELSE 'released' END;
BEGIN
  SELECT *
    INTO v_reservation
    FROM stock_reservations
   WHERE order_id = p_order_id
     AND status = 'active'
   FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'released', false);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_reservation.items, '[]'::jsonb)) LOOP
    v_quantity := (v_item->>'quantity')::int;
    v_variant_name := NULLIF(v_item->>'variant', '');

    SELECT id, stock, variants
      INTO v_product
      FROM products
     WHERE id = (v_item->>'product_id')::uuid
       AND store_id = v_reservation.store_id
     FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_variant_name IS NOT NULL THEN
      SELECT (ordinality - 1)::integer, elem
        INTO v_variant_index, v_variant
        FROM jsonb_array_elements(COALESCE(v_product.variants, '[]'::jsonb)) WITH ORDINALITY AS arr(elem, ordinality)
       WHERE elem->>'name' = v_variant_name
       LIMIT 1;

      IF v_variant IS NULL THEN
        CONTINUE;
      END IF;

      v_variant_stock_text := NULLIF(v_variant->>'stock', '');
      IF v_variant_stock_text IS NULL OR v_variant_stock_text !~ '^[0-9]+$' THEN
        CONTINUE;
      END IF;

      v_variant_stock := v_variant_stock_text::int;

      UPDATE products
         SET variants = jsonb_set(
                          COALESCE(variants, '[]'::jsonb),
                          ARRAY[v_variant_index::text, 'stock'],
                          to_jsonb(v_variant_stock + v_quantity),
                          false
                        ),
             updated_at = now()
       WHERE id = v_product.id;

      CONTINUE;
    END IF;

    UPDATE products
       SET stock = COALESCE(stock, 0) + v_quantity,
           updated_at = now()
     WHERE id = v_product.id;
  END LOOP;

  UPDATE stock_reservations
     SET status = v_new_status,
         released_at = now(),
         release_reason = p_reason,
         updated_at = now()
   WHERE id = v_reservation.id;

  RETURN jsonb_build_object('success', true, 'released', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_stock_reservation(
  p_order_id uuid,
  p_gateway_order_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id uuid;
BEGIN
  UPDATE stock_reservations
     SET status = 'completed',
         gateway_order_id = COALESCE(p_gateway_order_id, gateway_order_id),
         completed_at = now(),
         updated_at = now()
   WHERE order_id = p_order_id
     AND status = 'active'
  RETURNING id INTO v_reservation_id;

  IF v_reservation_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'completed', false);
  END IF;

  RETURN jsonb_build_object('success', true, 'completed', true, 'reservation_id', v_reservation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_expired_stock_reservations(
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_order_id IN
    SELECT order_id
      FROM stock_reservations
     WHERE status = 'active'
       AND expires_at < now()
     ORDER BY expires_at
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  LOOP
    PERFORM release_stock_reservation(v_order_id, 'expired');
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'expired_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_razorpay_order_paid_with_stock_reservation(
  p_order_id uuid,
  p_store_id uuid,
  p_gateway_order_id text,
  p_payment_id text,
  p_payment_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_reservation_id uuid;
BEGIN
  SELECT *
    INTO v_order
    FROM orders
   WHERE id = p_order_id
     AND store_id = p_store_id
     AND payment_gateway = 'razorpay'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  IF v_order.payment_status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'order', to_jsonb(v_order));
  END IF;

  UPDATE stock_reservations
     SET status = 'completed',
         gateway_order_id = COALESCE(p_gateway_order_id, gateway_order_id),
         completed_at = now(),
         updated_at = now()
   WHERE order_id = p_order_id
     AND store_id = p_store_id
     AND status = 'active'
  RETURNING id INTO v_reservation_id;

  IF v_reservation_id IS NULL THEN
    SELECT id
      INTO v_reservation_id
      FROM stock_reservations
     WHERE order_id = p_order_id
       AND store_id = p_store_id
       AND status = 'completed'
     LIMIT 1;
  END IF;

  IF v_reservation_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'STOCK_RESERVATION_MISSING');
  END IF;

  UPDATE orders
     SET status = 'new',
         payment_method = 'razorpay',
         payment_status = 'completed',
         payment_gateway = 'razorpay',
         payment_id = p_payment_id,
         gateway_order_id = p_gateway_order_id,
         payment_response = p_payment_response
   WHERE id = p_order_id
     AND store_id = p_store_id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'reservation_id', v_reservation_id,
    'order', to_jsonb(v_order)
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-expired-stock-reservations') THEN
    PERFORM cron.unschedule('release-expired-stock-reservations');
  END IF;
END;
$$;

SELECT cron.schedule(
  'release-expired-stock-reservations',
  '*/15 * * * *',
  $$SELECT public.release_expired_stock_reservations(200)$$
);
