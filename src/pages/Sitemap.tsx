import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { detectDomain, getStoreIdentifier } from '@/lib/domainUtils';

export default function Sitemap() {
  const [xml, setXml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateStoreSitemap = async (storeIdentifier: string, currentDate: string) => {
      console.log('[SITEMAP] Generating store-specific sitemap for:', storeIdentifier);

      // Fetch the store
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, slug, subdomain, custom_domain, updated_at')
        .or(`slug.eq.${storeIdentifier},subdomain.eq.${storeIdentifier},custom_domain.eq.${storeIdentifier}`)
        .single();

      if (storeError || !store) {
        console.error('[SITEMAP] Store not found:', storeError);
        setXml('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>');
        return;
      }

      // Determine store base URL
      let storeBaseUrl = '';
      if (store.custom_domain) {
        storeBaseUrl = `https://${store.custom_domain}`;
      } else if (store.subdomain) {
        storeBaseUrl = `https://${store.subdomain}.digitaldukandar.in`;
      } else {
        storeBaseUrl = `https://digitaldukandar.in/${store.slug}`;
      }

      // Fetch store products (public RLS policy allows reading published products)
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, updated_at')
        .eq('store_id', store.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('[SITEMAP] Error fetching products:', productsError);
      }
      console.log('[SITEMAP] Store products found:', products?.length || 0);

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

  <!-- Individual Products (${products?.length || 0} products) -->`;

      // Add each product
      if (products && products.length > 0) {
        for (const product of products) {
          // Use slug for SEO-friendly URLs, fallback to ID if slug doesn't exist yet
          const productIdentifier = product.slug || product.id;
          const productUrl = `${storeBaseUrl}/products/${productIdentifier}`;
          const lastmod = product.updated_at
            ? new Date(product.updated_at).toISOString().split('T')[0]
            : currentDate;

          sitemapXml += `
  <url>
    <loc>${productUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
        }
      }

      sitemapXml += `
</urlset>`;

      setXml(sitemapXml);
    };

    const generatePlatformSitemap = async (currentDate: string) => {
      console.log('[SITEMAP] Generating platform-wide sitemap');

      // Fetch all stores
      const { data: stores, error } = await supabase
        .from('stores')
        .select('slug, subdomain, custom_domain, updated_at')
        .order('created_at', { ascending: false });

      console.log('[SITEMAP] Stores query result:', { stores, error });
      console.log('[SITEMAP] Number of stores:', stores?.length || 0);

      // Build XML
      let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Platform Pages -->
  <url>
    <loc>https://digitaldukandar.in/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
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

  <!-- Store Pages (${stores?.length || 0} stores found) -->`;

      // Add each store
      if (stores && stores.length > 0) {
        console.log('[SITEMAP] Adding', stores.length, 'stores to sitemap');
        for (const store of stores) {
          let storeUrl = '';
          // Priority: custom_domain > subdomain > slug
          if (store.custom_domain) {
            storeUrl = `https://${store.custom_domain}`;
            console.log(`[SITEMAP] Store ${store.slug}: using custom_domain -> ${storeUrl}`);
          } else if (store.subdomain) {
            storeUrl = `https://${store.subdomain}.digitaldukandar.in`;
            console.log(`[SITEMAP] Store ${store.slug}: using subdomain -> ${storeUrl}`);
          } else {
            storeUrl = `https://digitaldukandar.in/${store.slug}`;
            console.log(`[SITEMAP] Store ${store.slug}: using slug fallback -> ${storeUrl}`);
          }

          const lastmod = store.updated_at
            ? new Date(store.updated_at).toISOString().split('T')[0]
            : currentDate;

          sitemapXml += `
  <url>
    <loc>${storeUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
        }
      }

      sitemapXml += `
</urlset>`;

      setXml(sitemapXml);
    };

    const generateSitemap = async () => {
      try {
        setLoading(true);

        const domainInfo = detectDomain();
        const storeIdentifier = getStoreIdentifier();
        const currentDate = new Date().toISOString().split('T')[0];

        console.log('[SITEMAP] Domain Info:', domainInfo);
        console.log('[SITEMAP] Store Identifier:', storeIdentifier);

        // Check if this is a store-specific domain
        if (domainInfo.isStoreSpecific && storeIdentifier) {
          // STORE-SPECIFIC SITEMAP
          await generateStoreSitemap(storeIdentifier, currentDate);
        } else {
          // PLATFORM-WIDE SITEMAP
          await generatePlatformSitemap(currentDate);
        }
      } catch (error) {
        console.error('[SITEMAP] Error generating sitemap:', error);
      } finally {
        setLoading(false);
      }
    };

    generateSitemap();
  }, []);

  // Set content type to XML
  useEffect(() => {
    if (xml) {
      document.querySelector('meta[http-equiv="Content-Type"]')?.setAttribute('content', 'application/xml');
    }
  }, [xml]);

  if (loading) {
    return <div style={{ padding: '20px' }}>Generating sitemap...</div>;
  }

  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
      {xml}
    </pre>
  );
}
