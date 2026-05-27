-- Stock rule:
--   NULL = unlimited
--   0    = out of stock
--   > 0  = limited inventory

ALTER TABLE public.products
  ALTER COLUMN stock DROP DEFAULT;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_non_negative;

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_non_negative
  CHECK (stock IS NULL OR stock >= 0);

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
  v_item     jsonb;
  v_product  record;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      SELECT id, stock, name
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

    -- NULL means unlimited: no check and no decrement.
    IF v_product.stock IS NULL THEN
      CONTINUE;
    END IF;

    IF v_product.stock < (v_item->>'quantity')::int THEN
      RETURN jsonb_build_object(
        'success',    false,
        'error',      'INSUFFICIENT_STOCK',
        'product_id', (v_item->>'product_id'),
        'available',  v_product.stock,
        'name',       v_product.name
      );
    END IF;

    UPDATE products
       SET stock      = stock - (v_item->>'quantity')::int,
           updated_at = now()
     WHERE id = v_product.id;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
