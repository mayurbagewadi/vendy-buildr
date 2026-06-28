-- Fix: stock = 0 means "unlimited" in the admin UI, but decrement_stock_for_order
-- was treating it as literally zero items → COD orders blocked for unlimited-stock products.
-- Online payment (Razorpay) was unaffected because it bypasses this RPC entirely.
--
-- Fix: skip the stock check and decrement when stock = 0 (unlimited).

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

    -- stock = 0 means unlimited — skip check and decrement entirely
    IF v_product.stock = 0 THEN
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
