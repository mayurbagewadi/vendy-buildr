/**
 * Enterprise-level Marketplace Payment Edge Function
 * Handles payment order creation and verification for marketplace features
 * All credentials and sensitive operations are handled server-side
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

interface CreateOrderRequest {
  action: 'create_order';
  feature_slug: string;
  pricing_type: 'onetime' | 'monthly' | 'yearly';
  store_id: string;
  user_id: string;
}

interface VerifyPaymentRequest {
  action: 'verify_payment';
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  feature_slug: string;
  pricing_type: 'onetime' | 'monthly' | 'yearly';
  store_id: string;
  user_id: string;
}

type RequestBody = CreateOrderRequest | VerifyPaymentRequest;

/**
 * Verify Razorpay signature using HMAC SHA256
 */
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    console.log('📥 Marketplace Payment Function called');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('✅ Supabase client created');

    // Parse request body first to check what we're dealing with
    let requestBody: RequestBody;
    try {
      requestBody = await req.json();
      console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Get Razorpay credentials from platform settings
    console.log('🔑 Fetching Razorpay credentials from platform_settings...');
    const { data: platformSettings, error: settingsError } = await supabaseClient
      .from('platform_settings')
      .select('razorpay_key_id, razorpay_key_secret')
      .eq('id', SETTINGS_ID)
      .single();

    if (settingsError) {
      console.error('❌ Settings error:', settingsError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Platform settings error: ${settingsError.message}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    if (!platformSettings) {
      console.error('❌ Platform settings not found');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Platform settings not found. Please configure Razorpay credentials in Super Admin settings.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    const razorpayKeyId = platformSettings.razorpay_key_id || Deno.env.get('RAZORPAY_KEY_ID') || '';
    const razorpayKeySecret = platformSettings.razorpay_key_secret || Deno.env.get('RAZORPAY_KEY_SECRET') || '';

    console.log('🔑 Razorpay Key ID:', razorpayKeyId ? `${razorpayKeyId.substring(0, 10)}...` : 'MISSING');
    console.log('🔑 Razorpay Secret:', razorpayKeySecret ? 'EXISTS' : 'MISSING');

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ Razorpay credentials not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Razorpay credentials not configured. Please add them in Super Admin settings.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    // ============================================
    // CREATE ORDER
    // ============================================
    if (requestBody.action === 'create_order') {
      console.log('🛒 CREATE ORDER action');
      const { feature_slug, pricing_type, store_id, user_id } = requestBody;

      console.log('📝 Order params:', { feature_slug, pricing_type, store_id, user_id });

      // Get feature details
      console.log('🔍 Fetching feature from marketplace_features...');
      const { data: feature, error: featureError } = await supabaseClient
        .from('marketplace_features')
        .select('*')
        .eq('slug', feature_slug)
        .single();

      if (featureError) {
        console.error('❌ Feature error:', featureError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Feature error: ${featureError.message}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      if (!feature) {
        console.error('❌ Feature not found:', feature_slug);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Feature '${feature_slug}' not found in marketplace`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      console.log('✅ Feature found:', feature.name);

      // Check if already purchased
      console.log('🔍 Checking for existing purchase...');
      const { data: existingPurchase } = await supabaseClient
        .from('marketplace_purchases')
        .select('*')
        .eq('store_id', store_id)
        .eq('feature_slug', feature_slug)
        .eq('status', 'active')
        .maybeSingle();

      if (existingPurchase) {
        console.log('⚠️ Feature already purchased');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Feature already purchased'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log('✅ No existing purchase found');

      // Determine price and quota based on pricing type
      let amount = 0;
      let quota = 15;

      console.log('💰 Calculating price for:', pricing_type);
      console.log('📊 Feature pricing:', {
        price_onetime: feature.price_onetime,
        price_monthly: feature.price_monthly,
        price_yearly: feature.price_yearly
      });

      switch (pricing_type) {
        case 'onetime':
          amount = feature.price_onetime || feature.price;
          quota = feature.quota_onetime || 15;
          break;
        case 'monthly':
          amount = feature.price_monthly || 0;
          quota = feature.quota_monthly || 30;
          break;
        case 'yearly':
          amount = feature.price_yearly || 0;
          quota = feature.quota_yearly || 50;
          break;
      }

      console.log('💵 Final amount:', amount, 'Quota:', quota);

      if (amount <= 0) {
        console.error('❌ Invalid amount:', amount);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid pricing option. Amount is ${amount}. Please check feature pricing configuration.`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Create Razorpay order
      console.log('🎫 Creating Razorpay order...');
      const razorpayPayload = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        receipt: `marketplace_${feature_slug}_${Date.now()}`,
        notes: {
          feature_slug,
          pricing_type,
          store_id,
          user_id,
          quota,
        },
      };

      console.log('📤 Razorpay payload:', JSON.stringify(razorpayPayload, null, 2));

      const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        },
        body: JSON.stringify(razorpayPayload),
      });

      console.log('📨 Razorpay response status:', orderResponse.status);

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        console.error('❌ Razorpay order creation failed:', errorData);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Razorpay error: ${errorData.error?.description || 'Failed to create payment order'}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      const razorpayOrder = await orderResponse.json();
      console.log('✅ Razorpay order created:', razorpayOrder.id);

      return new Response(
        JSON.stringify({
          success: true,
          order_id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key_id: razorpayKeyId,
          feature_name: feature.name,
          quota,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ============================================
    // VERIFY PAYMENT
    // ============================================
    if (requestBody.action === 'verify_payment') {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        feature_slug,
        pricing_type,
        store_id,
        user_id,
      } = requestBody;

      // Verify signature
      const isValid = await verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        razorpayKeySecret
      );

      if (!isValid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid payment signature'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get feature details
      const { data: feature, error: featureError } = await supabaseClient
        .from('marketplace_features')
        .select('*')
        .eq('slug', feature_slug)
        .single();

      if (featureError || !feature) {
        throw new Error('Feature not found');
      }

      // Determine price and quota
      let amount = 0;
      let quota = 15;

      switch (pricing_type) {
        case 'onetime':
          amount = feature.price_onetime || feature.price;
          quota = feature.quota_onetime || 15;
          break;
        case 'monthly':
          amount = feature.price_monthly || 0;
          quota = feature.quota_monthly || 30;
          break;
        case 'yearly':
          amount = feature.price_yearly || 0;
          quota = feature.quota_yearly || 50;
          break;
      }

      // Calculate expiry date
      let expiresAt = null;
      if (pricing_type === 'monthly') {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);
        expiresAt = expiry.toISOString();
      } else if (pricing_type === 'yearly') {
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        expiresAt = expiry.toISOString();
      }

      // Create purchase record
      const { data: purchase, error: purchaseError } = await supabaseClient
        .from('marketplace_purchases')
        .insert({
          user_id,
          store_id,
          feature_slug,
          pricing_type,
          amount_paid: amount,
          quota_limit: quota,
          calls_used: 0,
          status: 'active',
          expires_at: expiresAt,
          auto_renew: pricing_type !== 'onetime',
          payment_id: razorpay_payment_id,
        })
        .select()
        .single();

      if (purchaseError) {
        console.error('Failed to create purchase record:', purchaseError);
        throw new Error('Failed to create purchase record');
      }

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          purchase,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalid action
    console.error('❌ Invalid action:', requestBody.action);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Invalid action: ${requestBody.action || 'missing'}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );

  } catch (error: any) {
    console.error('❌ Marketplace payment error:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
