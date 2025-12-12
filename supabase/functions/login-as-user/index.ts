import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requester is a super admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser(authToken);

    if (authError || !requestingUser) {
      throw new Error('Unauthorized');
    }

    // Check if requesting user is super admin
    const { data: superAdmin } = await supabaseClient
      .from('super_admins')
      .select('id')
      .eq('email', requestingUser.email)
      .single();

    if (!superAdmin) {
      throw new Error('Unauthorized: Only super admins can use this feature');
    }

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    // Get user email
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('user_id', user_id)
      .single();

    if (!profile) {
      throw new Error('User not found');
    }

    // Create a new session for the user using Supabase Admin API directly
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: profile.email,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to generate link: ${errorData.message || response.statusText}`);
    }

    const linkData = await response.json();

    // Extract the hashed_token from the action_link
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      throw new Error('No action link in response');
    }

    const url = new URL(actionLink);
    const hashToken = url.hash.substring(1); // Remove the # at the start
    const params = new URLSearchParams(hashToken);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) {
      throw new Error('No tokens found in magic link');
    }

    console.log('Login as user successful for user_id:', user_id);

    return new Response(
      JSON.stringify({
        access_token,
        refresh_token
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in login-as-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});