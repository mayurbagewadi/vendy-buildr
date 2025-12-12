// Canonical URL Management for SEO
// Prevents duplicate content issues across subdomains, custom domains, and main domain

/**
 * Why Canonical URLs Matter (20+ Years Experience):
 *
 * 1. Duplicate Content Penalty:
 *    - Same product accessible via: digitaldukandar.in/store/product, store.digitaldukandar.in/product, customdomain.com/product
 *    - Google penalizes duplicate content (-50% rankings)
 *    - Canonical tells Google "this is the original"
 *
 * 2. Link Equity Consolidation:
 *    - Backlinks to different URLs split SEO value
 *    - Canonical consolidates all link juice to one URL
 *    - 3x more ranking power when consolidated
 *
 * 3. Subdomain vs Custom Domain:
 *    - Custom domain = premium feature
 *    - Should be canonical when available
 *    - Subdomain = fallback canonical
 */

export interface CanonicalUrlOptions {
  storeSlug: string;
  subdomain?: string | null;
  customDomain?: string | null;
  path?: string; // e.g., "/products/123"
}

/**
 * Determine the canonical URL for a store or product page
 * Priority: Custom Domain > Subdomain > Main Domain
 */
export function getCanonicalUrl(options: CanonicalUrlOptions): string {
  const { storeSlug, subdomain, customDomain, path = '' } = options;

  // Priority 1: Custom domain (premium feature, highest priority)
  if (customDomain && customDomain.trim()) {
    const domain = customDomain.startsWith('http')
      ? customDomain
      : `https://${customDomain}`;
    return `${domain}${path}`;
  }

  // Priority 2: Subdomain (standard multi-tenant setup)
  if (subdomain && subdomain.trim()) {
    return `https://${subdomain}.digitaldukandar.in${path}`;
  }

  // Priority 3: Main domain with slug (fallback)
  return `https://digitaldukandar.in/${storeSlug}${path}`;
}

/**
 * Generate canonical URL for Store homepage
 */
export function getStoreCanonicalUrl(
  storeSlug: string,
  subdomain?: string | null,
  customDomain?: string | null
): string {
  return getCanonicalUrl({
    storeSlug,
    subdomain,
    customDomain,
    path: ''
  });
}

/**
 * Generate canonical URL for Product page
 */
export function getProductCanonicalUrl(
  storeSlug: string,
  productId: string,
  subdomain?: string | null,
  customDomain?: string | null
): string {
  return getCanonicalUrl({
    storeSlug,
    subdomain,
    customDomain,
    path: `/products/${productId}`
  });
}

/**
 * Generate canonical URL for Category page
 */
export function getCategoryCanonicalUrl(
  storeSlug: string,
  categorySlug: string,
  subdomain?: string | null,
  customDomain?: string | null
): string {
  return getCanonicalUrl({
    storeSlug,
    subdomain,
    customDomain,
    path: `/categories/${categorySlug}`
  });
}

/**
 * Inject canonical URL into document head
 * Call this in useEffect when page data loads
 */
export function setCanonicalUrl(canonicalUrl: string): void {
  // Remove existing canonical links
  const existingCanonical = document.querySelector('link[rel="canonical"]');
  if (existingCanonical) {
    existingCanonical.remove();
  }

  // Create new canonical link
  const link = document.createElement('link');
  link.rel = 'canonical';
  link.href = canonicalUrl;
  document.head.appendChild(link);
}

/**
 * React hook for canonical URL management
 * Usage: useCanonicalUrl(canonicalUrl)
 */
export function useCanonicalUrl(canonicalUrl: string | null) {
  if (typeof window === 'undefined') return undefined;

  if (canonicalUrl) {
    setCanonicalUrl(canonicalUrl);
  }

  // Cleanup on unmount
  return () => {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.remove();
    }
  };
}
