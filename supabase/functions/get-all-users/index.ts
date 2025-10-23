import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is a super admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      // Check for superadmin session
      const sessionHeader = req.headers.get('x-superadmin-session');
      if (!sessionHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Check if user has super_admin role
      const { data: roles, error: roleError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .single();

      if (roleError || !roles) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch all users from auth.users using admin API
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw authError;
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Create a map of profiles by user_id for quick lookup
    const profileMap = new Map();
    (profiles || []).forEach(profile => {
      profileMap.set(profile.user_id, profile);
    });

    // Merge auth users with profile data
    const mergedUsers = authUsers.users.map(authUser => {
      const profile = profileMap.get(authUser.id);
      
      return {
        id: authUser.id,
        email: authUser.email || '',
        full_name: profile?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
        phone: profile?.phone || authUser.phone || null,
        created_at: authUser.created_at,
        user_id: authUser.id,
        avatar_url: profile?.avatar_url || null,
        // Include raw auth metadata for debugging if needed
        email_confirmed: authUser.email_confirmed_at ? true : false,
        last_sign_in: authUser.last_sign_in_at,
      };
    });

    return new Response(
      JSON.stringify({ users: mergedUsers }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-all-users function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
