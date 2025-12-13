import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get domain from query parameter or header
    const url = new URL(req.url)
    const domain = url.searchParams.get('domain') || req.headers.get('host') || ''

    console.log('[SITEMAP] Generating for domain:', domain)

    // Initialize Supabase client with service role for public read access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const currentDate = new Date().toISOString().split('T')[0]

    // Check if this is a store-specific domain
    const isStoreDomain = domain.includes('.digitaldukandar.in') && domain !== 'digitaldukandar.in'

    if (isStoreDomain) {
      // Extract store identifier from subdomain
      const storeIdentifier = domain.split('.')[0]
      console.log('[SITEMAP] Store identifier:', storeIdentifier)

      // Fetch the store
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, slug, subdomain, custom_domain, updated_at')
        .or(`slug.eq.${storeIdentifier},subdomain.eq.${storeIdentifier},custom_domain.eq.${domain}`)
        .single()

      if (storeError || !store) {
        console.error('[SITEMAP] Store not found:', storeError)
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`,
          { headers: corsHeaders }
        )
      }

      // Determine store base URL
      let storeBaseUrl = ''
      if (store.custom_domain) {
        storeBaseUrl = `https://${store.custom_domain}`
      } else if (store.subdomain) {
        storeBaseUrl = `https://${store.subdomain}.digitaldukandar.in`
      } else {
        storeBaseUrl = `https://digitaldukandar.in/${store.slug}`
      }

      // Fetch store products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, updated_at')
        .eq('store_id', store.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })

      if (productsError) {
        console.error('[SITEMAP] Error fetching products:', productsError)
      }

      console.log('[SITEMAP] Store products found:', products?.length || 0)

      // Build store sitemap XML
      let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Store Home -->
  <url>
    <loc>${storeBaseUrl}</loc>
    <lastmod>${store.updated_at ? new Date(store.updated_at).toISOString().split('T')[0] : currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Store Pages -->
  <url>
    <loc>${storeBaseUrl}/products</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${storeBaseUrl}/categories</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${storeBaseUrl}/policies</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <!-- Individual Products (${products?.length || 0} products) -->`

      // Add each product
      if (products && products.length > 0) {
        for (const product of products) {
          const productIdentifier = product.slug || product.id
          const productUrl = `${storeBaseUrl}/products/${productIdentifier}`
          const lastmod = product.updated_at
            ? new Date(product.updated_at).toISOString().split('T')[0]
            : currentDate

          sitemapXml += `
  <url>
    <loc>${productUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
        }
      }

      sitemapXml += `
</urlset>`

      return new Response(sitemapXml, { headers: corsHeaders })

    } else {
      // PLATFORM-WIDE SITEMAP
      console.log('[SITEMAP] Generating platform-wide sitemap')

      // Fetch all active stores for SEO
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('slug, subdomain, custom_domain, updated_at')
        .order('created_at', { ascending: false })

      if (storesError) {
        console.error('[SITEMAP] Error fetching stores:', storesError)
      }

      console.log('[SITEMAP] Platform stores found:', stores?.length || 0)

      let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Platform Pages -->
  <url>
    <loc>https://digitaldukandar.in/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://digitaldukandar.in/pricing</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://digitaldukandar.in/auth</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://digitaldukandar.in/become-helper</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://digitaldukandar.in/privacy-policy</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://digitaldukandar.in/terms-of-service</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

  <!-- Stores (${stores?.length || 0} active stores) -->`

      // Add each store to platform sitemap for SEO discovery
      if (stores && stores.length > 0) {
        for (const store of stores) {
          // Determine store URL (prefer custom domain > subdomain > slug)
          let storeUrl = ''
          if (store.custom_domain) {
            storeUrl = `https://${store.custom_domain}`
          } else if (store.subdomain) {
            storeUrl = `https://${store.subdomain}.digitaldukandar.in`
          } else if (store.slug) {
            storeUrl = `https://digitaldukandar.in/${store.slug}`
          }

          if (storeUrl) {
            const lastmod = store.updated_at
              ? new Date(store.updated_at).toISOString().split('T')[0]
              : currentDate

            sitemapXml += `
  <url>
    <loc>${storeUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
          }
        }
      }

      sitemapXml += `
</urlset>`

      return new Response(sitemapXml, { headers: corsHeaders })
    }

  } catch (error) {
    console.error('[SITEMAP] Error:', error)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`,
      { headers: { ...corsHeaders }, status: 500 }
    )
  }
})
