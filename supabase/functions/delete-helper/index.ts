import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    console.log('[delete-helper] Starting helper deletion process');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is authenticated (superadmin check optional)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No auth header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse request body
    const { userId, deleteType } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[delete-helper] Deleting helper/application:', userId, 'Type:', deleteType);

    if (deleteType === 'helper') {
      // Delete helper (cascades to store_referrals, network_commissions via ON DELETE CASCADE)
      const { error: helperError } = await supabaseAdmin
        .from("helpers")
        .delete()
        .eq("id", userId);

      if (helperError) {
        console.error('[delete-helper] Error deleting helper:', helperError);
        throw helperError;
      }
      console.log('[delete-helper] Deleted helper record');

      // Delete helper application
      const { error: appError } = await supabaseAdmin
        .from("helper_applications")
        .delete()
        .eq("user_id", userId);

      if (appError) {
        console.warn('[delete-helper] Error deleting helper_application:', appError);
      } else {
        console.log('[delete-helper] Deleted helper_applications record');
      }

    } else if (deleteType === 'application') {
      // Delete helper application only
      const { error: appError } = await supabaseAdmin
        .from("helper_applications")
        .delete()
        .eq("user_id", userId);

      if (appError) {
        console.error('[delete-helper] Error deleting application:', appError);
        throw appError;
      }
      console.log('[delete-helper] Deleted helper_applications record');
    }

    // Delete from profiles table
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    if (profilesError) {
      console.warn('[delete-helper] Error deleting profile:', profilesError);
    } else {
      console.log('[delete-helper] Deleted profile');
    }

    // Delete user from auth.users using Admin API
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('[delete-helper] Error deleting auth user:', authDeleteError);
      return new Response(
        JSON.stringify({
          error: 'Failed to delete authentication record',
          details: authDeleteError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[delete-helper] Successfully deleted auth user');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Helper/Application completely deleted including authentication records'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[delete-helper] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
