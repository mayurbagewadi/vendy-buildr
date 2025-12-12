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
    const { code, userId } = await req.json();

    if (!code || !userId) {
      throw new Error('Missing code or userId');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange error:', error);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();
    const expiryTime = new Date(Date.now() + tokens.expires_in * 1000);

    // Update store with tokens
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expiry: expiryTime.toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Store update error:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, hasRefreshToken: !!tokens.refresh_token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
