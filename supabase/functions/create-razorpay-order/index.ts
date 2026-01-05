import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  amount: number; // Amount in paise (e.g., 10000 for ₹100)
  currency: string; // e.g., 'INR'
  storeId: string;
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

    const requestBody: CreateOrderRequest = await req.json();
    const { amount, currency, storeId } = requestBody;

    // Validate input
    if (!amount || !currency || !storeId) {
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
    const razorpayKeyId = credentials?.razorpay?.key_id;
    const razorpayKeySecret = credentials?.razorpay?.key_secret;

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured for this store');
    }

    // Create Razorpay order
    const timestamp = Date.now().toString().substring(5);
    const orderData = {
      amount: Math.round(amount), // Ensure it's an integer
      currency: currency,
      receipt: `order_${timestamp}`,
      notes: {
        store_id: storeId,
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
      console.error('Razorpay API error:', error);
      throw new Error(`Razorpay API error: ${error}`);
    }

    const razorpayOrder = await razorpayResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
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
