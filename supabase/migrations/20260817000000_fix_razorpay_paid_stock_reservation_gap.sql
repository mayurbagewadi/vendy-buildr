-- Fix: a captured Razorpay payment must always mark the order paid.
-- Previously, if the stock reservation had already expired/released before the
-- customer finished paying (slow bank/UPI step, taking longer than the 15-min hold),
-- this function returned STOCK_RESERVATION_MISSING and the order was never marked
-- paid — even though Razorpay had already charged the customer.
--
-- New behavior: if the reservation is missing, try to re-claim stock fresh for the
-- order's items. If that succeeds, proceed as before. If it fails (stock genuinely
-- taken by someone else in the gap), the order is still marked paid, and a
-- `stock_conflict` note is attached to payment_response for manual review.
-- A paid order is never rejected over internal stock bookkeeping.

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
  v_remapped_items jsonb;
  v_reserve_result jsonb;
  v_stock_conflict jsonb := NULL;
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

  -- Reservation missing (expired/released before the payment came through).
  -- The payment is real — try to re-claim stock fresh instead of blocking the order.
  IF v_reservation_id IS NULL THEN
    SELECT jsonb_agg(
             jsonb_build_object(
               'product_id', item->>'productId',
               'variant', item->>'variant',
               'quantity', (item->>'quantity')::int
             )
           )
      INTO v_remapped_items
      FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) AS item;

    IF v_remapped_items IS NOT NULL THEN
      v_reserve_result := public.reserve_stock_for_order(p_store_id, p_order_id, v_remapped_items, 15);

      IF (v_reserve_result->>'success')::boolean IS TRUE THEN
        UPDATE stock_reservations
           SET status = 'completed',
               gateway_order_id = COALESCE(p_gateway_order_id, gateway_order_id),
               completed_at = now(),
               updated_at = now()
         WHERE order_id = p_order_id
           AND status = 'active'
        RETURNING id INTO v_reservation_id;
      ELSE
        v_stock_conflict := jsonb_build_object(
          'detected_at', now(),
          'reason', 'stock_reservation_missing_at_payment',
          'retry_result', v_reserve_result
        );
      END IF;
    ELSE
      v_stock_conflict := jsonb_build_object(
        'detected_at', now(),
        'reason', 'stock_reservation_missing_at_payment',
        'retry_result', jsonb_build_object('success', false, 'error', 'NO_ITEMS_ON_ORDER')
      );
    END IF;
  END IF;

  -- Payment confirmed by Razorpay always marks the order paid, regardless of
  -- whether stock could be re-claimed above.
  UPDATE orders
     SET status = 'new',
         payment_method = 'razorpay',
         payment_status = 'completed',
         payment_gateway = 'razorpay',
         payment_id = p_payment_id,
         gateway_order_id = p_gateway_order_id,
         payment_response = p_payment_response
                             || CASE WHEN v_stock_conflict IS NOT NULL
                                     THEN jsonb_build_object('stock_conflict', v_stock_conflict)
                                     ELSE '{}'::jsonb
                                END
   WHERE id = p_order_id
     AND store_id = p_store_id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'reservation_id', v_reservation_id,
    'stock_conflict', v_stock_conflict,
    'order', to_jsonb(v_order)
  );
END;
$$;
