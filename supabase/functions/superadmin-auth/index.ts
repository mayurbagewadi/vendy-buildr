import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Simple password verification using Web Crypto API
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // For now, do a simple comparison - in production you should use proper hashing
    // The hash in the database should be created using the same method
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex === hash;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

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
    // Validate domain - only allow requests from authorized domain
    const origin = req.headers.get('origin') || '';
    const ALLOWED_DOMAIN = 'superadmin.yesgive.shop';
    
    // Extract hostname from origin
    let requestDomain = '';
    try {
      requestDomain = new URL(origin).hostname;
    } catch (e) {
      requestDomain = origin;
    }
    
    // Allow localhost for development
    const isLocalhost = requestDomain.includes('localhost') || requestDomain.includes('127.0.0.1');
    const isAllowedDomain = requestDomain === ALLOWED_DOMAIN;
    
    if (!isLocalhost && !isAllowedDomain) {
      console.log('Unauthorized domain access attempt:', requestDomain);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Access denied: Unauthorized domain' 
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
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

    // Verify password using Web Crypto API
    const passwordMatch = await verifyPassword(password, admin.password_hash);

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
