/**
 * Utility functions for handling subdomains and custom domains
 */

const MAIN_DOMAIN = 'digitaldukandar.in';
const PROTOCOL = window.location.protocol; // 'http:' or 'https:'

export interface DomainInfo {
  type: 'main' | 'subdomain' | 'custom';
  subdomain?: string;
  customDomain?: string;
  isStoreSpecific: boolean;
}

/**
 * Detects current domain type and extracts subdomain/custom domain
 */
export function detectDomain(): DomainInfo {
  const hostname = window.location.hostname;

  // Lovable preview URLs (e.g., id-preview--xxx.lovable.app or xxx.lovableproject.com)
  if (hostname.endsWith('.lovable.app') || hostname.endsWith('.lovableproject.com')) {
    return { type: 'main', isStoreSpecific: false };
  }

  // Local development - Check for subdomain testing (e.g., sasumasale.localhost)
  if (hostname.endsWith('.localhost')) {
    const subdomain = hostname.replace('.localhost', '');

    // Reserved subdomains
    const reserved = ['admin', 'superadmin', 'api', 'app', 'preview', 'dashboard'];
    if (reserved.includes(subdomain)) {
      return { type: 'main', isStoreSpecific: false };
    }

    // Store subdomain on localhost
    return {
      type: 'subdomain',
      subdomain,
      isStoreSpecific: true
    };
  }

  // Plain localhost
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
    return { type: 'main', isStoreSpecific: false };
  }

  // Check if it's a subdomain of yesgive.shop
  if (hostname.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = hostname.replace(`.${MAIN_DOMAIN}`, '');

    // Main domain or www
    if (subdomain === '' || subdomain === 'www') {
      return { type: 'main', isStoreSpecific: false };
    }

    // Reserved subdomains (admin, api, etc.)
    const reserved = ['admin', 'superadmin', 'api', 'app', 'preview', 'dashboard'];
    if (reserved.includes(subdomain)) {
      return { type: 'main', isStoreSpecific: false };
    }

    // Store subdomain
    return {
      type: 'subdomain',
      subdomain,
      isStoreSpecific: true
    };
  }

  // Main domain without subdomain
  if (hostname === MAIN_DOMAIN) {
    return { type: 'main', isStoreSpecific: false };
  }

  // Custom domain
  return {
    type: 'custom',
    customDomain: hostname,
    isStoreSpecific: true
  };
}

/**
 * Get store identifier from current domain
 * Returns subdomain or custom domain that should be used to look up the store
 */
export function getStoreIdentifier(): string | null {
  const domainInfo = detectDomain();

  if (!domainInfo.isStoreSpecific) {
    return null;
  }

  return domainInfo.subdomain || domainInfo.customDomain || null;
}

/**
 * Build URL for a store (subdomain or custom domain)
 */
export function buildStoreUrl(subdomain: string, customDomain?: string | null): string {
  if (customDomain) {
    return `${PROTOCOL}//${customDomain}`;
  }
  return `${PROTOCOL}//${subdomain}.${MAIN_DOMAIN}`;
}

/**
 * Check if current page is on a store-specific domain
 */
export function isStoreSpecificDomain(): boolean {
  return detectDomain().isStoreSpecific;
}

/**
 * Get main platform URL
 */
export function getMainPlatformUrl(): string {
  return `${PROTOCOL}//${MAIN_DOMAIN}`;
}

/**
 * Validate subdomain format
 */
export function isValidSubdomain(subdomain: string): boolean {
  // 3-63 characters, lowercase alphanumeric and hyphens
  // Must start and end with alphanumeric
  const regex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
  return regex.test(subdomain);
}

/**
 * Check if subdomain is reserved
 */
export function isReservedSubdomain(subdomain: string): boolean {
  const reserved = [
    'www', 'api', 'admin', 'superadmin', 'app', 'mail', 'smtp', 'ftp',
    'cdn', 'static', 'assets', 'blog', 'help', 'support', 'docs',
    'dashboard', 'login', 'register', 'signin', 'signup', 'test',
    'dev', 'staging', 'prod', 'production', 'preview'
  ];
  return reserved.includes(subdomain.toLowerCase());
}
