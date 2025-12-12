// SEO Hook - Easy integration of structured data, canonical URLs, and meta tags

import { useEffect } from 'react';
import type { Product, Store } from '@/lib/seo/types';
import { generateProductSchema, generateOrganizationSchema, generateBreadcrumbSchema } from '@/lib/seo/schemaGenerators';
import type { BreadcrumbItem } from '@/lib/seo/types';
import { getProductCanonicalUrl, getStoreCanonicalUrl, setCanonicalUrl } from '@/lib/seo/canonicalUrl';

interface UseSEOProductOptions {
  product: Product;
  store: Store;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'LimitedAvailability';
  email?: string;
  breadcrumbs?: BreadcrumbItem[];
  canonicalUrl?: string; // Optional override
}

interface UseSEOStoreOptions {
  store: Store;
  email?: string;
  breadcrumbs?: BreadcrumbItem[];
  canonicalUrl?: string; // Optional override
}

/**
 * Hook to add Product SEO schema to page
 * Usage: useSEOProduct({ product, store, availability: 'InStock' })
 */
export function useSEOProduct(options: UseSEOProductOptions | null) {
  useEffect(() => {
    if (!options) return;

    const { product, store, availability = 'InStock', email, breadcrumbs } = options;
    const currentUrl = window.location.href;

    // Generate schemas
    const productSchema = generateProductSchema({
      product,
      store,
      url: currentUrl,
      availability
    });

    const organizationSchema = generateOrganizationSchema({
      store,
      url: `${window.location.origin}/${store.slug}`,
      email
    });

    // Inject Product Schema
    const productScript = document.createElement('script');
    productScript.id = 'product-schema';
    productScript.type = 'application/ld+json';
    productScript.textContent = JSON.stringify(productSchema);

    // Inject Organization Schema
    const orgScript = document.createElement('script');
    orgScript.id = 'organization-schema';
    orgScript.type = 'application/ld+json';
    orgScript.textContent = JSON.stringify(organizationSchema);

    // Remove existing scripts
    const existingProduct = document.getElementById('product-schema');
    const existingOrg = document.getElementById('organization-schema');
    if (existingProduct) existingProduct.remove();
    if (existingOrg) existingOrg.remove();

    // Append to head
    document.head.appendChild(productScript);
    document.head.appendChild(orgScript);

    // Add breadcrumbs if provided
    if (breadcrumbs && breadcrumbs.length > 0) {
      const breadcrumbSchema = generateBreadcrumbSchema({ items: breadcrumbs });
      const breadcrumbScript = document.createElement('script');
      breadcrumbScript.id = 'breadcrumb-schema';
      breadcrumbScript.type = 'application/ld+json';
      breadcrumbScript.textContent = JSON.stringify(breadcrumbSchema);

      const existingBreadcrumb = document.getElementById('breadcrumb-schema');
      if (existingBreadcrumb) existingBreadcrumb.remove();

      document.head.appendChild(breadcrumbScript);

      // Cleanup breadcrumb on unmount
      return () => {
        const scriptToRemove = document.getElementById('breadcrumb-schema');
        if (scriptToRemove) scriptToRemove.remove();
      };
    }

    // Cleanup on unmount
    return () => {
      const productToRemove = document.getElementById('product-schema');
      const orgToRemove = document.getElementById('organization-schema');
      if (productToRemove) productToRemove.remove();
      if (orgToRemove) orgToRemove.remove();
    };
  }, [options]);
}

/**
 * Hook to add Store/Organization SEO schema to page
 * Usage: useSEOStore({ store, email: 'store@example.com' })
 */
export function useSEOStore(options: UseSEOStoreOptions | null) {
  useEffect(() => {
    if (!options) return;

    const { store, email, breadcrumbs } = options;
    const currentUrl = window.location.href;

    // Generate schema
    const organizationSchema = generateOrganizationSchema({
      store,
      url: currentUrl,
      email
    });

    // Inject Organization Schema
    const orgScript = document.createElement('script');
    orgScript.id = 'organization-schema';
    orgScript.type = 'application/ld+json';
    orgScript.textContent = JSON.stringify(organizationSchema);

    // Remove existing script
    const existingOrg = document.getElementById('organization-schema');
    if (existingOrg) existingOrg.remove();

    // Append to head
    document.head.appendChild(orgScript);

    // Add breadcrumbs if provided
    if (breadcrumbs && breadcrumbs.length > 0) {
      const breadcrumbSchema = generateBreadcrumbSchema({ items: breadcrumbs });
      const breadcrumbScript = document.createElement('script');
      breadcrumbScript.id = 'breadcrumb-schema';
      breadcrumbScript.type = 'application/ld+json';
      breadcrumbScript.textContent = JSON.stringify(breadcrumbSchema);

      const existingBreadcrumb = document.getElementById('breadcrumb-schema');
      if (existingBreadcrumb) existingBreadcrumb.remove();

      document.head.appendChild(breadcrumbScript);

      // Cleanup breadcrumb on unmount
      return () => {
        const scriptToRemove = document.getElementById('breadcrumb-schema');
        if (scriptToRemove) scriptToRemove.remove();
      };
    }

    // Cleanup on unmount
    return () => {
      const orgToRemove = document.getElementById('organization-schema');
      if (orgToRemove) orgToRemove.remove();
    };
  }, [options]);
}
