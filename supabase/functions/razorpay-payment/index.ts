import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  action: 'create_order';
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  user_id: string;
}

interface VerifyPaymentRequest {
  action: 'verify_payment';
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  subscription_id: string;
  user_id: string;
}

type RequestBody = CreateOrderRequest | VerifyPaymentRequest;

// Helper to verify Razorpay signature
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Razorpay credentials from database
    const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';
    const { data: platformSettings, error: settingsError } = await supabaseClient
      .from('platform_settings')
      .select('razorpay_key_id, razorpay_key_secret, razorpay_test_mode')
      .eq('id', SETTINGS_ID)
      .single();

    if (settingsError || !platformSettings) {
      throw new Error('Platform settings not found');
    }

    const razorpayKeyId = platformSettings.razorpay_key_id || Deno.env.get('RAZORPAY_KEY_ID') || '';
    const razorpayKeySecret = platformSettings.razorpay_key_secret || Deno.env.get('RAZORPAY_KEY_SECRET') || '';

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const requestBody: RequestBody = await req.json();

    if (requestBody.action === 'create_order') {
      const { plan_id, billing_cycle, user_id } = requestBody;

      // Get plan details
      const { data: plan, error: planError } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .eq('id', plan_id)
        .single();

      if (planError || !plan) {
        throw new Error('Plan not found');
      }

      // Calculate amount based on billing cycle
      const amount = billing_cycle === 'yearly' && plan.yearly_price
        ? plan.yearly_price
        : plan.monthly_price;

      // Amount should be in paise (₹100 = 10000 paise)
      const amountInPaise = amount * 100;

      // Create Razorpay order
      // Receipt must be <= 40 chars, so use timestamp + short user_id
      const shortUserId = user_id.substring(0, 8);
      const timestamp = Date.now().toString().substring(5); // Last 8 digits
      const orderData = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `sub_${shortUserId}_${timestamp}`,
        notes: {
          plan_id: plan_id,
          plan_name: plan.name,
          billing_cycle: billing_cycle,
          user_id: user_id,
        },
      };

      const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!razorpayResponse.ok) {
        const error = await razorpayResponse.text();
        throw new Error(`Razorpay API error: ${error}`);
      }

      const razorpayOrder = await razorpayResponse.json();

      // Create subscription record with pending status
      const { data: subscription, error: subError } = await supabaseClient
        .from('subscriptions')
        .insert({
          user_id: user_id,
          plan_id: plan_id,
          status: 'pending_payment',
          billing_cycle: billing_cycle,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (subError) {
        throw new Error(`Failed to create subscription: ${subError.message}`);
      }

      // Create transaction record
      const { error: txnError } = await supabaseClient
        .from('transactions')
        .insert({
          user_id: user_id,
          subscription_id: subscription.id,
          amount: amount,
          gst_amount: 0,
          total_amount: amount,
          status: 'pending',
          payment_gateway: 'razorpay',
          razorpay_order_id: razorpayOrder.id,
        });

      if (txnError) {
        throw new Error(`Failed to create transaction: ${txnError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          order_id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          subscription_id: subscription.id,
          key_id: razorpayKeyId, // Return key_id for frontend Razorpay checkout
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (requestBody.action === 'verify_payment') {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscription_id, user_id } = requestBody;

      console.log('🔐 Starting payment verification:', {
        razorpay_order_id,
        razorpay_payment_id,
        subscription_id,
        user_id
      });

      // Verify signature (using razorpayKeySecret from database loaded earlier)
      const isValid = await verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        razorpayKeySecret
      );

      if (!isValid) {
        console.error('❌ Payment signature verification failed');
        throw new Error('Invalid payment signature');
      }

      console.log('✅ Payment signature verified successfully');

      // Get subscription details
      console.log('📋 Fetching subscription details...');
      const { data: subscription, error: subError } = await supabaseClient
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('id', subscription_id)
        .single();

      if (subError || !subscription) {
        console.error('❌ Subscription not found:', subError);
        throw new Error('Subscription not found');
      }

      console.log('✅ Subscription found:', {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.subscription_plans?.name
      });

      // Calculate subscription period
      const startDate = new Date();
      const endDate = new Date(startDate);
      if (subscription.billing_cycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      // Cancel all other subscriptions for this user before activating the new one
      console.log('🔄 Cancelling old subscriptions...');
      const { error: cancelOldSubsError } = await supabaseClient
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user_id)
        .neq('id', subscription_id)
        .in('status', ['trial', 'active', 'pending_payment']);

      if (cancelOldSubsError) {
        console.error('⚠️ Failed to cancel old subscriptions:', cancelOldSubsError);
        // Don't throw error here, continue with activation
      } else {
        console.log('✅ Old subscriptions cancelled');
      }

      // Update subscription to active
      console.log('🎯 Activating subscription...', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        billing_cycle: subscription.billing_cycle
      });

      const { error: updateSubError } = await supabaseClient
        .from('subscriptions')
        .update({
          status: 'active',
          started_at: startDate.toISOString(),
          next_billing_at: endDate.toISOString(),
          current_period_start: startDate.toISOString(),
          current_period_end: endDate.toISOString(),
          payment_gateway: 'razorpay',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription_id);

      if (updateSubError) {
        console.error('❌ Failed to activate subscription:', updateSubError);
        throw new Error(`Failed to update subscription: ${updateSubError.message}`);
      }

      console.log('✅ Subscription activated successfully');

      // Update transaction
      console.log('💳 Updating transaction record...');
      const { error: updateTxnError } = await supabaseClient
        .from('transactions')
        .update({
          status: 'success',
          payment_id: razorpay_payment_id,
          razorpay_signature: razorpay_signature,
          updated_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', razorpay_order_id)
        .eq('user_id', user_id);

      if (updateTxnError) {
        console.error('❌ Failed to update transaction:', updateTxnError);
        throw new Error(`Failed to update transaction: ${updateTxnError.message}`);
      }

      console.log('✅ Transaction updated successfully');
      console.log('🎉 Payment verification completed successfully!');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment verified successfully',
          subscription: {
            id: subscription.id,
            status: 'active',
            current_period_end: endDate.toISOString(),
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
