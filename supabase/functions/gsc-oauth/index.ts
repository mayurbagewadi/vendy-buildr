import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;
    console.log('[gsc-oauth] action:', action);

    // ── Public: get_client_id (no auth required) ────────────────────────
    if (action === 'get_client_id') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
      console.log('[gsc-oauth] get_client_id — clientId present:', !!clientId);
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured in Supabase secrets' }),
          { headers: corsHeaders, status: 500 }
        );
      }
      return new Response(JSON.stringify({ client_id: clientId }), { headers: corsHeaders });
    }

    // ── JWT Pattern A auth (all other actions) ──────────────────────────
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    console.log('[gsc-oauth] auth header present:', !!authHeader);
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — missing authorization header' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    console.log('[gsc-oauth] user lookup — user:', user?.id ?? null, '| error:', userError?.message ?? null);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid token' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('id, subdomain, slug, custom_domain, gsc_access_token, gsc_refresh_token, gsc_token_expiry')
      .eq('user_id', user.id)
      .single();
    console.log('[gsc-oauth] store lookup — store:', store?.id ?? null, '| error:', storeError?.message ?? null);

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { headers: corsHeaders, status: 404 }
      );
    }

    // ── exchange_code ────────────────────────────────────────────────────
    if (action === 'exchange_code') {
      const { code } = body;
      console.log('[gsc-oauth] exchange_code — code present:', !!code);
      if (!code) {
        return new Response(
          JSON.stringify({ error: 'code required' }),
          { headers: corsHeaders, status: 400 }
        );
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
      console.log('[gsc-oauth] exchange_code — Google token status:', tokenRes.status);

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error('[gsc-oauth] exchange_code — Google token error:', err);
        throw new Error('Failed to exchange OAuth code with Google: ' + err);
      }

      const tokens = await tokenRes.json();
      console.log('[gsc-oauth] exchange_code — has access_token:', !!tokens.access_token, '| has refresh_token:', !!tokens.refresh_token);
      const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const updates: Record<string, string | null> = {
        gsc_access_token: tokens.access_token,
        gsc_token_expiry: expiry,
      };
      if (tokens.refresh_token) {
        updates.gsc_refresh_token = tokens.refresh_token;
      }

      const { error: updateErr } = await supabaseClient
        .from('stores')
        .update(updates)
        .eq('id', store.id);
      console.log('[gsc-oauth] exchange_code — DB update error:', updateErr?.message ?? null);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, has_refresh_token: !!tokens.refresh_token }),
        { headers: corsHeaders }
      );
    }

    // ── verify ───────────────────────────────────────────────────────────
    if (action === 'verify') {
      console.log('[gsc-oauth] verify — gsc_access_token present:', !!store.gsc_access_token);
      if (!store.gsc_access_token) {
        return new Response(
          JSON.stringify({ connected: false, reason: 'GSC not connected' }),
          { headers: corsHeaders }
        );
      }

      let accessToken = store.gsc_access_token;
      const tokenExpiry = store.gsc_token_expiry ? new Date(store.gsc_token_expiry) : null;
      const now = new Date();

      if (tokenExpiry && now >= tokenExpiry) {
        console.log('[gsc-oauth] verify — token expired, refreshing');
        if (!store.gsc_refresh_token) {
          return new Response(
            JSON.stringify({ connected: false, reason: 'Token expired. Please reconnect Google Search Console.' }),
            { headers: corsHeaders }
          );
        }

        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
            refresh_token: store.gsc_refresh_token,
            grant_type: 'refresh_token',
          }),
        });
        console.log('[gsc-oauth] verify — refresh status:', refreshRes.status);

        if (!refreshRes.ok) {
          console.error('[gsc-oauth] verify — Token refresh failed:', await refreshRes.text());
          return new Response(
            JSON.stringify({ connected: false, reason: 'Token refresh failed. Please reconnect Google Search Console.' }),
            { headers: corsHeaders }
          );
        }

        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;
        const newExpiry = new Date(now.getTime() + refreshData.expires_in * 1000);

        await supabaseClient
          .from('stores')
          .update({ gsc_access_token: accessToken, gsc_token_expiry: newExpiry.toISOString() })
          .eq('id', store.id);
      }

      const gscRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      console.log('[gsc-oauth] verify — GSC API status:', gscRes.status);

      if (!gscRes.ok) {
        return new Response(
          JSON.stringify({ connected: false, reason: 'GSC API call failed. Please reconnect.' }),
          { headers: corsHeaders }
        );
      }

      const gscData = await gscRes.json();
      const sites: string[] = (gscData.siteEntry ?? []).map((s: any) => s.siteUrl);

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      const profile = profileRes.ok ? await profileRes.json() : {};
      console.log('[gsc-oauth] verify — connected, email:', profile.email ?? 'unknown', '| sites:', sites.length);

      return new Response(
        JSON.stringify({ connected: true, email: profile.email ?? '', sites }),
        { headers: corsHeaders }
      );
    }

    // ── setup_verification ───────────────────────────────────────────────
    if (action === 'setup_verification') {
      console.log('[gsc-oauth] setup_verification — gsc_access_token present:', !!store.gsc_access_token);
      if (!store.gsc_access_token) {
        return new Response(
          JSON.stringify({ error: 'Not connected — run exchange_code first' }),
          { headers: corsHeaders, status: 400 }
        );
      }

      const storeHost = store.custom_domain
        ? store.custom_domain
        : (store.subdomain || store.slug) + '.digitaldukandar.in';
      const storeUrl = 'https://' + storeHost + '/';
      console.log('[gsc-oauth] setup_verification — storeUrl:', storeUrl);

      let accessToken = store.gsc_access_token;

      const tokenRes = await fetch('https://www.googleapis.com/siteVerification/v1/token', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationMethod: 'FILE', site: { identifier: storeUrl, type: 'SITE' } }),
      });
      console.log('[gsc-oauth] setup_verification — getToken status:', tokenRes.status);

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        console.error('[gsc-oauth] setup_verification — getToken failed:', JSON.stringify(err));
        throw new Error('Failed to get verification token from Google');
      }

      const tokenData = await tokenRes.json();
      const verificationToken: string = tokenData.token;
      console.log('[gsc-oauth] setup_verification — verificationToken:', verificationToken);

      await supabaseClient.from('stores').update({ gsc_verification_token: verificationToken }).eq('id', store.id);

      const verifyRes = await fetch(
        'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE',
        {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ site: { identifier: storeUrl, type: 'SITE' } }),
        }
      );
      console.log('[gsc-oauth] setup_verification — verify status:', verifyRes.status);

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        console.error('[gsc-oauth] setup_verification — verify failed:', JSON.stringify(err));
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Verification failed — Google could not reach the verification file. Ensure the store is live.',
            detail: err?.error?.message ?? '',
          }),
          { headers: corsHeaders }
        );
      }

      const addSiteRes = await fetch(
        'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(storeUrl),
        { method: 'PUT', headers: { 'Authorization': 'Bearer ' + accessToken } }
      );
      console.log('[gsc-oauth] setup_verification — addSite status:', addSiteRes.status);

      return new Response(
        JSON.stringify({ success: true, storeUrl, verificationToken }),
        { headers: corsHeaders }
      );
    }

    // ── submit_sitemap ───────────────────────────────────────────────────
    if (action === 'submit_sitemap') {
      const accessToken = await getValidToken(store, supabaseClient);
      console.log('[gsc-oauth] submit_sitemap — accessToken present:', !!accessToken);
      if (!accessToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'GSC not connected or token expired. Please reconnect.' }),
          { headers: corsHeaders }
        );
      }

      const storeHost = store.custom_domain
        ? store.custom_domain
        : (store.subdomain || store.slug) + '.digitaldukandar.in';
      const siteUrl = 'https://' + storeHost + '/';
      const sitemapUrl = siteUrl + 'sitemap.xml';

      const res = await fetch(
        'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(siteUrl) + '/sitemaps/' + encodeURIComponent(sitemapUrl),
        { method: 'PUT', headers: { Authorization: 'Bearer ' + accessToken } }
      );
      console.log('[gsc-oauth] submit_sitemap — status:', res.status);

      if (res.ok || res.status === 204) {
        return new Response(JSON.stringify({ success: true, sitemapUrl }), { headers: corsHeaders });
      }

      const err = await res.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ success: false, error: err?.error?.message ?? 'Failed to submit sitemap' }),
        { headers: corsHeaders }
      );
    }

    // ── request_indexing ─────────────────────────────────────────────────
    if (action === 'request_indexing') {
      const accessToken = await getValidToken(store, supabaseClient);
      console.log('[gsc-oauth] request_indexing — accessToken present:', !!accessToken);
      if (!accessToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'GSC not connected or token expired. Please reconnect.' }),
          { headers: corsHeaders }
        );
      }

      const storeHost = store.custom_domain
        ? store.custom_domain
        : (store.subdomain || store.slug) + '.digitaldukandar.in';
      const storeUrl = 'https://' + storeHost + '/';

      const res = await fetch(
        'https://indexing.googleapis.com/v3/urlNotifications:publish',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: storeUrl, type: 'URL_UPDATED' }),
        }
      );
      console.log('[gsc-oauth] request_indexing — status:', res.status);

      if (res.ok) {
        return new Response(JSON.stringify({ success: true, url: storeUrl }), { headers: corsHeaders });
      }

      const err = await res.json().catch(() => ({}));
      const needsReconnect = res.status === 403;
      return new Response(
        JSON.stringify({
          success: false,
          error: needsReconnect
            ? 'Permission denied. Please reconnect Google Search Console to enable indexing.'
            : (err?.error?.message ?? 'Failed to request indexing'),
          needsReconnect,
        }),
        { headers: corsHeaders }
      );
    }

    // ── disconnect ───────────────────────────────────────────────────────
    if (action === 'disconnect') {
      console.log('[gsc-oauth] disconnect — store:', store.id);
      await supabaseClient
        .from('stores')
        .update({
          gsc_access_token: null,
          gsc_refresh_token: null,
          gsc_token_expiry: null,
          gsc_verification_token: null,
        })
        .eq('id', store.id);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    console.log('[gsc-oauth] unknown action:', action);
    return new Response(
      JSON.stringify({ error: 'Unknown action: ' + action }),
      { headers: corsHeaders, status: 400 }
    );

  } catch (error) {
    console.error('[gsc-oauth] uncaught error:', error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: corsHeaders, status: 500 }
    );
  }
});

// ── Shared helper: get a valid (auto-refreshed) access token ─────────────
async function getValidToken(store: any, supabaseClient: any): Promise<string | null> {
  let accessToken: string | null = store.gsc_access_token;
  if (!accessToken) return null;

  const tokenExpiry = store.gsc_token_expiry ? new Date(store.gsc_token_expiry) : null;
  const now = new Date();

  if (tokenExpiry && now >= tokenExpiry) {
    if (!store.gsc_refresh_token) return null;

    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: store.gsc_refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshRes.ok) return null;

    const refreshData = await refreshRes.json();
    accessToken = refreshData.access_token;
    const newExpiry = new Date(now.getTime() + refreshData.expires_in * 1000);

    await supabaseClient
      .from('stores')
      .update({ gsc_access_token: accessToken, gsc_token_expiry: newExpiry.toISOString() })
      .eq('id', store.id);
  }

  return accessToken;
}
