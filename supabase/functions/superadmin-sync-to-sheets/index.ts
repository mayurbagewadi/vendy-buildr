import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

const SHEET_HEADERS = [
  'Store Name',
  'Store URL',
  'Owner Email',
  'Owner Name',
  'Phone',
  'WhatsApp',
  'Custom Domain',
  'Plan',
  'Plan Status',
  'Total Orders',
  'Total Revenue (INR)',
  'Store Created Date',
  'Owner Signup Date',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { action } = body;

    // ── Public config (no auth needed) ────────────────────────────────────
    if (action === 'get_oauth_config') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured in Supabase secrets' }),
          { headers: corsHeaders, status: 500 }
        );
      }
      return new Response(JSON.stringify({ client_id: clientId }), { headers: corsHeaders });
    }

    // ── append_store: called by pg_net trigger (anon key, no user auth) ───
    if (action === 'append_store') {
      const { store_id } = body;
      if (!store_id) {
        return new Response(JSON.stringify({ error: 'store_id required' }), { headers: corsHeaders, status: 400 });
      }

      const settings = await getSettings(supabaseAdmin);
      if (!settings?.superadmin_google_access_token || !settings?.superadmin_google_sheet_id) {
        // Sheets not connected — silently skip (not an error)
        return new Response(JSON.stringify({ skipped: true, reason: 'sheets not connected' }), { headers: corsHeaders });
      }

      const accessToken = await getValidAccessToken(supabaseAdmin, settings);
      const row = await getStoreRow(supabaseAdmin, store_id);
      if (!row) {
        return new Response(JSON.stringify({ error: 'Store not found' }), { headers: corsHeaders, status: 404 });
      }

      await appendRow(accessToken, settings.superadmin_google_sheet_id, row);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // ── All other actions require super_admin verification ─────────────────
    // Project uses user_roles table (role = 'super_admin'), not a super_admins table
    const { admin_id } = body;
    if (!admin_id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — admin_id required' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const { data: adminRow } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', admin_id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!adminRow) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid admin_id' }),
        { headers: corsHeaders, status: 403 }
      );
    }

    // ── exchange_code: swap Google OAuth code for tokens ──────────────────
    if (action === 'exchange_code') {
      const { code } = body;
      if (!code) {
        return new Response(JSON.stringify({ error: 'code required' }), { headers: corsHeaders, status: 400 });
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
          redirect_uri: 'postmessage',
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error('[exchange_code] Google token error:', err);
        throw new Error('Failed to exchange Google OAuth code');
      }

      const tokens = await tokenRes.json();
      const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const updates: Record<string, string | null> = {
        superadmin_google_access_token: tokens.access_token,
        superadmin_google_token_expiry: expiry,
      };
      if (tokens.refresh_token) {
        updates.superadmin_google_refresh_token = tokens.refresh_token;
      }

      const { error: updateErr } = await supabaseAdmin
        .from('platform_settings')
        .update(updates)
        .eq('id', SETTINGS_ID);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, has_refresh_token: !!tokens.refresh_token }),
        { headers: corsHeaders }
      );
    }

    // ── setup: create master sheet + backfill all existing stores ─────────
    if (action === 'setup') {
      console.log('[setup] starting');
      const settings = await getSettings(supabaseAdmin);
      console.log('[setup] access_token exists:', !!settings?.superadmin_google_access_token);
      console.log('[setup] sheet_id:', settings?.superadmin_google_sheet_id ?? 'null');

      if (!settings?.superadmin_google_access_token) {
        return new Response(
          JSON.stringify({ error: 'Google not connected — run exchange_code first' }),
          { headers: corsHeaders, status: 400 }
        );
      }

      const accessToken = await getValidAccessToken(supabaseAdmin, settings);
      console.log('[setup] access token refreshed/valid, length:', accessToken?.length ?? 0);

      let sheetId = settings.superadmin_google_sheet_id;
      let sheetUrl = settings.superadmin_google_sheet_url;

      // Create sheet only if it doesn't exist yet
      if (!sheetId) {
        console.log('[setup] no sheet_id — creating new sheet');
        const created = await createMasterSheet(accessToken);
        sheetId = created.sheetId;
        sheetUrl = created.sheetUrl;
        console.log('[setup] new sheet created:', sheetId);

        await supabaseAdmin
          .from('platform_settings')
          .update({ superadmin_google_sheet_id: sheetId, superadmin_google_sheet_url: sheetUrl })
          .eq('id', SETTINGS_ID);
      } else {
        console.log('[setup] using existing sheet_id:', sheetId);
      }

      // Backfill all existing stores
      const rows = await getAllStoreRows(supabaseAdmin);
      console.log('[setup] rows to write:', rows.length);

      if (rows.length > 0) {
        const putUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/Stores!A2?valueInputOption=RAW';
        console.log('[setup] PUT url:', putUrl);
        const putRes = await fetch(putUrl, {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: rows }),
        });
        console.log('[setup] Google Sheets PUT status:', putRes.status);
        if (!putRes.ok) {
          const putErr = await putRes.json();
          console.error('[setup] PUT error body:', JSON.stringify(putErr));
          throw new Error('Google Sheets write failed (' + putRes.status + '): ' + (putErr.error?.message ?? JSON.stringify(putErr)));
        }
        console.log('[setup] PUT succeeded');
      }

      return new Response(
        JSON.stringify({ success: true, sheetId, sheetUrl, storeCount: rows.length }),
        { headers: corsHeaders }
      );
    }

    // ── disconnect: clear all Google tokens and sheet reference ──────────
    if (action === 'disconnect') {
      // Only clear auth tokens — keep sheet_id and sheet_url so reconnect reuses same sheet
      await supabaseAdmin
        .from('platform_settings')
        .update({
          superadmin_google_access_token: null,
          superadmin_google_refresh_token: null,
          superadmin_google_token_expiry: null,
        })
        .eq('id', SETTINGS_ID);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), { headers: corsHeaders, status: 400 });

  } catch (error) {
    console.error('[superadmin-sync-to-sheets] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: corsHeaders, status: 500 }
    );
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSettings(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select(
      'superadmin_google_access_token, superadmin_google_refresh_token, superadmin_google_token_expiry, superadmin_google_sheet_id, superadmin_google_sheet_url'
    )
    .eq('id', SETTINGS_ID)
    .single();
  return data;
}

async function getValidAccessToken(
  supabaseAdmin: ReturnType<typeof createClient>,
  settings: Record<string, string | null>
): Promise<string> {
  const now = new Date();
  const expiry = settings.superadmin_google_token_expiry
    ? new Date(settings.superadmin_google_token_expiry)
    : null;

  if (expiry && now >= expiry && settings.superadmin_google_refresh_token) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: settings.superadmin_google_refresh_token!,
        grant_type: 'refresh_token',
      }),
    });

    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      const newExpiry = new Date(now.getTime() + refreshData.expires_in * 1000).toISOString();
      await supabaseAdmin
        .from('platform_settings')
        .update({
          superadmin_google_access_token: refreshData.access_token,
          superadmin_google_token_expiry: newExpiry,
        })
        .eq('id', SETTINGS_ID);
      return refreshData.access_token;
    }
  }

  return settings.superadmin_google_access_token!;
}

async function createMasterSheet(accessToken: string): Promise<{ sheetId: string; sheetUrl: string }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: 'DigitalDukandar — All Stores' },
      sheets: [{
        properties: {
          title: 'Stores',
          gridProperties: { rowCount: 10000, columnCount: 15, frozenRowCount: 1 },
        },
      }],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error('Failed to create Google Sheet: ' + (err.error?.message ?? 'Unknown error'));
  }

  const sheetData = await createRes.json();
  const sheetId: string = sheetData.spreadsheetId;
  const sheetUrl: string = sheetData.spreadsheetUrl;

  // Write headers
  await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/Stores!A1?valueInputOption=RAW',
    {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    }
  );

  // Style header row + auto-resize columns
  await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + ':batchUpdate',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.13, green: 0.59, blue: 0.95 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 11,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: SHEET_HEADERS.length },
            },
          },
        ],
      }),
    }
  );

  return { sheetId, sheetUrl };
}

async function getAllStoreRows(supabaseAdmin: ReturnType<typeof createClient>): Promise<unknown[][]> {
  const { data: stores } = await supabaseAdmin
    .from('stores')
    .select('id, name, slug, whatsapp_number, custom_domain, created_at, user_id')
    .order('created_at', { ascending: true });

  if (!stores || stores.length === 0) return [];

  const userIds = (stores as any[]).map((s) => s.user_id);
  const storeIds = (stores as any[]).map((s) => s.id);

  const [profilesRes, subsRes, ordersRes, authUsersRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('user_id, email, full_name, phone, created_at')
      .in('user_id', userIds),
    supabaseAdmin
      .from('subscriptions')
      .select('user_id, status, subscription_plans(name)')
      .in('user_id', userIds)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('orders')
      .select('store_id, total')
      .in('store_id', storeIds),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // Build lookup maps
  const profileMap = new Map<string, any>();
  ((profilesRes.data ?? []) as any[]).forEach((p) => profileMap.set(p.user_id, p));

  // Auth email fallback — covers users who never completed registration
  const authEmailMap = new Map<string, string>();
  ((authUsersRes.data?.users ?? []) as any[]).forEach((u) => {
    if (u.id && u.email) authEmailMap.set(u.id, u.email);
  });

  // Best subscription per user (first in desc order = most recent active)
  const subMap = new Map<string, any>();
  ((subsRes.data ?? []) as any[]).forEach((sub) => {
    if (!subMap.has(sub.user_id)) subMap.set(sub.user_id, sub);
  });

  // Aggregate orders per store
  const orderMap = new Map<string, { count: number; total: number }>();
  ((ordersRes.data ?? []) as any[]).forEach((o) => {
    const existing = orderMap.get(o.store_id) ?? { count: 0, total: 0 };
    existing.count += 1;
    existing.total += o.total ?? 0;
    orderMap.set(o.store_id, existing);
  });

  return (stores as any[]).map((store) => {
    const profile = profileMap.get(store.user_id);
    const sub = subMap.get(store.user_id);
    const orders = orderMap.get(store.id) ?? { count: 0, total: 0 };
    const authEmail = authEmailMap.get(store.user_id) ?? '';
    return buildRow(store, profile, sub, orders, authEmail);
  });
}

async function getStoreRow(
  supabaseAdmin: ReturnType<typeof createClient>,
  storeId: string
): Promise<unknown[] | null> {
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id, name, slug, whatsapp_number, custom_domain, created_at, user_id')
    .eq('id', storeId)
    .single();

  if (!store) return null;

  const [profileRes, subRes, authUserRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('user_id, email, full_name, phone, created_at')
      .eq('user_id', (store as any).user_id)
      .maybeSingle(),
    supabaseAdmin
      .from('subscriptions')
      .select('user_id, status, subscription_plans(name)')
      .eq('user_id', (store as any).user_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById((store as any).user_id),
  ]);

  const authEmail = authUserRes.data?.user?.email ?? '';
  return buildRow(store as any, profileRes.data, subRes.data, { count: 0, total: 0 }, authEmail);
}

async function appendRow(accessToken: string, sheetId: string, row: unknown[]): Promise<void> {
  const appendRes = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/Stores!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    }
  );

  if (!appendRes.ok) {
    const err = await appendRes.json();
    throw new Error('Failed to append row: ' + (err.error?.message ?? 'Unknown error'));
  }
}

function buildRow(
  store: any,
  profile: any,
  sub: any,
  orders: { count: number; total: number },
  authEmail = ''
): unknown[] {
  const email = profile?.email || authEmail;
  const name = profile?.full_name || emailToName(authEmail);
  const storeUrl = 'https://yesgive.shop/' + (store.slug ?? '');
  const planName = sub?.subscription_plans?.name ?? 'Free';
  const planStatus = sub?.status ?? 'None';
  const storeCreatedDate = store.created_at
    ? new Date(store.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const ownerSignupDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return [
    store.name ?? '',
    storeUrl,
    email,
    name,
    profile?.phone ?? '',
    store.whatsapp_number ?? '',
    store.custom_domain ?? '',
    planName,
    planStatus,
    orders.count,
    orders.total,
    storeCreatedDate,
    ownerSignupDate,
  ];
}

function emailToName(email: string): string {
  if (!email) return '';
  const prefix = email.split('@')[0];
  return prefix
    .replace(/[._\-]/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .filter((w) => w.length > 0)
    .join(' ') || prefix;
}
