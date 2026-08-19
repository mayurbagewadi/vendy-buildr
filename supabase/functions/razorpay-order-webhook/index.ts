// Razorpay webhook — server-to-server payment confirmation for storefront orders.
//
// This is the backup path for `verify-razorpay-payment`. That function only runs if
// the customer's own browser successfully calls it after checkout. If the browser
// closes, loses signal, or the app is killed before that call, the order is never
// confirmed. This webhook is called directly by Razorpay's servers instead, so it
// does not depend on the customer's device at all.
//
// Setup (per store, one-time): store owner adds this URL as a webhook in their own
// Razorpay Dashboard → Settings → Webhooks, subscribed to `payment.captured` and
// `payment.failed`, and pastes the generated secret into Payment Settings.
// URL: https://api.digitaldukandar.in/functions/v1/razorpay-order-webhook?store_id=<storeId>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

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

async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const generatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return generatedSignature === signature;
  } catch (error) {
    console.error('[razorpay-order-webhook] Signature verification error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  // Always acknowledge with 200 unless the request is structurally invalid —
  // returning non-2xx for business-logic issues just makes Razorpay retry the
  // same event on a schedule we don't control, without changing the outcome.
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const storeId = url.searchParams.get('store_id');
    const signature = req.headers.get('x-razorpay-signature');
    const rawBody = await req.text();

    if (!storeId || !signature || !rawBody) {
      return new Response(JSON.stringify({ success: false, error: 'Missing store_id, signature, or body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('payment_gateway_credentials')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      console.warn('[razorpay-order-webhook] Unknown store_id:', storeId);
      return new Response(JSON.stringify({ success: true, ignored: 'unknown_store' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const webhookSecret = (store.payment_gateway_credentials as any)?.razorpay?.webhook_secret;

    if (!webhookSecret) {
      // Not configured for this store — nothing to verify against, so refuse to
      // process an unverifiable payload rather than trusting it blindly.
      console.warn('[razorpay-order-webhook] No webhook secret configured for store:', storeId);
      return new Response(JSON.stringify({ success: true, ignored: 'webhook_not_configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error('[razorpay-order-webhook] Invalid signature for store:', storeId);
      await logPaymentEvent(supabase, 'webhook_signature_invalid', { storeId });
      return new Response(JSON.stringify({ success: false, error: 'Invalid signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.event;
    const entity = event?.payload?.payment?.entity;

    if (!entity) {
      return new Response(JSON.stringify({ success: true, ignored: 'no_payment_entity' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const dbOrderId: string | undefined = entity.notes?.db_order_id;
    const razorpayOrderId: string | undefined = entity.order_id;
    const razorpayPaymentId: string | undefined = entity.id;

    if (!dbOrderId) {
      // Older/unrelated orders (e.g. subscription payments) won't carry this note.
      return new Response(JSON.stringify({ success: true, ignored: 'no_db_order_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (eventType === 'payment.captured') {
      // Idempotency: same guard verify-razorpay-payment uses. If this payment_id
      // was already recorded (customer's browser beat the webhook, or a retry),
      // there is nothing left to do.
      const { data: existing } = await supabase
        .from('payment_verifications')
        .select('razorpay_payment_id')
        .eq('razorpay_payment_id', razorpayPaymentId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, already_processed: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      await supabase.from('payment_verifications').upsert(
        { razorpay_payment_id: razorpayPaymentId, razorpay_order_id: razorpayOrderId, store_id: storeId },
        { onConflict: 'razorpay_payment_id', ignoreDuplicates: true }
      );

      await logPaymentEvent(supabase, 'webhook_payment_captured_received', {
        storeId,
        orderId: dbOrderId,
        gatewayOrderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
      });

      const paymentResponse = {
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        verified_via: 'webhook',
        verified_at: new Date().toISOString(),
      };

      const { data: paidResult, error: updateError } = await supabase.rpc(
        'mark_razorpay_order_paid_with_stock_reservation',
        {
          p_order_id: dbOrderId,
          p_store_id: storeId,
          p_gateway_order_id: razorpayOrderId,
          p_payment_id: razorpayPaymentId,
          p_payment_response: paymentResponse,
        }
      );

      if (updateError || paidResult?.success === false) {
        await logPaymentEvent(supabase, 'webhook_order_mark_paid_failed', {
          storeId,
          orderId: dbOrderId,
          gatewayOrderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          details: { error: updateError?.message ?? paidResult?.error ?? 'Order payment update failed' },
        });
        // Still 200 — a DB-side failure here needs the reconciliation sweep / manual
        // review, not a Razorpay retry storm, since retries won't change a DB error.
        return new Response(JSON.stringify({ success: false, error: 'order_update_failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const updatedOrder = paidResult?.order ?? null;
      const alreadyCompleted = Boolean(paidResult?.already_completed);

      if (updatedOrder && !alreadyCompleted) {
        await logPaymentEvent(supabase, 'webhook_order_marked_paid', {
          storeId,
          orderId: updatedOrder.id,
          gatewayOrderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          details: { stock_conflict: paidResult?.stock_conflict ?? null },
        });

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
          console.warn('[razorpay-order-webhook] Order email trigger failed:', emailError);
        }
      }

      return new Response(JSON.stringify({ success: true, orderId: dbOrderId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (eventType === 'payment.failed') {
      // Mirrors the "mark_failed" path the client already uses on dismiss/decline —
      // only touches orders still awaiting payment, so it's a safe no-op if the
      // order was already resolved another way (e.g. a later retry succeeded).
      const { data: failedOrder, error: failedError } = await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          payment_response: {
            failed_via: 'webhook',
            razorpay_payment_id: razorpayPaymentId,
            failed_at: new Date().toISOString(),
          },
        })
        .eq('id', dbOrderId)
        .eq('store_id', storeId)
        .eq('payment_gateway', 'razorpay')
        .eq('payment_status', 'awaiting_payment')
        .select('id')
        .maybeSingle();

      if (failedError) {
        await logPaymentEvent(supabase, 'webhook_order_mark_failed_failed', {
          storeId,
          orderId: dbOrderId,
          details: { error: failedError.message },
        });
        return new Response(JSON.stringify({ success: false, error: failedError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      if (failedOrder) {
        await supabase.rpc('release_stock_reservation', {
          p_order_id: failedOrder.id,
          p_reason: 'payment_failed_webhook',
        });
        await logPaymentEvent(supabase, 'webhook_order_marked_failed', {
          storeId,
          orderId: failedOrder.id,
          gatewayOrderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
        });
      }

      return new Response(JSON.stringify({ success: true, orderId: dbOrderId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Any other event type — nothing to do.
    return new Response(JSON.stringify({ success: true, ignored: eventType ?? 'unknown_event' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[razorpay-order-webhook] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
