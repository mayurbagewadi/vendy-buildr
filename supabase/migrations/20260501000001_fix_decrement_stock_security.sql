-- Fix: decrement_stock_for_order ran as SECURITY INVOKER (caller's role).
-- When called from the browser (anon session), RLS blocked SELECT on products
-- → NO_DATA_FOUND → PRODUCT_NOT_FOUND returned even for valid published products.
--
-- Fix: SECURITY DEFINER makes the function execute as its owner (postgres),
-- bypassing RLS entirely. SET search_path = public pins the schema so a
-- malicious search_path injection cannot redirect table lookups.

CREATE OR REPLACE FUNCTION decrement_stock_for_order(
  p_store_id uuid,
  p_items    jsonb   -- [{product_id: uuid, quantity: int}]
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
       WHERE id        = (v_item->>'product_id')::uuid
         AND store_id  = p_store_id
         AND status    = 'published'
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
