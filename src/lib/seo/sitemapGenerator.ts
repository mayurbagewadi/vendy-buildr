// XML Sitemap Generator for SEO
// Generates sitemap.xml with all platform, store, and product pages

import type { SitemapUrl } from './types';

/**
 * Generate XML Sitemap
 * @param urls Array of URL objects with loc, lastmod, changefreq, priority
 * @returns XML string for sitemap.xml
 */
export function generateSitemapXML(urls: SitemapUrl[]): string {
  const urlEntries = urls
    .map((url) => {
      return `  <url>
    <loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `
    <lastmod>${url.lastmod}</lastmod>` : ''}${url.changefreq ? `
    <changefreq>${url.changefreq}</changefreq>` : ''}${url.priority !== undefined ? `
    <priority>${url.priority.toFixed(1)}</priority>` : ''}
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Format date for sitemap (ISO 8601 / W3C format)
 */
export function formatSitemapDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Generate platform static pages URLs
 */
export function getPlatformUrls(baseUrl: string): SitemapUrl[] {
  const today = formatSitemapDate(new Date());

  return [
    {
      loc: `${baseUrl}/`,
      lastmod: today,
      changefreq: 'daily',
      priority: 1.0
    },
    {
      loc: `${baseUrl}/pricing`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8
    },
    {
      loc: `${baseUrl}/auth`,
      lastmod: today,
      changefreq: 'monthly',
      priority: 0.6
    },
    {
      loc: `${baseUrl}/privacy-policy`,
      lastmod: today,
      changefreq: 'yearly',
      priority: 0.3
    },
    {
      loc: `${baseUrl}/terms-of-service`,
      lastmod: today,
      changefreq: 'yearly',
      priority: 0.3
    }
  ];
}

/**
 * Generate store URLs from database data
 */
export function getStoreUrls(
  baseUrl: string,
  stores: Array<{
    slug: string;
    updated_at?: string;
    subdomain?: string;
    custom_domain?: string;
  }>
): SitemapUrl[] {
  return stores.map((store) => {
    // Determine the URL based on subdomain/custom domain
    let storeUrl = `${baseUrl}/${store.slug}`;

    if (store.custom_domain) {
      storeUrl = `https://${store.custom_domain}`;
    } else if (store.subdomain) {
      storeUrl = `https://${store.subdomain}.digitaldukandar.in`;
    }

    return {
      loc: storeUrl,
      lastmod: store.updated_at ? formatSitemapDate(store.updated_at) : undefined,
      changefreq: 'weekly',
      priority: 0.9
    };
  });
}

/**
 * Generate product URLs from database data
 */
export function getProductUrls(
  baseUrl: string,
  products: Array<{
    id: string;
    store_slug: string;
    updated_at?: string;
    created_at?: string;
    store_subdomain?: string;
    store_custom_domain?: string;
  }>
): SitemapUrl[] {
  return products.map((product) => {
    // Determine the URL based on store's domain setup
    let productUrl = `${baseUrl}/${product.store_slug}/products/${product.id}`;

    if (product.store_custom_domain) {
      productUrl = `https://${product.store_custom_domain}/products/${product.id}`;
    } else if (product.store_subdomain) {
      productUrl = `https://${product.store_subdomain}.digitaldukandar.in/products/${product.id}`;
    }

    return {
      loc: productUrl,
      lastmod: product.updated_at
        ? formatSitemapDate(product.updated_at)
        : product.created_at
        ? formatSitemapDate(product.created_at)
        : undefined,
      changefreq: 'weekly',
      priority: 0.7
    };
  });
}

/**
 * Generate complete sitemap with all URLs
 */
export async function generateCompleteSitemap(
  baseUrl: string,
  stores: any[],
  products: any[]
): Promise<string> {
  const allUrls: SitemapUrl[] = [
    ...getPlatformUrls(baseUrl),
    ...getStoreUrls(baseUrl, stores),
    ...getProductUrls(baseUrl, products)
  ];

  return generateSitemapXML(allUrls);
}
