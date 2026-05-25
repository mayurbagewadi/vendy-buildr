import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  storeId: string;
  dbOrderId?: string;
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

async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const message = `${orderId}|${paymentId}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const generatedSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return generatedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody: VerifyPaymentRequest = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, storeId, dbOrderId } = requestBody;

    console.log('Starting payment verification:', { razorpay_order_id, razorpay_payment_id, storeId, dbOrderId });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !storeId) {
      throw new Error('Missing required parameters');
    }

    let orderQuery = supabaseClient
      .from('orders')
      .select('*')
      .eq('store_id', storeId);

    orderQuery = dbOrderId
      ? orderQuery.eq('id', dbOrderId)
      : orderQuery.eq('gateway_order_id', razorpay_order_id);

    const { data: order, error: orderError } = await orderQuery.maybeSingle();

    if (orderError || !order) {
      await logPaymentEvent(supabaseClient, 'order_lookup_failed', {
        storeId,
        orderId: dbOrderId,
        gatewayOrderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        details: { error: orderError?.message ?? 'Order not found' },
      });
      throw new Error('Order not found for payment');
    }

    await logPaymentEvent(supabaseClient, 'payment_callback_received', {
      storeId,
      orderId: order.id,
      gatewayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });

    const { data: existing } = await supabaseClient
      .from('payment_verifications')
      .select('razorpay_payment_id')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (!existing) {
      const { data: store, error: storeError } = await supabaseClient
        .from('stores')
        .select('payment_gateway_credentials')
        .eq('id', storeId)
        .single();

      if (storeError || !store) {
        throw new Error('Store not found');
      }

      const credentials = store.payment_gateway_credentials as any;
      const razorpayKeySecret = credentials?.razorpay?.key_secret;

      if (!razorpayKeySecret) {
        throw new Error('Razorpay credentials not configured for this store');
      }

      const isValid = await verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        razorpayKeySecret
      );

      if (!isValid) {
        console.error('Payment signature verification failed');
        await logPaymentEvent(supabaseClient, 'signature_failed', {
          storeId,
          orderId: order.id,
          gatewayOrderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
        });
        return new Response(
          JSON.stringify({ verified: false, error: 'Invalid payment signature' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const { error: verificationInsertError } = await supabaseClient
        .from('payment_verifications')
        .upsert(
          { razorpay_payment_id, razorpay_order_id, store_id: storeId },
          { onConflict: 'razorpay_payment_id', ignoreDuplicates: true }
        );

      if (verificationInsertError) throw verificationInsertError;

      await logPaymentEvent(supabaseClient, 'signature_verified', {
        storeId,
        orderId: order.id,
        gatewayOrderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
    }

    const paymentResponse = {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      verified_at: new Date().toISOString(),
    };

    const { data: updatedOrder, error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'new',
        payment_method: 'razorpay',
        payment_status: 'completed',
        payment_gateway: 'razorpay',
        payment_id: razorpay_payment_id,
        gateway_order_id: razorpay_order_id,
        payment_response: paymentResponse,
      })
      .eq('id', order.id)
      .neq('payment_status', 'completed')
      .select('*')
      .maybeSingle();

    if (updateError) {
      await logPaymentEvent(supabaseClient, 'order_mark_paid_failed', {
        storeId,
        orderId: order.id,
        gatewayOrderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        details: { error: updateError.message },
      });
      throw updateError;
    }

    if (updatedOrder) {
      await logPaymentEvent(supabaseClient, 'order_marked_paid', {
        storeId,
        orderId: updatedOrder.id,
        gatewayOrderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });

      try {
        const items = Array.isArray(updatedOrder.items) ? updatedOrder.items : [];
        const stockItems = items
          .map((item: any) => ({
            product_id: item.productId || item.product_id,
            quantity: item.quantity,
          }))
          .filter((item: any) => item.product_id && item.quantity);

        if (stockItems.length > 0) {
          await supabaseClient.rpc('decrement_stock_for_order', {
            p_store_id: storeId,
            p_items: stockItems,
          });
        }
      } catch (stockError) {
        console.warn('Stock decrement after Razorpay verification failed:', stockError);
        await logPaymentEvent(supabaseClient, 'stock_decrement_failed', {
          storeId,
          orderId: updatedOrder.id,
          gatewayOrderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          details: { error: stockError instanceof Error ? stockError.message : String(stockError) },
        });
      }

      if (updatedOrder.coupon_code && Number(updatedOrder.discount_amount ?? 0) > 0) {
        try {
          const { data: coupon } = await supabaseClient
            .from('coupons')
            .select('id')
            .eq('store_id', storeId)
            .eq('code', String(updatedOrder.coupon_code).toUpperCase())
            .maybeSingle();

          if (coupon) {
            await supabaseClient.from('coupon_usage').insert({
              coupon_id: coupon.id,
              order_id: updatedOrder.id,
              customer_phone: updatedOrder.customer_phone,
              customer_email: updatedOrder.customer_email || null,
              discount_applied: updatedOrder.discount_amount,
              used_at: new Date().toISOString(),
            });
          }
        } catch (couponError) {
          console.warn('Coupon usage recording failed:', couponError);
        }
      }

      try {
        await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/send-order-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderId: updatedOrder.id, storeId }),
        });
      } catch (emailError) {
        console.warn('Order email trigger failed:', emailError);
      }
    } else {
      console.log('Idempotent: order already marked paid:', order.id);
    }

    console.log('Payment signature verified and order handled:', razorpay_payment_id);

    return new Response(
      JSON.stringify({ verified: true, orderId: order.id, message: 'Payment verified successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ verified: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
