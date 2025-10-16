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
    const { userId, storeName } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get store with access token
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('google_access_token, google_refresh_token, google_token_expiry')
      .eq('user_id', userId)
      .single();

    if (storeError || !store) {
      throw new Error('Store not found');
    }

    let accessToken = store.google_access_token;

    // Check if token expired and refresh if needed
    if (store.google_token_expiry && new Date(store.google_token_expiry) < new Date()) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
          refresh_token: store.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        accessToken = tokens.access_token;
        const expiryTime = new Date(Date.now() + tokens.expires_in * 1000);

        await supabase
          .from('stores')
          .update({
            google_access_token: accessToken,
            google_token_expiry: expiryTime.toISOString(),
          })
          .eq('user_id', userId);
      }
    }

    // Create new spreadsheet
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${storeName} - Products & Orders`,
        },
        sheets: [
          { properties: { title: 'Products' } },
          { properties: { title: 'Orders' } },
        ],
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('Sheet creation error:', error);
      throw new Error('Failed to create spreadsheet');
    }

    const sheet = await createResponse.json();
    const spreadsheetId = sheet.spreadsheetId;
    const spreadsheetUrl = sheet.spreadsheetUrl;

    // Setup Products sheet headers
    const productsHeaders = [
      'product_id', 'product_name', 'category', 'description', 'base_price', 'base_sku',
      'variant_name', 'variant_price', 'variant_sku', 'stock_quantity',
      'image_url_1', 'image_url_2', 'image_url_3', 'image_url_4', 'image_url_5',
      'youtube_video_url', 'status', 'date_added', 'last_modified'
    ];

    // Setup Orders sheet headers
    const ordersHeaders = [
      'order_id', 'order_date', 'order_time', 'customer_name', 'customer_phone',
      'customer_email', 'delivery_address', 'city', 'postal_code',
      'products_ordered', 'total_amount', 'payment_method', 'order_status',
      'whatsapp_sent', 'created_at'
    ];

    // Write headers to both sheets
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: [
            {
              range: 'Products!A1:S1',
              values: [productsHeaders],
            },
            {
              range: 'Orders!A1:O1',
              values: [ordersHeaders],
            },
          ],
        }),
      }
    );

    // Format headers (bold, background color)
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.6, blue: 0.86 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
            {
              repeatCell: {
                range: {
                  sheetId: sheet.sheets[1].properties.sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.6, blue: 0.86 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
          ],
        }),
      }
    );

    // Update store with sheet info
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        google_sheet_id: spreadsheetId,
        google_sheet_url: spreadsheetUrl,
        google_sheet_connected: true,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Store update error:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        spreadsheetId, 
        spreadsheetUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create sheet error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
