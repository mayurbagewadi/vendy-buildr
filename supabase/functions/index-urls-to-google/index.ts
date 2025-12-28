/**
 * Google Web Search Indexing API - Immediate URL Indexing
 *
 * Submits URLs for immediate indexing in Google Search
 * Faster than sitemap submission (hours vs days/weeks)
 */

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
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
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

    // Get Google Indexing API credentials
    const googleClientEmail = Deno.env.get('INDEXING_SERVICE_ACCOUNT_EMAIL')!
    const googlePrivateKey = Deno.env.get('INDEXING_SERVICE_ACCOUNT_PRIVATE_KEY')!

    if (!googleClientEmail || !googlePrivateKey) {
      throw new Error('Indexing API credentials not configured')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get request parameters
    const { storeId, urls } = await req.json()

    let urlsToIndex: string[] = []

    if (urls && Array.isArray(urls)) {
      // Specific URLs provided
      urlsToIndex = urls
    } else if (storeId) {
      // Generate URLs for a specific store
      urlsToIndex = await generateStoreUrls(supabase, storeId)
    } else {
      // Generate URLs for ALL stores
      urlsToIndex = await generateAllStoresUrls(supabase)
    }

    console.log('[INDEXING] Processing', urlsToIndex.length, 'URLs')

    // Get Google OAuth token
    const accessToken = await getGoogleAccessToken(googleClientEmail, googlePrivateKey)

    // Index URLs
    const results = []
    for (const url of urlsToIndex) {
      try {
        const result = await indexUrl(url, accessToken)
        results.push({
          url,
          success: result.success,
          message: result.message
        })

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`[INDEXING] Error indexing ${url}:`, error)
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        success: true,
        processed: urlsToIndex.length,
        successful,
        failed,
        results
      }),
      { headers: corsHeaders }
    )

  } catch (error) {
    console.error('[INDEXING] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: corsHeaders, status: 500 }
    )
  }
})

/**
 * Generate URLs for a specific store
 * (Superadmin: Only index store homepages, not product pages)
 */
async function generateStoreUrls(supabase: any, storeId: string): Promise<string[]> {
  const urls: string[] = []

  // Get store info
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, slug, subdomain, custom_domain')
    .eq('id', storeId)
    .single()

  if (error || !store) {
    throw new Error('Store not found')
  }

  // Determine store base URL
  let baseUrl = ''
  if (store.custom_domain) {
    baseUrl = `https://${store.custom_domain}`
  } else if (store.subdomain) {
    baseUrl = `https://${store.subdomain}.digitaldukandar.in`
  } else {
    baseUrl = `https://digitaldukandar.in/${store.slug}`
  }

  // Add only the main store homepage URL
  urls.push(baseUrl)

  return urls
}

/**
 * Generate URLs for all stores
 */
async function generateAllStoresUrls(supabase: any): Promise<string[]> {
  let allUrls: string[] = []

  // Get all active stores with subdomains or custom domains
  const { data: stores } = await supabase
    .from('stores')
    .select('id, slug, subdomain, custom_domain')
    .eq('is_active', true)
    .or('subdomain.neq.null,custom_domain.neq.null')
    .limit(20) // Limit to 20 stores to avoid rate limits

  if (stores && stores.length > 0) {
    for (const store of stores) {
      const storeUrls = await generateStoreUrls(supabase, store.id)
      allUrls = allUrls.concat(storeUrls)
    }
  }

  return allUrls
}

/**
 * Get Google OAuth2 access token for Indexing API
 */
async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 3600

  // Create JWT
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }

  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
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

  const data = await response.json()
  return data.access_token
}

/**
 * Index a single URL using Google Indexing API
 */
async function indexUrl(url: string, accessToken: string) {
  const response = await fetch(
    'https://indexing.googleapis.com/v3/urlNotifications:publish',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        type: 'URL_UPDATED'
      })
    }
  )

  if (response.ok) {
    return { success: true, message: 'URL indexed successfully' }
  } else {
    const errorData = await response.json().catch(() => ({}))
    return {
      success: false,
      message: errorData.error?.message || `HTTP ${response.status}: Failed to index URL`
    }
  }
}

// Helper functions
function base64UrlEncode(str: string): string {
  const base64 = btoa(str)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signJWT(data: string, privateKey: string): Promise<string> {
  // Handle escaped newlines
  const normalizedKey = privateKey.replace(/\\n/g, '\n')

  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = normalizedKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

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
