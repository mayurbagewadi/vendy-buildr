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
    console.log('[approve-helper] Starting helper approval process');

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No auth header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse request body
    const { applicationId } = await req.json();

    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: 'applicationId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[approve-helper] Approving application:', applicationId);

    // Fetch application details
    const { data: application, error: fetchError } = await supabaseAdmin
      .from('helper_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      console.error('[approve-helper] Error fetching application:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Generate referral code
    const { count } = await supabaseAdmin
      .from("helpers")
      .select("*", { count: "exact", head: true });

    const referralCode = `HELP${String((count || 0) + 1).padStart(3, "0")}`;
    const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'http://localhost:8080';

    // Insert into helpers table (using service role to bypass RLS)
    const { error: helperError } = await supabaseAdmin.from("helpers").insert({
      id: application.user_id,
      application_id: application.id,
      full_name: application.full_name,
      email: application.email,
      phone: application.phone,
      referral_code: referralCode,
      store_referral_link: `${baseUrl}/signup?ref=${referralCode}`,
      helper_recruitment_link: `${baseUrl}/become-helper?ref=${referralCode}`,
      recruited_by_helper_id: application.recruited_by_helper_id,
      status: "Active",
    });

    if (helperError) {
      console.error('[approve-helper] Error creating helper:', helperError);
      return new Response(
        JSON.stringify({ error: 'Failed to create helper record', details: helperError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[approve-helper] Helper record created successfully');

    // Update application status to Approved
    const { error: updateError } = await supabaseAdmin
      .from("helper_applications")
      .update({
        application_status: "Approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (updateError) {
      console.error('[approve-helper] Error updating application:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update application status', details: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[approve-helper] Application approved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Helper approved and activated successfully',
        referralCode: referralCode
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[approve-helper] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
