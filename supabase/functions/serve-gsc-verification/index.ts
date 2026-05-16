import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Google's crawler hits this URL — no auth, plain text response
    const host = req.headers.get('x-original-host') ?? req.headers.get('host') ?? '';

    // Extract subdomain: "mystore.digitaldukandar.in" → "mystore"
    // Also handles custom domains: "mycustomdomain.com" → full host
    const parts = host.split('.');
    const isSubdomain = host.endsWith('.digitaldukandar.in') && parts.length >= 3;
    const identifier = isSubdomain ? parts[0] : host;

    if (!identifier) {
      return new Response('Not found', { status: 404 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up store by subdomain or slug
    let query = supabaseAdmin
      .from('stores')
      .select('gsc_verification_token')
      .eq('is_active', true);

    query = isSubdomain
      ? query.or(`subdomain.eq.${identifier},slug.eq.${identifier}`)
      : query.eq('custom_domain', identifier);

    const { data: store } = await query.maybeSingle();

    if (!store?.gsc_verification_token) {
      return new Response('Not found', { status: 404 });
    }

    // Google expects: "google-site-verification: google[token].html"
    const token = store.gsc_verification_token;
    const content = 'google-site-verification: ' + token;

    return new Response(content, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  } catch (error) {
    console.error('[serve-gsc-verification] Error:', error);
    return new Response('Not found', { status: 404 });
  }
});
