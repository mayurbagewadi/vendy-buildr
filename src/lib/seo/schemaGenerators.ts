// Schema.org JSON-LD Generators for SEO

import type { ProductSchemaProps, OrganizationSchemaProps, BreadcrumbSchemaProps } from './types';

/**
 * Generate Product Schema (Schema.org/Product)
 * Displays: Price, Availability, Images in Google Search
 */
export function generateProductSchema(props: ProductSchemaProps) {
  const { product, store, url, availability = 'InStock' } = props;

  // Determine price - use base_price or extract from price_range
  const price = product.base_price || product.basePrice;
  const priceRange = product.price_range || product.priceRange;
  const sku = product.sku || product.baseSku || product.id;

  // Get primary image with fallback
  const primaryImage = product.images && product.images.length > 0
    ? product.images[0]
    : null;

  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} available at ${store.name}`,
    sku: sku,
    ...(primaryImage && {
      image: product.images.filter(img => img).map(img => {
        // Ensure absolute URLs
        if (img.startsWith('http')) return img;
        return `${window.location.origin}${img}`;
      })
    }),
    ...(product.category && {
      category: product.category
    }),
    offers: {
      '@type': 'Offer',
      url: url,
      priceCurrency: 'USD', // You can make this dynamic based on store settings
      ...(price && { price: price.toFixed(2) }),
      ...(priceRange && !price && { price: priceRange }),
      availability: `https://schema.org/${availability}`,
      seller: {
        '@type': 'Organization',
        name: store.name
      }
    }
  };

  return schema;
}

/**
 * Generate Organization/Store Schema (Schema.org/Store)
 * Displays: Business info, location, contact in Google Search
 */
export function generateOrganizationSchema(props: OrganizationSchemaProps) {
  const { store, url, email } = props;

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store.name,
    url: url,
    ...(store.description && { description: store.description }),
    ...(store.logo_url && {
      image: store.logo_url.startsWith('http')
        ? store.logo_url
        : `${window.location.origin}${store.logo_url}`
    }),
    ...(store.whatsapp_number && {
      telephone: store.whatsapp_number
    }),
    ...(email && { email }),
    ...(store.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: store.address
      }
    })
  };

  // Add social media links if available
  if (store.social_links) {
    const sameAs: string[] = [];
    if (store.social_links.facebook) sameAs.push(store.social_links.facebook);
    if (store.social_links.instagram) sameAs.push(store.social_links.instagram);
    if (store.social_links.twitter) sameAs.push(store.social_links.twitter);

    if (sameAs.length > 0) {
      schema.sameAs = sameAs;
    }
  }

  return schema;
}

/**
 * Generate Breadcrumb Schema (Schema.org/BreadcrumbList)
 * Displays: Clickable navigation path in Google Search
 */
export function generateBreadcrumbSchema(props: BreadcrumbSchemaProps) {
  const { items } = props;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url && { item: item.url })
    }))
  };

  return schema;
}
