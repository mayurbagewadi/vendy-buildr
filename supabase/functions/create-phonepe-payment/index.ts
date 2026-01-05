import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePaymentRequest {
  amount: number; // Amount in paise (e.g., 10000 for ₹100)
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  storeId: string;
}

// Helper to generate PhonePe checksum
async function generatePhonePeChecksum(
  payload: string,
  saltKey: string,
  saltIndex: string
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload + '/pg/v1/pay' + saltKey);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `${hashHex}###${saltIndex}`;
  } catch (error) {
    console.error('Checksum generation error:', error);
    throw error;
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

    const requestBody: CreatePaymentRequest = await req.json();
    const { amount, orderId, customerName, customerPhone, customerEmail, storeId } = requestBody;

    // Validate input
    if (!amount || !orderId || !customerName || !customerPhone || !storeId) {
      throw new Error('Missing required parameters');
    }

    // Get store's PhonePe credentials
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('payment_gateway_credentials, slug')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      throw new Error('Store not found');
    }

    const credentials = store.payment_gateway_credentials as any;
    const merchantId = credentials?.phonepe?.merchant_id;
    const saltKey = credentials?.phonepe?.salt_key;
    const saltIndex = credentials?.phonepe?.salt_index;

    if (!merchantId || !saltKey || !saltIndex) {
      throw new Error('PhonePe credentials not configured for this store');
    }

    // Generate unique merchant transaction ID
    const merchantTransactionId = `TXN_${orderId}_${Date.now()}`;

    // Prepare payment payload
    const paymentPayload = {
      merchantId: merchantId,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: customerPhone,
      amount: Math.round(amount), // Amount in paise
      redirectUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-phonepe-payment?merchantTransactionId=${merchantTransactionId}&storeId=${storeId}`,
      redirectMode: 'POST',
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-phonepe-payment`,
      mobileNumber: customerPhone,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    // Convert payload to base64
    const payloadString = JSON.stringify(paymentPayload);
    const payloadBase64 = btoa(payloadString);

    // Generate checksum
    const checksum = await generatePhonePeChecksum(payloadBase64, saltKey, saltIndex);

    // Make request to PhonePe API
    const phonePeResponse = await fetch('https://api.phonepe.com/apis/hermes/pg/v1/pay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
      },
      body: JSON.stringify({
        request: payloadBase64,
      }),
    });

    if (!phonePeResponse.ok) {
      const error = await phonePeResponse.text();
      console.error('PhonePe API error:', error);
      throw new Error(`PhonePe API error: ${error}`);
    }

    const phonePeResult = await phonePeResponse.json();

    if (!phonePeResult.success) {
      throw new Error(phonePeResult.message || 'PhonePe payment initiation failed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: phonePeResult.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: merchantTransactionId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating PhonePe payment:', error);
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
