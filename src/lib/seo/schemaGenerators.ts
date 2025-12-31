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

  // Use SEO description if available, otherwise fall back to regular description
  const description = store.seo_description || store.description;

  // Use business phone if available, otherwise fall back to WhatsApp
  const telephone = store.business_phone || store.whatsapp_number;

  // Use business email if available, otherwise fall back to provided email
  const contactEmail = store.business_email || email;

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store.name,
    url: url,
    ...(description && { description }),
    ...(store.logo_url && {
      image: store.logo_url.startsWith('http')
        ? store.logo_url
        : `${window.location.origin}${store.logo_url}`
    }),
    ...(telephone && { telephone }),
    ...(contactEmail && { email: contactEmail })
  };

  // Add alternate names if available (for SEO keyword variations)
  if (store.alternate_names) {
    const alternateNames = store.alternate_names
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (alternateNames.length > 0) {
      schema.alternateName = alternateNames;
    }
  }

  // Add full address if available
  if (store.street_address || store.city || store.state) {
    schema.address = {
      '@type': 'PostalAddress',
      ...(store.street_address && { streetAddress: store.street_address }),
      ...(store.city && { addressLocality: store.city }),
      ...(store.state && { addressRegion: store.state }),
      ...(store.postal_code && { postalCode: store.postal_code }),
      ...(store.country && { addressCountry: store.country })
    };
  } else if (store.address) {
    // Fall back to simple address if no detailed address
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: store.address
    };
  }

  // Add opening hours if available
  if (store.opening_hours) {
    schema.openingHours = store.opening_hours;
  }

  // Add price range if available
  if (store.price_range) {
    schema.priceRange = store.price_range;
  }

  // Add social media links - combine from both sources
  const sameAs: string[] = [];

  // From SEO settings
  if (store.facebook_url) sameAs.push(store.facebook_url);
  if (store.instagram_url) sameAs.push(store.instagram_url);
  if (store.twitter_url) sameAs.push(store.twitter_url);

  // From legacy social_links (if SEO fields not set)
  if (store.social_links && sameAs.length === 0) {
    if (store.social_links.facebook) sameAs.push(store.social_links.facebook);
    if (store.social_links.instagram) sameAs.push(store.social_links.instagram);
    if (store.social_links.twitter) sameAs.push(store.social_links.twitter);
  }

  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
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
