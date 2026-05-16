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

    // ── Public: get_client_id (no auth required) ────────────────────────
    if (action === 'get_client_id') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — missing authorization header' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid token' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    // Derive store from JWT identity — never from request body
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('id, subdomain, slug, custom_domain, gsc_access_token, gsc_refresh_token, gsc_token_expiry')
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { headers: corsHeaders, status: 404 }
      );
    }

    // ── exchange_code ────────────────────────────────────────────────────
    if (action === 'exchange_code') {
      const { code } = body;
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

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error('[gsc-oauth exchange_code] Google token error:', err);
        throw new Error('Failed to exchange OAuth code with Google');
      }

      const tokens = await tokenRes.json();
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

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, has_refresh_token: !!tokens.refresh_token }),
        { headers: corsHeaders }
      );
    }

    // ── verify ───────────────────────────────────────────────────────────
    if (action === 'verify') {
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

        if (!refreshRes.ok) {
          console.error('[gsc-oauth verify] Token refresh failed:', await refreshRes.text());
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
          .update({
            gsc_access_token: accessToken,
            gsc_token_expiry: newExpiry.toISOString(),
          })
          .eq('id', store.id);
      }

      // Verify via GSC API
      const gscRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });

      if (!gscRes.ok) {
        console.error('[gsc-oauth verify] GSC API error:', gscRes.status);
        return new Response(
          JSON.stringify({ connected: false, reason: 'GSC API call failed. Please reconnect.' }),
          { headers: corsHeaders }
        );
      }

      const gscData = await gscRes.json();
      const sites: string[] = (gscData.siteEntry ?? []).map((s: any) => s.siteUrl);

      // Get connected Google account email
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      const profile = profileRes.ok ? await profileRes.json() : {};

      return new Response(
        JSON.stringify({ connected: true, email: profile.email ?? '', sites }),
        { headers: corsHeaders }
      );
    }

    // ── setup_verification ───────────────────────────────────────────────
    // Called after exchange_code. Uses Google Site Verification API to:
    // 1. Get a FILE token for this store's URL
    // 2. Save token to DB (Nginx serves it at /google*.html)
    // 3. Tell Google to verify — Google crawls the file, confirms ownership
    // 4. Add the property to Google Search Console
    if (action === 'setup_verification') {
      if (!store.gsc_access_token) {
        return new Response(
          JSON.stringify({ error: 'Not connected — run exchange_code first' }),
          { headers: corsHeaders, status: 400 }
        );
      }

      // Determine store URL
      const storeHost = store.custom_domain
        ? store.custom_domain
        : (store.subdomain || store.slug) + '.digitaldukandar.in';
      const storeUrl = 'https://' + storeHost + '/';

      let accessToken = store.gsc_access_token;

      // ── Step 1: Get verification token from Google ────────────────────
      const tokenRes = await fetch('https://www.googleapis.com/siteVerification/v1/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verificationMethod: 'FILE',
          site: { identifier: storeUrl, type: 'SITE' },
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        console.error('[gsc-oauth setup_verification] getToken failed:', err);
        throw new Error('Failed to get verification token from Google');
      }

      const tokenData = await tokenRes.json();
      const verificationToken: string = tokenData.token; // e.g. "google12abc.html"

      // ── Step 2: Save token to DB so Nginx can serve it ────────────────
      await supabaseClient
        .from('stores')
        .update({ gsc_verification_token: verificationToken })
        .eq('id', store.id);

      // ── Step 3: Tell Google to verify (crawls /google*.html via Nginx) ─
      const verifyRes = await fetch(
        'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            site: { identifier: storeUrl, type: 'SITE' },
          }),
        }
      );

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        console.error('[gsc-oauth setup_verification] verify failed:', err);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Verification failed — Google could not reach the verification file. Ensure the store is live.',
            detail: err?.error?.message ?? '',
          }),
          { headers: corsHeaders }
        );
      }

      // ── Step 4: Add property to Google Search Console ─────────────────
      const addSiteRes = await fetch(
        'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(storeUrl),
        {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + accessToken },
        }
      );

      if (!addSiteRes.ok && addSiteRes.status !== 204) {
        console.error('[gsc-oauth setup_verification] addSite failed:', addSiteRes.status);
        // Non-fatal — site may already exist in GSC
      }

      return new Response(
        JSON.stringify({ success: true, siteUrl, verificationToken }),
        { headers: corsHeaders }
      );
    }

    // ── disconnect ───────────────────────────────────────────────────────
    if (action === 'disconnect') {
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

    return new Response(
      JSON.stringify({ error: 'Unknown action: ' + action }),
      { headers: corsHeaders, status: 400 }
    );

  } catch (error) {
    console.error('[gsc-oauth] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
