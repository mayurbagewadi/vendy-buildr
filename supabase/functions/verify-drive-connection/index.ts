import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          connected: false,
          reason: 'Unauthorized - Missing authorization header'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          connected: false,
          reason: 'Unauthorized - Invalid token'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get the store's Google Drive tokens
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('google_access_token, google_refresh_token, google_token_expiry, id')
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      return new Response(
        JSON.stringify({
          connected: false,
          reason: 'Store not found'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if token exists
    if (!store.google_access_token) {
      return new Response(
        JSON.stringify({
          connected: false,
          reason: 'Google Drive not connected. Click "Connect Drive" to authorize access.'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if token needs refresh
    let accessToken = store.google_access_token;
    const tokenExpiry = store.google_token_expiry ? new Date(store.google_token_expiry) : null;
    const now = new Date();

    if (tokenExpiry && now >= tokenExpiry) {
      // Try to refresh the token
      if (!store.google_refresh_token) {
        return new Response(
          JSON.stringify({
            connected: false,
            reason: 'Token expired and no refresh token available. Please reconnect Google Drive.'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      try {
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
          const errorData = await refreshResponse.json();
          console.error('Token refresh failed:', errorData);

          return new Response(
            JSON.stringify({
              connected: false,
              reason: 'Access token refresh failed. Please reconnect Google Drive.',
              error: errorData.error || 'Token refresh failed'
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;

        // Update the store with new token
        const newExpiry = new Date(now.getTime() + refreshData.expires_in * 1000);
        await supabaseClient
          .from('stores')
          .update({
            google_access_token: accessToken,
            google_token_expiry: newExpiry.toISOString(),
          })
          .eq('id', store.id);

      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return new Response(
          JSON.stringify({
            connected: false,
            reason: 'Failed to refresh access token. Please reconnect Google Drive.'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Make a minimal test API call to verify Drive access
    // Using drive.about.get with minimal fields to check connection
    try {
      const driveResponse = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=user',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!driveResponse.ok) {
        const errorData = await driveResponse.json();
        console.error('Drive API test failed:', errorData);

        // Check if it's a scope issue (403) or revoked access (401)
        if (driveResponse.status === 403) {
          return new Response(
            JSON.stringify({
              connected: false,
              reason: 'Drive access denied. User may have denied Drive permission. Please reconnect and grant Drive access.',
              error: 'insufficient_scope'
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        if (driveResponse.status === 401) {
          return new Response(
            JSON.stringify({
              connected: false,
              reason: 'Drive access revoked. Please reconnect Google Drive.',
              error: 'invalid_grant'
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        return new Response(
          JSON.stringify({
            connected: false,
            reason: 'Failed to verify Drive access. Please try reconnecting.',
            error: errorData.error?.message || 'API call failed'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const driveData = await driveResponse.json();

      // Success! Drive is connected and working
      return new Response(
        JSON.stringify({
          connected: true,
          user: driveData.user?.displayName || null,
          message: 'Google Drive is connected and working'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (apiError) {
      console.error('Error calling Drive API:', apiError);
      return new Response(
        JSON.stringify({
          connected: false,
          reason: 'Unable to reach Google Drive API. Please check your connection and try again.'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Error in verify-drive-connection function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({
        connected: false,
        reason: 'An unexpected error occurred while verifying Drive connection.',
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
