import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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
    )

    // Get all users from auth.users
    const { data: { users }, error: authError } = await supabaseClient.auth.admin.listUsers()
    
    if (authError) throw authError

    // Get existing profiles
    const { data: existingProfiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('user_id')

    if (profilesError) throw profilesError

    const existingUserIds = new Set(existingProfiles?.map(p => p.user_id) || [])
    
    // Find users without profiles
    const missingProfiles = users.filter(user => !existingUserIds.has(user.id))
    
    if (missingProfiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All users already have profiles', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert missing profiles
    const newProfiles = missingProfiles.map(user => ({
      user_id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      phone: user.phone || null,
    }))

    const { error: insertError } = await supabaseClient
      .from('profiles')
      .insert(newProfiles)

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ 
        message: 'Successfully synced missing profiles', 
        count: missingProfiles.length,
        synced: newProfiles.map(p => p.email)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
