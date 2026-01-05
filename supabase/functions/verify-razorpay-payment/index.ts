import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  orderId: string;
  paymentId: string;
  signature: string;
  storeId: string;
}

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

    const requestBody: VerifyPaymentRequest = await req.json();
    const { orderId, paymentId, signature, storeId } = requestBody;

    console.log('🔐 Starting payment verification:', {
      orderId,
      paymentId,
      storeId
    });

    // Validate input
    if (!orderId || !paymentId || !signature || !storeId) {
      throw new Error('Missing required parameters');
    }

    // Get store's Razorpay credentials
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

    // Verify signature
    const isValid = await verifyRazorpaySignature(
      orderId,
      paymentId,
      signature,
      razorpayKeySecret
    );

    if (!isValid) {
      console.error('❌ Payment signature verification failed');
      return new Response(
        JSON.stringify({
          verified: false,
          error: 'Invalid payment signature',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('✅ Payment signature verified successfully');

    return new Response(
      JSON.stringify({
        verified: true,
        message: 'Payment verified successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        verified: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
