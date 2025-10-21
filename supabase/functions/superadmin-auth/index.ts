import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { compare } from "https://deno.land/x/bcrypt@v0.2.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuperAdminLoginRequest {
  email: string;
  password: string;
  action: 'login' | 'verify';
}

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

    const { email, password, action } = await req.json() as SuperAdminLoginRequest;

    console.log(`Super admin ${action} attempt for:`, email);

    // Query super_admins table
    const { data: admin, error: queryError } = await supabaseClient
      .from('super_admins')
      .select('*')
      .eq('email', email)
      .single();

    if (queryError || !admin) {
      console.log('Super admin not found:', email);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid credentials' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use bcrypt to compare password with hash
    const passwordMatch = await compare(password, admin.password_hash);

    if (!passwordMatch) {
      console.log('Invalid password for super admin:', email);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid credentials' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last login time
    await supabaseClient
      .from('super_admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    // Log the login activity
    await supabaseClient
      .from('activity_log')
      .insert({
        activity_type: 'superadmin_login',
        description: `Super admin ${admin.full_name} logged in`,
        user_email: email,
        metadata: { admin_id: admin.id }
      });

    console.log('Super admin login successful:', email);

    return new Response(
      JSON.stringify({ 
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Super admin auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
