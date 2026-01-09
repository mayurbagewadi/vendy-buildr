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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requester is a super admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(authToken);

    if (authError || !requestingUser) {
      throw new Error('Unauthorized');
    }

    // Check if requesting user is super admin
    const { data: superAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'super_admin')
      .single();

    if (!superAdmin) {
      throw new Error('Unauthorized: Only super admins can use this feature');
    }

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    // Get the target user from auth.users
    const { data: { user: targetUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

    if (getUserError || !targetUser) {
      throw new Error('User not found in auth system');
    }

    console.log('Target user found:', targetUser.email);

    // Generate a magic link - this does NOT send an email, just creates the token
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email!,
    });

    if (linkError) {
      console.error('Generate link error:', linkError);
      throw new Error(`Failed to generate link: ${linkError.message}`);
    }

    console.log('Link generated successfully');

    // Extract the hashed_token from the response
    const hashedToken = linkData?.properties?.hashed_token;
    const emailOtp = linkData?.properties?.email_otp;

    if (!hashedToken) {
      console.error('No hashed_token in response:', JSON.stringify(linkData, null, 2));
      throw new Error('Failed to generate authentication token');
    }

    console.log('Using hashed_token (OTP is NOT sent to user)');

    // Use verifyOtp to exchange the token for a session
    // This verifies the OTP we just generated without sending any email
    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      email: targetUser.email!,
      token: emailOtp || hashedToken,
      type: 'email',
    });

    if (verifyError) {
      console.error('VerifyOtp error:', verifyError);

      // Fallback: Try using token_hash directly
      console.log('Trying alternative token exchange method...');

      const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          type: 'magiclink',
          token: hashedToken,
        }),
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        console.log('Token exchange successful via verify endpoint');

        if (tokenData.access_token && tokenData.refresh_token) {
          return new Response(
            JSON.stringify({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      }

      throw new Error(`Failed to verify token: ${verifyError.message}`);
    }

    if (!sessionData?.session?.access_token || !sessionData?.session?.refresh_token) {
      console.error('No tokens in session:', JSON.stringify(sessionData, null, 2));
      throw new Error('Failed to create session');
    }

    console.log('Login as user successful for user_id:', user_id);

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token
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
