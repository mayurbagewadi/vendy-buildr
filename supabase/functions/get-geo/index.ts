import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeoData {
  country: string      // ISO 3166-1 alpha-2 e.g. "IN"
  city: string         // e.g. "Mumbai"
  region: string       // e.g. "Maharashtra"
  region_code: string  // e.g. "MH"
  continent: string    // e.g. "AS"
  latitude: string     // e.g. "19.0760"
  longitude: string    // e.g. "72.8777"
  postal_code: string  // e.g. "400001" (reliable US/UK, best-effort elsewhere)
  timezone: string     // IANA e.g. "Asia/Kolkata"
  is_detected: boolean // false when CF headers absent (local dev / unknown IP)
}

// Cloudflare uses these codes when geolocation is unavailable
const UNDETECTABLE = new Set(['XX', 'T1', ''])

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawCountry = req.headers.get('cf-ipcountry') ?? ''
    const isDetected = !UNDETECTABLE.has(rawCountry.toUpperCase())

    const geo: GeoData = {
      country:     isDetected ? rawCountry.toUpperCase() : '',
      city:        req.headers.get('cf-ipcity')       ?? '',
      region:      req.headers.get('cf-region')       ?? '',
      region_code: req.headers.get('cf-region-code')  ?? '',
      continent:   req.headers.get('cf-ipcontinent')  ?? '',
      latitude:    req.headers.get('cf-iplatitude')   ?? '',
      longitude:   req.headers.get('cf-iplongitude')  ?? '',
      postal_code: req.headers.get('cf-postal-code')  ?? '',
      timezone:    req.headers.get('cf-timezone')     ?? '',
      is_detected: isDetected,
    }

    return new Response(
      JSON.stringify({ success: true, data: geo }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[get-geo] Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to read geo data' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
