import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItemInput {
  productId: string;
  quantity: number;
  variant?: string; // selected variant name for variant-priced products
}

interface CreateOrderRequest {
  storeId: string;
  cartItems: CartItemInput[];
  currency: string;
  couponCode?: string;
  autoDiscountId?: string;
  orderRecord?: Record<string, any>;
}

interface DeliveryTier {
  min: number;
  max: number | null;
  fee: number;
}

interface VariantJson {
  name: string;
  price: number;
  offer_price?: number;
}

async function logPaymentEvent(
  supabase: any,
  eventType: string,
  values: {
    storeId?: string;
    orderId?: string;
    gatewayOrderId?: string;
    paymentId?: string;
    details?: Record<string, any>;
  }
) {
  try {
    await supabase.from('payment_events').insert({
      store_id: values.storeId ?? null,
      order_id: values.orderId ?? null,
      event_type: eventType,
      gateway_order_id: values.gatewayOrderId ?? null,
      payment_id: values.paymentId ?? null,
      details: values.details ?? {},
    });
  } catch (error) {
    console.warn('[payment-events] log failed:', error);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve effective price for a product.
 * Single-price: uses base_price / offer_price columns.
 * Variant-price: looks up the selected variant in the variants JSON array.
 * Falls back to first variant if no variant name supplied (defensive).
 */
function resolveEffectivePrice(
  p: { base_price: any; offer_price: any; variants: any },
  variantName: string | undefined
): number {
  // Single-price product — base_price is set
  if (p.base_price != null && Number(p.base_price) > 0) {
    return (p.offer_price != null && Number(p.offer_price) > 0)
      ? Number(p.offer_price)
      : Number(p.base_price);
  }

  // Variant-price product — parse variants JSON and find selected variant
  const variants: VariantJson[] = Array.isArray(p.variants) ? p.variants : [];
  const matched = variantName
    ? variants.find((v) => v.name === variantName)
    : variants[0]; // fallback: first variant (client should always send variant name)

  if (!matched) return 0;

  return (matched.offer_price != null && Number(matched.offer_price) > 0)
    ? Number(matched.offer_price)
    : Number(matched.price);
}

/**
 * Calculate delivery fee server-side.
 * Mirrors the identical logic in Checkout.tsx so the two can never diverge.
 */
function calcDeliveryFee(
  subtotal: number,
  deliveryMode: string,
  deliveryFeeAmount: number,
  freeDeliveryAbove: number | null,
  deliveryTiers: DeliveryTier[]
): number {
  if (deliveryMode === 'multiple' && deliveryTiers.length > 0) {
    const matched = deliveryTiers.find(
      (t) => subtotal >= t.min && (t.max === null || subtotal <= t.max)
    );
    return matched ? matched.fee : 0;
  }
  if (deliveryFeeAmount > 0 && (freeDeliveryAbove === null || subtotal < freeDeliveryAbove)) {
    return deliveryFeeAmount;
  }
  return 0;
}

/**
 * Calculate coupon discount server-side.
 * Validates active status, date range, min order value, and order type.
 * Returns the discount amount (never negative, never exceeds subtotal).
 */
async function calcCouponDiscount(
  supabase: any,
  couponCode: string,
  storeId: string,
  subtotal: number
): Promise<number> {
  const now = new Date().toISOString();

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('store_id', storeId)
    .eq('code', couponCode.trim().toUpperCase())
    .eq('status', 'active')
    .lte('start_date', now)
    .gt('expiry_date', now)
    .in('order_type', ['all', 'online']) // Razorpay = online payment
    .maybeSingle();

  if (error || !coupon) {
    console.warn('[coupon] Not found or expired:', couponCode);
    return 0;
  }

  // Minimum order value check
  if (coupon.min_order_value && subtotal < Number(coupon.min_order_value)) {
    console.warn('[coupon] Below min order value:', coupon.min_order_value);
    return 0;
  }

  // Total usage limit check
  if (coupon.usage_limit_total) {
    const { count } = await supabase
      .from('coupon_usage')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id);

    if ((count ?? 0) >= coupon.usage_limit_total) {
      console.warn('[coupon] Usage limit reached');
      return 0;
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discount_type === 'percentage') {
    discount = (subtotal * Number(coupon.discount_value)) / 100;
    if (coupon.max_discount) {
      discount = Math.min(discount, Number(coupon.max_discount));
    }
  } else {
    discount = Number(coupon.discount_value);
  }

  // Discount can never exceed subtotal
  return Math.min(Math.max(0, discount), subtotal);
}

/**
 * Calculate automatic discount server-side.
 * Handles tiered_value rule type (most common). Returns discount amount.
 */
async function calcAutoDiscount(
  supabase: any,
  autoDiscountId: string,
  storeId: string,
  subtotal: number,
  paymentMethod: string // 'online' for Razorpay
): Promise<number> {
  const now = new Date().toISOString();

  const { data: discount, error } = await supabase
    .from('automatic_discounts')
    .select('*')
    .eq('id', autoDiscountId)
    .eq('store_id', storeId)
    .eq('status', 'active')
    .lte('start_date', now)
    .gt('expiry_date', now)
    .in('order_type', ['all', 'online'])
    .maybeSingle();

  if (error || !discount) {
    console.warn('[auto-discount] Not found or expired:', autoDiscountId);
    return 0;
  }

  if (discount.rule_type === 'tiered_value') {
    const { data: tiers } = await supabase
      .from('discount_tiers')
      .select('*')
      .eq('discount_id', autoDiscountId)
      .order('min_order_value', { ascending: false }); // highest tier first

    if (!tiers || tiers.length === 0) return 0;

    // Find the highest qualifying tier
    const matchedTier = tiers.find(
      (t: any) => subtotal >= Number(t.min_order_value ?? 0)
    );

    if (!matchedTier) return 0;

    let discountAmount = 0;
    if (matchedTier.discount_type === 'percentage') {
      discountAmount = (subtotal * Number(matchedTier.discount_value)) / 100;
    } else {
      discountAmount = Number(matchedTier.discount_value);
    }

    return Math.min(Math.max(0, discountAmount), subtotal);
  }

  // For other rule types (new_customer, returning_customer, etc.) use discount_rules table
  const { data: rules } = await supabase
    .from('discount_rules')
    .select('*')
    .eq('discount_id', autoDiscountId)
    .limit(1);

  if (!rules || rules.length === 0) return 0;

  const rule = rules[0];
  let discountAmount = 0;
  if (rule.discount_type === 'percentage') {
    discountAmount = (subtotal * Number(rule.discount_value)) / 100;
  } else {
    discountAmount = Number(rule.discount_value);
  }

  return Math.min(Math.max(0, discountAmount), subtotal);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // service role — bypasses RLS for price fetch
    );

    const body: CreateOrderRequest = await req.json();
    const { storeId, cartItems, currency, couponCode, autoDiscountId, orderRecord } = body;

    // ── 1. Input validation ────────────────────────────────────────────────
    if (!storeId || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0 || !currency) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!orderRecord) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order details' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    for (const field of ['order_number', 'customer_name', 'customer_phone', 'delivery_address', 'items']) {
      if (!orderRecord[field]) {
        return new Response(
          JSON.stringify({ success: false, error: `Missing order field: ${field}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    for (const item of cartItems) {
      if (!item.productId || typeof item.productId !== 'string') {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid cart item: missing productId' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid cart item: quantity must be a positive integer' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // ── 2. Fetch store + credentials + delivery settings ───────────────────
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select(`
        payment_gateway_credentials,
        delivery_mode,
        delivery_fee_amount,
        free_delivery_above,
        delivery_tiers
      `)
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ success: false, error: 'Store not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const credentials = store.payment_gateway_credentials as any;
    const razorpayKeyId = credentials?.razorpay?.key_id;
    const razorpayKeySecret = credentials?.razorpay?.key_secret;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Razorpay credentials not configured for this store' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ── 3. Fetch product prices from DB — server is the only source of truth ──
    // Fetch variants column too — needed to resolve prices for variant-mode products
    // (base_price is null for variant products; price lives inside variants JSON array)
    const productIds = cartItems.map((i) => i.productId);

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, base_price, offer_price, variants, status, name')
      .in('id', productIds)
      .eq('store_id', storeId) // CRITICAL: scope to this store only
      .eq('status', 'published');

    if (productsError) {
      console.error('[products] DB error:', productsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch product prices' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Every product in the cart must exist, be published, and belong to this store
    const productMap = new Map<string, { price: number; name: string }>();
    for (const p of (products ?? [])) {
      const cartItem = cartItems.find((i) => i.productId === p.id);
      const effectivePrice = resolveEffectivePrice(p, cartItem?.variant);
      productMap.set(p.id, { price: effectivePrice, name: p.name });
    }

    for (const item of cartItems) {
      if (!productMap.has(item.productId)) {
        console.error('[products] Product not found or not published:', item.productId);
        return new Response(
          JSON.stringify({ success: false, error: 'One or more products are unavailable' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
        );
      }
    }

    // ── 4. Calculate subtotal using server prices ──────────────────────────
    let subtotal = 0;
    for (const item of cartItems) {
      const product = productMap.get(item.productId)!;
      subtotal += product.price * item.quantity;
    }

    if (subtotal <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order subtotal must be greater than zero' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    // ── 5. Calculate delivery fee server-side ─────────────────────────────
    const deliveryFee = calcDeliveryFee(
      subtotal,
      store.delivery_mode ?? 'single',
      store.delivery_fee_amount != null ? Number(store.delivery_fee_amount) : 0,
      store.free_delivery_above != null ? Number(store.free_delivery_above) : null,
      (store.delivery_tiers as DeliveryTier[]) ?? []
    );

    // ── 6. Calculate discount server-side ─────────────────────────────────
    // Coupon takes priority over auto-discount (same rule as client)
    let discountAmount = 0;
    if (couponCode && couponCode.trim()) {
      discountAmount = await calcCouponDiscount(supabase, couponCode, storeId, subtotal);
    } else if (autoDiscountId && autoDiscountId.trim()) {
      discountAmount = await calcAutoDiscount(supabase, autoDiscountId, storeId, subtotal, 'online');
    }

    // ── 7. Final total — this is the only number Razorpay will ever see ───
    const verifiedTotal = Math.max(0, subtotal - discountAmount + deliveryFee);

    if (verifiedTotal <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Final order total must be greater than zero' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    console.log('[price-check]', {
      subtotal,
      deliveryFee,
      discountAmount,
      verifiedTotal,
      storeId,
    });

    // ── 8. Create Razorpay order with the server-verified amount ──────────
    const draftPayload = {
      store_id: storeId,
      order_number: orderRecord.order_number,
      customer_name: orderRecord.customer_name,
      customer_phone: orderRecord.customer_phone,
      customer_email: orderRecord.customer_email ?? null,
      delivery_address: orderRecord.delivery_address,
      delivery_landmark: orderRecord.delivery_landmark ?? null,
      delivery_pincode: orderRecord.delivery_pincode ?? null,
      delivery_time: orderRecord.delivery_time ?? null,
      delivery_latitude: orderRecord.delivery_latitude ?? null,
      delivery_longitude: orderRecord.delivery_longitude ?? null,
      items: orderRecord.items,
      subtotal,
      discount_amount: discountAmount,
      coupon_code: couponCode || orderRecord.coupon_code || null,
      automatic_discount_id: couponCode ? null : (autoDiscountId || orderRecord.automatic_discount_id || null),
      delivery_charge: deliveryFee,
      total: verifiedTotal,
      status: 'new',
      payment_method: 'razorpay',
      payment_status: 'awaiting_payment',
      payment_gateway: 'razorpay',
    };

    const { data: draftOrder, error: draftError } = await supabase
      .from('orders')
      .insert(draftPayload)
      .select('id')
      .single();

    if (draftError || !draftOrder) {
      console.error('[orders] draft create failed:', draftError);
      await logPaymentEvent(supabase, 'draft_create_failed', {
        storeId,
        details: { error: draftError?.message ?? 'No draft order returned' },
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Could not start payment. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    await logPaymentEvent(supabase, 'draft_created', {
      storeId,
      orderId: draftOrder.id,
      details: { order_number: orderRecord.order_number, total: verifiedTotal },
    });

    const stockItems = cartItems.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      variant: item.variant ?? null,
    }));

    const { data: reservationResult, error: reservationError } = await supabase.rpc('reserve_stock_for_order', {
      p_store_id: storeId,
      p_order_id: draftOrder.id,
      p_items: stockItems,
      p_ttl_minutes: 15,
    });

    if (reservationError || reservationResult?.success === false) {
      const reservationMessage = reservationResult?.name
        ? `${reservationResult.name} does not have enough stock.`
        : 'Some items are no longer available.';

      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          payment_response: {
            stock_reservation_error: reservationError?.message ?? reservationResult?.error ?? 'STOCK_UNAVAILABLE',
            stock_reservation_result: reservationResult ?? null,
          },
        })
        .eq('id', draftOrder.id);

      await logPaymentEvent(supabase, 'stock_reservation_failed', {
        storeId,
        orderId: draftOrder.id,
        details: {
          error: reservationError?.message ?? reservationResult?.error ?? 'STOCK_UNAVAILABLE',
          result: reservationResult ?? null,
        },
      });

      return new Response(
        JSON.stringify({ success: false, error: reservationMessage, stock: reservationResult ?? null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    await logPaymentEvent(supabase, 'stock_reserved', {
      storeId,
      orderId: draftOrder.id,
      details: {
        reservation_id: reservationResult?.reservation_id ?? null,
        expires_in_minutes: 15,
      },
    });

    const amountInPaise = Math.round(verifiedTotal * 100); // Razorpay expects paise (integer)
    const timestamp = Date.now().toString().substring(5);

    const razorpayPayload = {
      amount: amountInPaise,
      currency,
      receipt: 'order_' + timestamp,
      notes: { store_id: storeId, db_order_id: draftOrder.id },
    };

    const basicAuth = btoa(razorpayKeyId + ':' + razorpayKeySecret);
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + basicAuth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(razorpayPayload),
    });

    if (!razorpayResponse.ok) {
      const errText = await razorpayResponse.text();
      console.error('[razorpay] API error:', errText);
      await supabase.rpc('release_stock_reservation', {
        p_order_id: draftOrder.id,
        p_reason: 'razorpay_order_create_failed',
      });
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', payment_response: { razorpay_order_error: errText } })
        .eq('id', draftOrder.id);
      await logPaymentEvent(supabase, 'razorpay_order_create_failed', {
        storeId,
        orderId: draftOrder.id,
        details: { error: errText },
      });
      throw new Error('Razorpay API error: ' + errText);
    }

    const razorpayOrder = await razorpayResponse.json();

    const { error: gatewayUpdateError } = await supabase
      .from('orders')
      .update({ gateway_order_id: razorpayOrder.id })
      .eq('id', draftOrder.id);

    if (gatewayUpdateError) {
      console.error('[orders] gateway_order_id update failed:', gatewayUpdateError);
      await supabase.rpc('release_stock_reservation', {
        p_order_id: draftOrder.id,
        p_reason: 'gateway_order_link_failed',
      });
      await logPaymentEvent(supabase, 'gateway_order_link_failed', {
        storeId,
        orderId: draftOrder.id,
        gatewayOrderId: razorpayOrder.id,
        details: { error: gatewayUpdateError.message },
      });
      throw new Error('Could not link payment to order');
    }

    await supabase
      .from('stock_reservations')
      .update({ gateway_order_id: razorpayOrder.id })
      .eq('order_id', draftOrder.id)
      .eq('status', 'active');

    console.log('[razorpay] Order created:', razorpayOrder.id, 'amount:', razorpayOrder.amount);

    await logPaymentEvent(supabase, 'razorpay_order_created', {
      storeId,
      orderId: draftOrder.id,
      gatewayOrderId: razorpayOrder.id,
      details: { amount: razorpayOrder.amount, currency: razorpayOrder.currency },
    });

    // ── 9. Return orderId + verified financials to client ─────────────────
    // Client MUST use verifiedTotal for the DB insert — not its own calculated value
    return new Response(
      JSON.stringify({
        success: true,
        dbOrderId: draftOrder.id,
        orderId: razorpayOrder.id,
        verifiedTotal,           // ₹ value — use for DB order.total
        verifiedSubtotal: subtotal,
        verifiedDeliveryCharge: deliveryFee,
        verifiedDiscount: discountAmount,
        amountInPaise: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[create-razorpay-order] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
