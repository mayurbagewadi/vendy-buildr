-- Variant-aware stock decrement.
-- Stock rule for products and variants:
--   NULL / missing / blank = unlimited
--   0 = out of stock
--   > 0 = limited inventory

CREATE OR REPLACE FUNCTION public.decrement_stock_for_order(
  p_store_id uuid,
  p_items    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item               jsonb;
  v_product            record;
  v_quantity           integer;
  v_variant_name       text;
  v_variant_index      integer;
  v_variant            jsonb;
  v_variant_stock_text text;
  v_variant_stock      integer;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := (v_item->>'quantity')::int;
    v_variant_name := NULLIF(v_item->>'variant', '');

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
          'success',    false,
          'error',      'PRODUCT_NOT_FOUND',
          'product_id', v_item->>'product_id'
        );
      WHEN lock_not_available THEN
        RETURN jsonb_build_object(
          'success',    false,
          'error',      'CONCURRENT_CHECKOUT',
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
          'success',    false,
          'error',      'VARIANT_NOT_FOUND',
          'product_id', v_item->>'product_id',
          'variant',    v_variant_name
        );
      END IF;

      v_variant_stock_text := NULLIF(v_variant->>'stock', '');

      -- Missing/NULL/blank variant stock means unlimited.
      IF v_variant_stock_text IS NULL THEN
        CONTINUE;
      END IF;

      IF v_variant_stock_text !~ '^[0-9]+$' THEN
        RETURN jsonb_build_object(
          'success',    false,
          'error',      'INVALID_VARIANT_STOCK',
          'product_id', v_item->>'product_id',
          'variant',    v_variant_name
        );
      END IF;

      v_variant_stock := v_variant_stock_text::int;

      IF v_variant_stock < v_quantity THEN
        RETURN jsonb_build_object(
          'success',    false,
          'error',      'INSUFFICIENT_STOCK',
          'product_id', v_item->>'product_id',
          'variant',    v_variant_name,
          'available',  v_variant_stock,
          'name',       v_product.name || ' - ' || v_variant_name
        );
      END IF;

      UPDATE products
         SET variants   = jsonb_set(
                            COALESCE(variants, '[]'::jsonb),
                            ARRAY[v_variant_index::text, 'stock'],
                            to_jsonb(v_variant_stock - v_quantity),
                            false
                          ),
             updated_at = now()
       WHERE id = v_product.id;

      CONTINUE;
    END IF;

    -- Product-level stock. NULL means unlimited: no check and no decrement.
    IF v_product.stock IS NULL THEN
      CONTINUE;
    END IF;

    IF v_product.stock < v_quantity THEN
      RETURN jsonb_build_object(
        'success',    false,
        'error',      'INSUFFICIENT_STOCK',
        'product_id', v_item->>'product_id',
        'available',  v_product.stock,
        'name',       v_product.name
      );
    END IF;

    UPDATE products
       SET stock      = stock - v_quantity,
           updated_at = now()
     WHERE id = v_product.id;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
