import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser(token);

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

    // Generate magic link for the user
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    });

    if (linkError) throw linkError;

    console.log('Login as user successful for user_id:', user_id);

    // Extract tokens from the link
    const url = new URL(linkData.properties.action_link);
    const accessToken = url.searchParams.get('token') || '';
    const refreshToken = url.searchParams.get('refresh_token') || '';

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken
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