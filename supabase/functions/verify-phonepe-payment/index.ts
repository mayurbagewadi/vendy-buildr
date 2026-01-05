import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  merchantTransactionId: string;
  storeId: string;
}

// Helper to verify PhonePe checksum
async function verifyPhonePeChecksum(
  response: string,
  saltKey: string,
  xVerify: string
): Promise<boolean> {
  try {
    const [checksum, saltIndex] = xVerify.split('###');

    const encoder = new TextEncoder();
    const data = encoder.encode(response + saltKey);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return checksum === expectedChecksum;
  } catch (error) {
    console.error('Checksum verification error:', error);
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
    const { merchantTransactionId, storeId } = requestBody;

    console.log('🔐 Starting PhonePe payment verification:', {
      merchantTransactionId,
      storeId
    });

    // Validate input
    if (!merchantTransactionId || !storeId) {
      throw new Error('Missing required parameters');
    }

    // Get store's PhonePe credentials
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('payment_gateway_credentials')
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

    // Check payment status with PhonePe
    const statusUrl = `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`;

    // Generate checksum for status check
    const statusChecksum = await (async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode(`/pg/v1/status/${merchantId}/${merchantTransactionId}${saltKey}`);

      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return `${hashHex}###${saltIndex}`;
    })();

    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': statusChecksum,
        'X-MERCHANT-ID': merchantId,
      },
    });

    if (!statusResponse.ok) {
      const error = await statusResponse.text();
      console.error('PhonePe status check error:', error);
      throw new Error(`PhonePe status check failed: ${error}`);
    }

    const statusResult = await statusResponse.json();

    console.log('PhonePe status result:', statusResult);

    // Check if payment was successful
    if (statusResult.success && statusResult.code === 'PAYMENT_SUCCESS') {
      console.log('✅ Payment verified successfully');

      return new Response(
        JSON.stringify({
          verified: true,
          message: 'Payment verified successfully',
          transactionId: statusResult.data.transactionId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      console.error('❌ Payment verification failed:', statusResult);

      return new Response(
        JSON.stringify({
          verified: false,
          error: statusResult.message || 'Payment verification failed',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error('Error verifying PhonePe payment:', error);
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
