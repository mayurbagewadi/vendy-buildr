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
    console.log('[delete-user-account] Starting user deletion process');

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is a super admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[delete-user-account] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse request body
    const { userId } = await req.json();

    // Check authorization: user can delete their own account OR must be super admin to delete others
    const isSelfDeletion = user.id === userId;

    if (!isSelfDeletion) {
      // Check if user is super admin (required to delete other users)
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (!roles) {
        console.error('[delete-user-account] User is not authorized to delete other accounts');
        return new Response(
          JSON.stringify({ error: 'Forbidden: You can only delete your own account or must be a super admin' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[delete-user-account] Deleting user:', userId);

    // CRITICAL SAFETY CHECK: Warn if user has stores (data will be permanently deleted)
    const { data: userStores } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .eq('user_id', userId);

    const storeIds = userStores?.map(s => s.id) || [];
    const storeNames = userStores?.map(s => s.name).join(', ') || '';

    console.log('[delete-user-account] Found stores:', storeIds.length);

    if (storeIds.length > 0) {
      console.warn('[delete-user-account] ⚠️  WARNING: User owns stores that will be PERMANENTLY DELETED:', storeNames);
      // Log for audit trail - this is a destructive operation
      console.warn('[delete-user-account] Stores to be deleted:', JSON.stringify(userStores));
    }

    // Delete store-related data (respecting foreign key constraints)
    if (storeIds.length > 0) {
      // 1. Delete products for all user's stores
      const { error: productsError } = await supabaseAdmin
        .from('products')
        .delete()
        .in('store_id', storeIds);
      
      if (productsError) {
        console.error('[delete-user-account] Error deleting products:', productsError);
      } else {
        console.log('[delete-user-account] Deleted products');
      }

      // 2. Delete categories for all user's stores
      const { error: categoriesError } = await supabaseAdmin
        .from('categories')
        .delete()
        .in('store_id', storeIds);
      
      if (categoriesError) {
        console.error('[delete-user-account] Error deleting categories:', categoriesError);
      } else {
        console.log('[delete-user-account] Deleted categories');
      }

      // 3. Delete orders for all user's stores
      const { error: ordersError } = await supabaseAdmin
        .from('orders')
        .delete()
        .in('store_id', storeIds);
      
      if (ordersError) {
        console.error('[delete-user-account] Error deleting orders:', ordersError);
      } else {
        console.log('[delete-user-account] Deleted orders');
      }

      // 4. Delete sitemap_submissions for all user's stores
      const { error: sitemapError } = await supabaseAdmin
        .from('sitemap_submissions')
        .delete()
        .in('store_id', storeIds);
      
      if (sitemapError) {
        console.error('[delete-user-account] Error deleting sitemap_submissions:', sitemapError);
      } else {
        console.log('[delete-user-account] Deleted sitemap_submissions');
      }

      // 5. Delete store_activity_logs for all user's stores
      const { error: activityLogsError } = await supabaseAdmin
        .from('store_activity_logs')
        .delete()
        .in('store_id', storeIds);
      
      if (activityLogsError) {
        console.error('[delete-user-account] Error deleting store_activity_logs:', activityLogsError);
      } else {
        console.log('[delete-user-account] Deleted store_activity_logs');
      }
    }

    // Delete user-level data
    
    // 6. Delete from stores table
    const { error: storesError } = await supabaseAdmin
      .from('stores')
      .delete()
      .eq('user_id', userId);
    
    if (storesError) {
      console.error('[delete-user-account] Error deleting stores:', storesError);
    } else {
      console.log('[delete-user-account] Deleted stores');
    }

    // 7. Delete from subscriptions table
    const { error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);
    
    if (subscriptionsError) {
      console.error('[delete-user-account] Error deleting subscriptions:', subscriptionsError);
    } else {
      console.log('[delete-user-account] Deleted subscriptions');
    }

    // 8. Delete from transactions table
    const { error: transactionsError } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('user_id', userId);
    
    if (transactionsError) {
      console.error('[delete-user-account] Error deleting transactions:', transactionsError);
    } else {
      console.log('[delete-user-account] Deleted transactions');
    }

    // 9. Delete from user_roles table
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    
    if (rolesError) {
      console.error('[delete-user-account] Error deleting user_roles:', rolesError);
    } else {
      console.log('[delete-user-account] Deleted user_roles');
    }

    // 10. Delete from profiles table
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    
    if (profilesError) {
      console.error('[delete-user-account] Error deleting profiles:', profilesError);
    } else {
      console.log('[delete-user-account] Deleted profiles');
    }

    // 11. Finally, delete the user from auth.users using Admin API
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      console.error('[delete-user-account] Error deleting auth user:', authDeleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete authentication record',
          details: authDeleteError 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[delete-user-account] Successfully deleted auth user');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User account completely deleted including authentication records',
        deletedStores: storeIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[delete-user-account] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
