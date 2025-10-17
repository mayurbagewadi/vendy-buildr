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

  const privateKey = serviceAccount.private_key;
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.substring(pemHeader.length, privateKey.length - pemFooter.length).replace(/\s/g, '');
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
    const { userId, products } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: store } = await supabase
      .from('stores')
      .select('google_sheet_id')
      .eq('user_id', userId)
      .single();

    if (!store || !store.google_sheet_id) {
      throw new Error('Google Sheet not connected');
    }

    const accessToken = await getAccessToken();

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
          'Authorization': `Bearer ${accessToken}`,
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
            'Authorization': `Bearer ${accessToken}`,
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
