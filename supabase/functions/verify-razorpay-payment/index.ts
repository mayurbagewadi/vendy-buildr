import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  action?: 'verify_payment' | 'mark_failed';
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  storeId: string;
  dbOrderId?: string;
  reason?: string;
  failureDetails?: Record<string, any>;
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
    const {
      action = 'verify_payment',
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      storeId,
      dbOrderId,
      reason,
      failureDetails,
    } = requestBody;

    console.log('Starting Razorpay payment action:', { action, razorpay_order_id, razorpay_payment_id, storeId, dbOrderId });

    if (action === 'mark_failed') {
      if (!storeId || !dbOrderId) {
        throw new Error('storeId and dbOrderId are required');
      }

      await logPaymentEvent(supabaseClient, 'mark_failed_received', {
        storeId,
        orderId: dbOrderId,
        gatewayOrderId: razorpay_order_id,
        details: {
          reason: reason || 'payment_not_completed',
          failureDetails: failureDetails || {},
        },
      });

      const failedResponse = {
        failure_reason: reason || 'payment_not_completed',
        failure_details: failureDetails || {},
        failed_at: new Date().toISOString(),
      };

      const { data: failedOrder, error: failedError } = await supabaseClient
        .from('orders')
        .update({
          payment_status: 'failed',
          payment_response: failedResponse,
        })
        .eq('id', dbOrderId)
        .eq('store_id', storeId)
        .eq('payment_gateway', 'razorpay')
        .eq('payment_status', 'awaiting_payment')
        .select('id, gateway_order_id')
        .maybeSingle();

      if (failedError) {
        await logPaymentEvent(supabaseClient, 'order_mark_failed_failed', {
          storeId,
          orderId: dbOrderId,
          details: { error: failedError.message, reason },
        });
        throw failedError;
      }

      if (failedOrder) {
        const { data: releaseResult, error: releaseError } = await supabaseClient.rpc('release_stock_reservation', {
          p_order_id: failedOrder.id,
          p_reason: reason || 'payment_not_completed',
        });

        if (releaseError || releaseResult?.success === false) {
          await logPaymentEvent(supabaseClient, 'stock_reservation_release_failed', {
            storeId,
            orderId: failedOrder.id,
            gatewayOrderId: failedOrder.gateway_order_id ?? razorpay_order_id,
            details: {
              error: releaseError?.message ?? releaseResult?.error ?? 'Reservation release failed',
              result: releaseResult ?? null,
            },
          });
          throw releaseError ?? new Error(releaseResult?.error || 'Reservation release failed');
        }

        await logPaymentEvent(supabaseClient, 'order_marked_failed', {
          storeId,
          orderId: failedOrder.id,
          gatewayOrderId: failedOrder.gateway_order_id ?? razorpay_order_id,
          details: {
            reason: reason || 'payment_not_completed',
            failureDetails: failureDetails || {},
            stockReservationReleased: releaseResult?.released ?? false,
          },
        });
      } else {
        const { data: currentOrder } = await supabaseClient
          .from('orders')
          .select('id, status, payment_status, payment_gateway, payment_id, gateway_order_id, updated_at')
          .eq('id', dbOrderId)
          .eq('store_id', storeId)
          .maybeSingle();

        await logPaymentEvent(supabaseClient, 'order_mark_failed_skipped', {
          storeId,
          orderId: dbOrderId,
          gatewayOrderId: currentOrder?.gateway_order_id ?? razorpay_order_id,
          paymentId: currentOrder?.payment_id ?? undefined,
          details: {
            reason: reason || 'payment_not_completed',
            currentOrder: currentOrder || null,
          },
        });
      }

      return new Response(
        JSON.stringify({ success: true, orderId: dbOrderId, markedFailed: Boolean(failedOrder) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

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

    const { data: paidResult, error: updateError } = await supabaseClient.rpc(
      'mark_razorpay_order_paid_with_stock_reservation',
      {
        p_order_id: order.id,
        p_store_id: storeId,
        p_gateway_order_id: razorpay_order_id,
        p_payment_id: razorpay_payment_id,
        p_payment_response: paymentResponse,
      }
    );

    if (updateError || paidResult?.success === false) {
      await logPaymentEvent(supabaseClient, 'order_mark_paid_failed', {
        storeId,
        orderId: order.id,
        gatewayOrderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        details: {
          error: updateError?.message ?? paidResult?.error ?? 'Order payment update failed',
          result: paidResult ?? null,
        },
      });
      throw updateError ?? new Error(paidResult?.error || 'Order payment update failed');
    }

    const updatedOrder = paidResult?.order ?? null;
    const alreadyCompleted = Boolean(paidResult?.already_completed);

    if (updatedOrder) {
      if (!alreadyCompleted) {
        await logPaymentEvent(supabaseClient, 'order_marked_paid', {
          storeId,
          orderId: updatedOrder.id,
          gatewayOrderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          details: {
            stockReservationCompleted: true,
            reservation_id: paidResult?.reservation_id ?? null,
          },
        });
      }

      if (!alreadyCompleted) {
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
