// Alt Tag Generator for SEO & Accessibility
// Generate descriptive, keyword-rich alt text for images

/**
 * Why Alt Tags Matter (20+ Years Experience):
 *
 * 1. Google Image Search:
 *    - 20-30% of organic traffic comes from image search
 *    - Alt text is #1 ranking factor for image SEO
 *    - Descriptive alt = higher image search rankings
 *
 * 2. Accessibility (WCAG 2.1):
 *    - Screen readers for visually impaired users
 *    - Legal requirement in many countries (ADA compliance)
 *    - Better UX for everyone
 *
 * 3. Fallback Content:
 *    - Shows when image fails to load
 *    - Better UX on slow connections
 *    - Context preserved even without image
 *
 * 4. SEO Signals:
 *    - Google uses alt text to understand page context
 *    - Contributes to overall page relevance
 *    - Helps rank for long-tail keywords
 */

interface ProductImageAltOptions {
  productName: string;
  storeName?: string;
  category?: string;
  variant?: string;
  imageIndex?: number;
}

interface StoreImageAltOptions {
  storeName: string;
  imageType: 'logo' | 'banner' | 'hero' | 'thumbnail';
  description?: string;
}

/**
 * Generate SEO-optimized alt text for product images
 *
 * Best Practices:
 * - 125 characters or less (Google truncates longer alt text)
 * - Descriptive but concise
 * - Include key information: product name, store, category
 * - Natural language (no keyword stuffing)
 */
export function generateProductImageAlt(options: ProductImageAltOptions): string {
  const { productName, storeName, category, variant, imageIndex } = options;

  const parts: string[] = [];

  // Core: Product name (always first)
  parts.push(productName);

  // Add variant if specified (e.g., "Red", "Large", "32GB")
  if (variant) {
    parts.push(variant);
  }

  // Add context based on image index
  if (imageIndex !== undefined && imageIndex > 0) {
    const views = [
      'front view',
      'side view',
      'back view',
      'detail view',
      'alternate view'
    ];
    const view = views[imageIndex] || 'additional view';
    parts.push(view);
  }

  // Add category for context (helps with SEO)
  if (category) {
    parts.push(`in ${category}`);
  }

  // Add store attribution
  if (storeName) {
    parts.push(`at ${storeName}`);
  }

  // Join with separators
  let alt = parts.join(' - ');

  // Truncate to 125 characters (Google's recommendation)
  if (alt.length > 125) {
    alt = alt.substring(0, 122) + '...';
  }

  return alt;
}

/**
 * Generate alt text for store branding images
 */
export function generateStoreImageAlt(options: StoreImageAltOptions): string {
  const { storeName, imageType, description } = options;

  switch (imageType) {
    case 'logo':
      return `${storeName} logo`;

    case 'banner':
      return description
        ? `${storeName} - ${description}`
        : `${storeName} banner`;

    case 'hero':
      return description
        ? `${storeName} - ${description}`
        : `${storeName} hero image`;

    case 'thumbnail':
      return `${storeName} thumbnail`;

    default:
      return `${storeName} image`;
  }
}

/**
 * Generate alt text for category images
 */
export function generateCategoryImageAlt(
  categoryName: string,
  storeName?: string
): string {
  return storeName
    ? `${categoryName} category at ${storeName}`
    : `${categoryName} category`;
}

/**
 * Validate alt text quality (for development/testing)
 * Returns issues if any
 */
export function validateAltText(alt: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check length
  if (alt.length === 0) {
    issues.push('Alt text is empty');
  } else if (alt.length > 125) {
    issues.push('Alt text exceeds 125 characters (Google truncates)');
  }

  // Check for common mistakes
  if (alt.toLowerCase().startsWith('image of')) {
    issues.push('Avoid starting with "image of" - redundant');
  }

  if (alt.toLowerCase().startsWith('picture of')) {
    issues.push('Avoid starting with "picture of" - redundant');
  }

  // Check for keyword stuffing (more than 3 commas usually indicates stuffing)
  const commaCount = (alt.match(/,/g) || []).length;
  if (commaCount > 3) {
    issues.push('Possible keyword stuffing - too many commas');
  }

  // Check for placeholder text
  const placeholders = ['placeholder', 'default', 'untitled', 'image', 'photo'];
  if (placeholders.some(p => alt.toLowerCase().includes(p))) {
    issues.push('Contains placeholder text - should be descriptive');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Extract product info from various data formats
 * Handles flexibility in data structure
 */
export function getProductAltFromData(
  product: any,
  storeName?: string,
  imageIndex?: number
): string {
  const productName = product.name || product.title || 'Product';
  const category = product.category || product.categoryName;
  const variant = product.selectedVariant || product.variant;

  return generateProductImageAlt({
    productName,
    storeName,
    category,
    variant,
    imageIndex
  });
}

/**
 * Smart alt text: Use existing alt if good, generate if missing/poor
 */
export function ensureQualityAlt(
  existingAlt: string | undefined,
  fallbackOptions: ProductImageAltOptions
): string {
  // If no alt text, generate it
  if (!existingAlt || existingAlt.trim() === '') {
    return generateProductImageAlt(fallbackOptions);
  }

  // Validate existing alt text
  const validation = validateAltText(existingAlt);

  // If existing alt is good, use it
  if (validation.valid) {
    return existingAlt;
  }

  // If existing alt has issues, generate new one
  return generateProductImageAlt(fallbackOptions);
}
