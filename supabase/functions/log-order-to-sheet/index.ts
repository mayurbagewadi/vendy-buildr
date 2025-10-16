import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, order } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: store } = await supabase
      .from('stores')
      .select('google_access_token, google_sheet_id, user_id')
      .eq('id', storeId)
      .single();

    if (!store || !store.google_sheet_id) {
      console.log('No Google Sheet connected, skipping sheet logging');
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const orderDate = now.toISOString().split('T')[0];
    const orderTime = now.toTimeString().split(' ')[0];

    const productsOrdered = JSON.stringify(order.items.map((item: any) => ({
      name: item.name,
      variant: item.variant || '',
      quantity: item.quantity,
      price: item.price,
    })));

    const row = [
      order.order_number,
      orderDate,
      orderTime,
      order.customer_name,
      order.customer_phone,
      order.customer_email || '',
      order.delivery_address,
      '', // city
      order.delivery_pincode || '',
      productsOrdered,
      order.total,
      order.payment_method,
      order.status,
      'YES',
      now.toISOString(),
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${store.google_sheet_id}/values/Orders!A:O:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${store.google_access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Log order error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Don't fail the order if sheet logging fails
    return new Response(
      JSON.stringify({ success: true, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
