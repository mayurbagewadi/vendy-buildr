import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user authentication (if JWT verification is enabled)
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      // Validate token with Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const authClient = createClient(supabaseUrl, supabaseAnonKey)

      const { data: { user }, error: authError } = await authClient.auth.getUser(token)

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { headers: corsHeaders, status: 401 }
        )
      }

      console.log('[AUTH] Authenticated user:', user.email)
    }

    // Get Google API credentials from environment
    const googleClientEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!
    const googlePrivateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')!

    console.log('[DEBUG] Email exists:', !!googleClientEmail)
    console.log('[DEBUG] Private key exists:', !!googlePrivateKey)
    console.log('[DEBUG] Private key length:', googlePrivateKey?.length || 0)
    console.log('[DEBUG] Private key starts with:', googlePrivateKey?.substring(0, 50))

    if (!googleClientEmail || !googlePrivateKey) {
      throw new Error('Google service account credentials not configured')
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get request parameters
    const { storeId, domain } = await req.json()

    let storesToProcess = []

    if (storeId) {
      // Single store
      const { data: store, error } = await supabase
        .from('stores')
        .select('id, slug, subdomain, custom_domain')
        .eq('id', storeId)
        .single()

      if (error || !store) {
        throw new Error('Store not found')
      }
      storesToProcess = [store]
    } else if (domain) {
      // Specific domain
      const { data: store, error } = await supabase
        .from('stores')
        .select('id, slug, subdomain, custom_domain')
        .or(`subdomain.eq.${domain.split('.')[0]},custom_domain.eq.${domain}`)
        .single()

      if (error || !store) {
        throw new Error('Store not found for domain')
      }
      storesToProcess = [store]
    } else {
      // All stores
      const { data: stores, error } = await supabase
        .from('stores')
        .select('id, slug, subdomain, custom_domain')

      if (error) {
        throw new Error('Failed to fetch stores')
      }
      storesToProcess = stores || []
    }

    console.log('[GOOGLE SEARCH CONSOLE] Processing', storesToProcess.length, 'stores')

    const results = []

    for (const store of storesToProcess) {
      try {
        // Determine store domain
        let storeDomain = ''
        if (store.custom_domain) {
          storeDomain = store.custom_domain
        } else if (store.subdomain) {
          storeDomain = `${store.subdomain}.digitaldukandar.in`
        } else {
          console.log(`[GOOGLE SEARCH CONSOLE] Skipping store ${store.id} - no subdomain or custom domain`)
          continue
        }

        // Generate sitemap URL
        const sitemapUrl = `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/generate-sitemap?domain=${storeDomain}`

        console.log(`[GOOGLE SEARCH CONSOLE] Submitting sitemap for ${storeDomain}:`, sitemapUrl)

        // Get Google OAuth token
        const tokenResponse = await getGoogleAccessToken(googleClientEmail, googlePrivateKey)
        const accessToken = tokenResponse.access_token

        // Submit sitemap to Google Search Console
        const submitResponse = await submitSitemap(storeDomain, sitemapUrl, accessToken)

        results.push({
          storeId: store.id,
          domain: storeDomain,
          sitemapUrl,
          success: submitResponse.success,
          message: submitResponse.message
        })
      } catch (error) {
        console.error(`[GOOGLE SEARCH CONSOLE] Error processing store ${store.id}:`, error)
        results.push({
          storeId: store.id,
          success: false,
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: storesToProcess.length,
        results
      }),
      { headers: corsHeaders }
    )

  } catch (error) {
    console.error('[GOOGLE SEARCH CONSOLE] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: corsHeaders, status: 500 }
    )
  }
})

// Get Google OAuth2 access token using service account
async function getGoogleAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 3600

  // Create JWT
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }

  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now
  }

  // Base64url encode
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet))
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`

  // Sign with private key
  const signature = await signJWT(signatureInput, privateKey)
  const jwt = `${signatureInput}.${signature}`

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  return await response.json()
}

// Submit sitemap to Google Search Console
async function submitSitemap(domain: string, sitemapUrl: string, accessToken: string) {
  const siteUrl = `sc-domain:${domain}`
  const encodedSitemapUrl = encodeURIComponent(sitemapUrl)

  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodedSitemapUrl}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (response.ok || response.status === 204) {
    return { success: true, message: 'Sitemap submitted successfully' }
  } else {
    const errorData = await response.json().catch(() => ({}))
    return { success: false, message: errorData.error?.message || 'Failed to submit sitemap' }
  }
}

// Helper functions
function base64UrlEncode(str: string): string {
  const base64 = btoa(str)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signJWT(data: string, privateKey: string): Promise<string> {
  // Import the private key
  // Handle escaped newlines (\n as literal string vs actual newline)
  const normalizedKey = privateKey.replace(/\\n/g, '\n')

  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = normalizedKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')

  let binaryDer
  try {
    binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  } catch (error) {
    console.error('[JWT SIGN] Failed to decode base64:', error)
    console.error('[JWT SIGN] Private key format issue - check GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY environment variable')
    throw new Error('Failed to decode base64: Invalid private key format')
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  )

  // Sign the data
  const encoder = new TextEncoder()
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(data)
  )

  // Convert to base64url
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))
}
