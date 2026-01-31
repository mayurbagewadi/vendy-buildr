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

    // Get request body (optional sheet ID for drag & drop)
    const body = await req.json().catch(() => ({}));
    const customSheetId = body.sheetId || null;

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

    // Determine which sheet to use (custom or template)
    const sheetId = customSheetId || store.google_sheet_id;

    if (!sheetId) {
      return new Response(
        JSON.stringify({
          error: 'No Google Sheet found. Please create a template or provide a sheet ID.',
          needsTemplate: true,
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

    // Read data from Google Sheet
    const readResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Products!A2:AA10000`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!readResponse.ok) {
      const errorData = await readResponse.json();
      throw new Error(`Failed to read from Google Sheet: ${errorData.error?.message || 'Unknown error'}`);
    }

    const sheetData = await readResponse.json();
    const rows = sheetData.values || [];

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No products found in sheet',
          created: 0,
          updated: 0,
        }),
        { headers: corsHeaders }
      );
    }

    // Use service role key for database operations
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (!row || row.length === 0 || !row[1]) continue;

      try {
        const productId = row[0] || null;
        const productName = row[1] || '';
        const description = row[2] || '';
        const category = row[3] || '';
        const basePrice = parseFloat(row[4]) || 0;
        const status = row[5] || 'draft';
        const sku = row[6] || '';
        const stock = parseInt(row[7]) || 0;

        // Collect images
        const images = [];
        for (let j = 8; j <= 12; j++) {
          if (row[j]) images.push(row[j]);
        }

        // Collect variants
        const variants = [];
        for (let j = 13; j <= 24; j += 4) {
          const variantName = row[j] || '';
          if (variantName) {
            variants.push({
              name: variantName,
              price: parseFloat(row[j + 1]) || 0,
              sku: row[j + 2] || '',
              stock: parseInt(row[j + 3]) || 0,
            });
          }
        }

        // Prepare product data
        const productData = {
          store_id: store.id,
          name: productName,
          description,
          category,
          base_price: basePrice,
          basePrice: basePrice,
          status: status.toLowerCase(),
          sku,
          stock,
          images,
          variants,
        };

        // Check if product exists (by ID or SKU)
        let existingProduct = null;
        if (productId) {
          const { data } = await supabaseService
            .from('products')
            .select('id')
            .eq('id', productId)
            .eq('store_id', store.id)
            .single();
          existingProduct = data;
        } else if (sku) {
          const { data } = await supabaseService
            .from('products')
            .select('id')
            .eq('sku', sku)
            .eq('store_id', store.id)
            .single();
          existingProduct = data;
        }

        if (existingProduct) {
          // Update existing product
          const { error: updateError } = await supabaseService
            .from('products')
            .update(productData)
            .eq('id', existingProduct.id);

          if (updateError) {
            errors.push(`Row ${i + 2}: ${updateError.message}`);
          } else {
            updated++;
          }
        } else {
          // Create new product
          const { error: insertError } = await supabaseService
            .from('products')
            .insert(productData);

          if (insertError) {
            errors.push(`Row ${i + 2}: ${insertError.message}`);
          } else {
            created++;
          }
        }
      } catch (rowError) {
        errors.push(`Row ${i + 2}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Import completed: ${created} created, ${updated} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        created,
        updated,
        errors: errors.length > 0 ? errors.slice(0, 10) : [],
        totalErrors: errors.length,
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[IMPORT-FROM-SHEETS] Error:', error);
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
