import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    // Get store information
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, google_sheet_id, google_sheet_url, google_access_token, google_refresh_token, google_token_expiry')
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { headers: corsHeaders, status: 404 }
      );
    }

    // Check if Google Drive is connected
    if (!store.google_access_token) {
      return new Response(
        JSON.stringify({
          error: 'Google Drive not connected. Please connect your Google Drive first.',
          needsDriveConnection: true,
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // Check if token needs refresh
    let accessToken = store.google_access_token;
    const tokenExpiry = store.google_token_expiry ? new Date(store.google_token_expiry) : null;
    const now = new Date();

    if (tokenExpiry && now >= tokenExpiry) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          refresh_token: store.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh Google access token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      const newExpiry = new Date(now.getTime() + refreshData.expires_in * 1000);
      await supabase
        .from('stores')
        .update({
          google_access_token: accessToken,
          google_token_expiry: newExpiry.toISOString(),
        })
        .eq('id', store.id);
    }

    // Create template if it doesn't exist
    let sheetId = store.google_sheet_id;
    let sheetUrl = store.google_sheet_url;

    if (!sheetId) {
      console.log('[EXPORT] No template found, creating one...');

      // Create Google Sheet
      const sheetTitle = `${store.name} - Products Export`;
      const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: sheetTitle,
          },
          sheets: [{
            properties: {
              title: 'Products',
              gridProperties: {
                rowCount: 1000,
                columnCount: 30,
                frozenRowCount: 1,
              },
            },
          }],
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`Failed to create Google Sheet: ${errorData.error?.message || 'Unknown error'}`);
      }

      const sheetData = await createResponse.json();
      sheetId = sheetData.spreadsheetId;
      sheetUrl = sheetData.spreadsheetUrl;

      // Define column headers
      const headers = [
        'Product ID', 'Product Name', 'Description', 'Category', 'Base Price', 'Status', 'SKU', 'Stock',
        'Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5',
        'Variant 1 Name', 'Variant 1 Price', 'Variant 1 SKU', 'Variant 1 Stock',
        'Variant 2 Name', 'Variant 2 Price', 'Variant 2 SKU', 'Variant 2 Stock',
        'Variant 3 Name', 'Variant 3 Price', 'Variant 3 SKU', 'Variant 3 Stock',
        'Created Date', 'Updated Date',
      ];

      // Write headers
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Products!A1:AA1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [headers] }),
        }
      );

      // Format header row
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
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
                  range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.2, green: 0.6, blue: 0.86 },
                      textFormat: { foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true },
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat)',
                },
              },
              {
                autoResizeDimensions: {
                  dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: headers.length },
                },
              },
            ],
          }),
        }
      );

      // Make sheet publicly editable
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: 'writer', type: 'anyone' }),
        }
      );

      // Save to database
      const supabaseService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabaseService
        .from('stores')
        .update({
          google_sheet_id: sheetId,
          google_sheet_url: sheetUrl,
          google_sheet_created_at: new Date().toISOString(),
        })
        .eq('id', store.id);

      console.log('[EXPORT] Template created successfully');
    }

    // Get all products for this store
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false });

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No products to export',
          productsCount: 0,
        }),
        { headers: corsHeaders }
      );
    }

    // Convert products to rows
    const rows = products.map(product => {
      const variants = product.variants || [];
      const images = product.images || [];

      return [
        product.id,
        product.name || '',
        product.description || '',
        product.category || '',
        product.base_price || product.basePrice || '',
        product.status || 'draft',
        product.sku || '',
        product.stock || '',
        images[0] || '',
        images[1] || '',
        images[2] || '',
        images[3] || '',
        images[4] || '',
        variants[0]?.name || '',
        variants[0]?.price || '',
        variants[0]?.sku || '',
        variants[0]?.stock || '',
        variants[1]?.name || '',
        variants[1]?.price || '',
        variants[1]?.sku || '',
        variants[1]?.stock || '',
        variants[2]?.name || '',
        variants[2]?.price || '',
        variants[2]?.sku || '',
        variants[2]?.stock || '',
        product.created_at || '',
        product.updated_at || '',
      ];
    });

    // Clear existing data (keep header row)
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Products!A2:AA10000:clear`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Write new data
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Products!A2?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rows,
        }),
      }
    );

    if (!writeResponse.ok) {
      const errorData = await writeResponse.json();
      throw new Error(`Failed to write to Google Sheet: ${errorData.error?.message || 'Unknown error'}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully exported ${products.length} products to Google Sheets`,
        productsCount: products.length,
        sheetUrl: sheetUrl,
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[EXPORT-TO-SHEETS] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
