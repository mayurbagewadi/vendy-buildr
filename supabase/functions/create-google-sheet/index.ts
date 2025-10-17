import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken() {
  const serviceAccountJson = Deno.env.get('GOOGLE_SHEETS_SERVICE_ACCOUNT');
  if (!serviceAccountJson) {
    throw new Error('Service account not configured');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Replace literal \n with actual newlines, then extract the key content
  const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${signatureInput}.${encodedSignature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to get access token');
  }

  const tokens = await tokenResponse.json();
  return tokens.access_token;
}

async function getDriveAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Replace literal \n with actual newlines, then extract the key content
  const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${signatureInput}.${encodedSignature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to get access token');
  }

  const tokens = await tokenResponse.json();
  return tokens.access_token;
}

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

    const accessToken = await getAccessToken();

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

    // Get user email to share the sheet
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .single();

    // Share sheet with store owner using Drive API
    if (profile?.email) {
      try {
        const driveServiceAccount = Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT');
        if (driveServiceAccount) {
          // Get Drive API access token
          const driveAccessToken = await getDriveAccessToken(driveServiceAccount);
          
          // Grant writer access to the store owner
          await fetch(
            `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${driveAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'user',
                role: 'writer',
                emailAddress: profile.email,
              }),
            }
          );
          console.log(`Shared sheet with ${profile.email}`);
        }
      } catch (driveError) {
        console.error('Error sharing sheet:', driveError);
        // Don't fail the request if sharing fails
      }
    }

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
