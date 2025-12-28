// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface UserRole {
  user_id: string;
}

interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  created_at: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  user_metadata?: Record<string, any>;
}

interface Store {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  last_admin_visit: string | null;
  whatsapp_number: string | null;
}

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  billing_cycle: string;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  whatsapp_orders_used: number;
  website_orders_used: number;
  updated_at: string;
  subscription_plans: { name: string } | null;
}

interface OrderStats {
  store_id: string;
  total_revenue: number;
  order_count: number;
  last_order_date: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body for pagination params
    let page = 1;
    let perPage = 50;

    try {
      const body = await req.json();
      page = Math.max(1, parseInt(body.page) || 1);
      perPage = Math.min(100, Math.max(10, parseInt(body.perPage) || 50));
    } catch {
      // Use defaults if no body or invalid JSON
    }

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
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get IDs to exclude (super admins, helpers)
    const [superAdminResult, helpersResult, helperAppsResult] = await Promise.all([
      supabaseAdmin.from('user_roles').select('user_id').eq('role', 'super_admin'),
      supabaseAdmin.from('helpers').select('id'),
      supabaseAdmin.from('helper_applications').select('user_id')
    ]);

    const excludeIds = new Set<string>([
      ...((superAdminResult.data as UserRole[] | null)?.map(r => r.user_id) || []),
      ...((helpersResult.data as any[] | null)?.map(h => h.id) || []),
      ...((helperAppsResult.data as any[] | null)?.map(ha => ha.user_id) || [])
    ]);

    // Fetch ALL auth users to get accurate total count and proper pagination
    // We need to fetch in batches since Supabase auth.admin.listUsers has a max of 1000 per call
    let allAuthUsers: AuthUser[] = [];
    let authPage = 1;
    const authPerPage = 1000;

    while (true) {
      const { data: authBatch, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: authPage,
        perPage: authPerPage
      });

      if (authError) {
        console.error('Error fetching auth users:', authError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch users', details: authError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!authBatch?.users || authBatch.users.length === 0) {
        break;
      }

      allAuthUsers = allAuthUsers.concat(authBatch.users as AuthUser[]);

      // If we got less than perPage, we've reached the end
      if (authBatch.users.length < authPerPage) {
        break;
      }

      authPage++;
    }

    // Filter out excluded users
    const regularUsers = allAuthUsers.filter((authUser: AuthUser) => !excludeIds.has(authUser.id));

    // Sort by created_at descending (newest first)
    regularUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Calculate pagination
    const totalCount = regularUsers.length;
    const totalPages = Math.ceil(totalCount / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedUsers = regularUsers.slice(startIndex, endIndex);

    // Handle case when no users exist
    if (paginatedUsers.length === 0) {
      return new Response(
        JSON.stringify({
          users: [],
          pagination: { page, perPage, totalCount, totalPages }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user IDs for this page only
    const userIds = paginatedUsers.map((u: AuthUser) => u.id);

    // Fetch all related data in parallel for this page's users only
    const [profilesResult, storesResult, subscriptionsResult] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('user_id, full_name, phone, avatar_url')
        .in('user_id', userIds),
      supabaseAdmin
        .from('stores')
        .select('id, name, slug, user_id, last_admin_visit, whatsapp_number')
        .in('user_id', userIds),
      supabaseAdmin
        .from('subscriptions')
        .select(`
          id, user_id, status, billing_cycle, started_at,
          current_period_start, current_period_end, trial_ends_at,
          whatsapp_orders_used, website_orders_used, updated_at,
          subscription_plans (name)
        `)
        .in('user_id', userIds)
        .order('updated_at', { ascending: false })
    ]);

    // Create lookup maps
    const profileMap = new Map<string, Profile>();
    ((profilesResult.data as Profile[] | null) || []).forEach((profile: Profile) => {
      profileMap.set(profile.user_id, profile);
    });

    const storeMap = new Map<string, Store>();
    ((storesResult.data as Store[] | null) || []).forEach((store: Store) => {
      storeMap.set(store.user_id, store);
    });

    // For subscriptions, pick the best one per user (active > trial > others)
    const subscriptionMap = new Map<string, Subscription>();
    const now = new Date();
    const subsByUser = new Map<string, Subscription[]>();

    ((subscriptionsResult.data as Subscription[] | null) || []).forEach((sub: Subscription) => {
      if (!subsByUser.has(sub.user_id)) {
        subsByUser.set(sub.user_id, []);
      }
      subsByUser.get(sub.user_id)!.push(sub);
    });

    subsByUser.forEach((subs, oderId) => {
      // Filter out expired/cancelled and actually expired periods
      const validSubs = subs.filter(sub => {
        if (sub.status === 'cancelled' || sub.status === 'expired') return false;
        if (sub.current_period_end && new Date(sub.current_period_end) < now) return false;
        return true;
      });

      if (validSubs.length > 0) {
        // Prioritize: active > trial > others
        const activeSub = validSubs.find(s => s.status === 'active');
        const trialSub = validSubs.find(s => s.status === 'trial');
        subscriptionMap.set(oderId, activeSub || trialSub || validSubs[0]);
      }
    });

    // Fetch order stats for stores (batch query)
    const storeIds = Array.from(storeMap.values()).map(s => s.id);
    let orderStatsMap = new Map<string, OrderStats>();

    if (storeIds.length > 0) {
      const { data: ordersData } = await supabaseAdmin
        .from('orders')
        .select('store_id, total, created_at')
        .in('store_id', storeIds);

      // Aggregate order stats per store
      const statsTemp = new Map<string, { total: number; count: number; lastDate: string | null }>();
      ((ordersData as any[] | null) || []).forEach((order: any) => {
        const existing = statsTemp.get(order.store_id) || { total: 0, count: 0, lastDate: null };
        existing.total += order.total || 0;
        existing.count += 1;
        if (!existing.lastDate || order.created_at > existing.lastDate) {
          existing.lastDate = order.created_at;
        }
        statsTemp.set(order.store_id, existing);
      });

      statsTemp.forEach((stats, storeId) => {
        orderStatsMap.set(storeId, {
          store_id: storeId,
          total_revenue: stats.total,
          order_count: stats.count,
          last_order_date: stats.lastDate
        });
      });
    }

    // Merge all data
    const mergedUsers = paginatedUsers.map((authUser: AuthUser) => {
      const profile = profileMap.get(authUser.id);
      const store = storeMap.get(authUser.id);
      const subscription = subscriptionMap.get(authUser.id);
      const orderStats = store ? orderStatsMap.get(store.id) : null;

      return {
        id: authUser.id,
        email: authUser.email || '',
        full_name: profile?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
        phone: profile?.phone || authUser.phone || null,
        created_at: authUser.created_at,
        user_id: authUser.id,
        avatar_url: profile?.avatar_url || null,
        email_confirmed: authUser.email_confirmed_at ? true : false,
        last_sign_in: authUser.last_sign_in_at,
        store: store ? {
          id: store.id,
          name: store.name,
          slug: store.slug,
          last_admin_visit: store.last_admin_visit,
          whatsapp_number: store.whatsapp_number
        } : null,
        subscription: subscription ? {
          id: subscription.id,
          plan: subscription.subscription_plans,
          status: subscription.status,
          billing_cycle: subscription.billing_cycle,
          started_at: subscription.started_at,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          trial_ends_at: subscription.trial_ends_at,
          whatsapp_orders_used: subscription.whatsapp_orders_used,
          website_orders_used: subscription.website_orders_used
        } : null,
        totalRevenue: orderStats?.total_revenue || 0,
        lastOrderDate: orderStats?.last_order_date || null,
        orderCount: orderStats?.order_count || 0
      };
    });

    return new Response(
      JSON.stringify({
        users: mergedUsers,
        pagination: {
          page,
          perPage,
          totalCount,
          totalPages
        }
      }),
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
