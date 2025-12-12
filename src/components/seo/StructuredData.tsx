// Structured Data (JSON-LD) Components for SEO
// These components inject Schema.org markup into page <head>

import { useEffect } from 'react';

interface StructuredDataProps {
  data: object;
  id?: string;
}

/**
 * Generic Structured Data Component
 * Injects JSON-LD script into document head
 */
export function StructuredData({ data, id = 'structured-data' }: StructuredDataProps) {
  useEffect(() => {
    // Create script element
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);

    // Remove existing script with same ID if exists
    const existingScript = document.getElementById(id);
    if (existingScript) {
      existingScript.remove();
    }

    // Append to head
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById(id);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [data, id]);

  return null;
}

/**
 * Product Structured Data Component
 * Use this in ProductDetail pages
 */
export function ProductStructuredData({ data }: StructuredDataProps) {
  return <StructuredData data={data} id="product-schema" />;
}

/**
 * Organization Structured Data Component
 * Use this in Store pages
 */
export function OrganizationStructuredData({ data }: StructuredDataProps) {
  return <StructuredData data={data} id="organization-schema" />;
}

/**
 * Breadcrumb Structured Data Component
 * Use this in any page with navigation hierarchy
 */
export function BreadcrumbStructuredData({ data }: StructuredDataProps) {
  return <StructuredData data={data} id="breadcrumb-schema" />;
}
