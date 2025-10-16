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
    const { userId, products } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: store } = await supabase
      .from('stores')
      .select('google_access_token, google_sheet_id')
      .eq('user_id', userId)
      .single();

    if (!store || !store.google_sheet_id) {
      throw new Error('Google Sheet not connected');
    }

    // Convert products to sheet rows
    const rows: any[][] = [];
    products.forEach((product: any) => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((variant: any) => {
          rows.push([
            product.id,
            product.name,
            product.category || '',
            product.description || '',
            product.basePrice || '',
            product.baseSku || '',
            variant.name || '',
            variant.price || '',
            variant.sku || '',
            product.stock || 0,
            product.images?.[0] || '',
            product.images?.[1] || '',
            product.images?.[2] || '',
            product.images?.[3] || '',
            product.images?.[4] || '',
            product.youtubeUrl || '',
            product.status || 'draft',
            new Date().toISOString().split('T')[0],
            new Date().toISOString().split('T')[0],
          ]);
        });
      } else {
        rows.push([
          product.id,
          product.name,
          product.category || '',
          product.description || '',
          product.basePrice || '',
          product.baseSku || '',
          '',
          '',
          '',
          product.stock || 0,
          product.images?.[0] || '',
          product.images?.[1] || '',
          product.images?.[2] || '',
          product.images?.[3] || '',
          product.images?.[4] || '',
          product.youtubeUrl || '',
          product.status || 'draft',
          new Date().toISOString().split('T')[0],
          new Date().toISOString().split('T')[0],
        ]);
      }
    });

    // Clear existing data (except header)
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${store.google_sheet_id}/values/Products!A2:Z:clear`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${store.google_access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Write new data
    if (rows.length > 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${store.google_sheet_id}/values/Products!A2:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${store.google_access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: rows,
          }),
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, rowsWritten: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync products error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
