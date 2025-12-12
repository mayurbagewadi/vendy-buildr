// SEO-Friendly Image Component with automatic alt text generation
// Drop-in replacement for <img> tags with built-in SEO best practices

import React from 'react';
import { generateProductImageAlt, generateStoreImageAlt, generateCategoryImageAlt } from '@/lib/seo/altTags';

interface BaseImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string; // Optional - will generate if not provided
}

interface ProductImageProps extends BaseImageProps {
  type: 'product';
  productName: string;
  storeName?: string;
  category?: string;
  variant?: string;
  imageIndex?: number;
}

interface StoreImageProps extends BaseImageProps {
  type: 'store';
  storeName: string;
  imageType: 'logo' | 'banner' | 'hero' | 'thumbnail';
  description?: string;
}

interface CategoryImageProps extends BaseImageProps {
  type: 'category';
  categoryName: string;
  storeName?: string;
}

interface GenericImageProps extends BaseImageProps {
  type?: 'generic';
  alt: string; // Required for generic images
}

type SEOImageProps = ProductImageProps | StoreImageProps | CategoryImageProps | GenericImageProps;

/**
 * SEO-Optimized Image Component
 *
 * Automatically generates descriptive, keyword-rich alt text
 * Follows SEO best practices (20+ years experience)
 *
 * Usage:
 *
 * Product images:
 * <SEOImage
 *   type="product"
 *   src={image}
 *   productName="HP Laptop 15"
 *   storeName="John's Electronics"
 *   category="Laptops"
 *   imageIndex={0}
 * />
 *
 * Store logos/banners:
 * <SEOImage
 *   type="store"
 *   src={logo}
 *   storeName="John's Electronics"
 *   imageType="logo"
 * />
 *
 * Category images:
 * <SEOImage
 *   type="category"
 *   src={image}
 *   categoryName="Electronics"
 *   storeName="John's Electronics"
 * />
 *
 * Generic (must provide alt):
 * <SEOImage
 *   src={image}
 *   alt="Descriptive alt text"
 * />
 */
export function SEOImage(props: SEOImageProps) {
  const { type, src, alt: providedAlt, ...restProps } = props;

  // Generate alt text based on type
  let generatedAlt = providedAlt || '';

  if (!providedAlt) {
    switch (type) {
      case 'product':
        generatedAlt = generateProductImageAlt({
          productName: props.productName,
          storeName: props.storeName,
          category: props.category,
          variant: props.variant,
          imageIndex: props.imageIndex
        });
        break;

      case 'store':
        generatedAlt = generateStoreImageAlt({
          storeName: props.storeName,
          imageType: props.imageType,
          description: props.description
        });
        break;

      case 'category':
        generatedAlt = generateCategoryImageAlt(
          props.categoryName,
          props.storeName
        );
        break;

      default:
        // Generic image must have alt provided
        if (!providedAlt) {
          console.warn('SEOImage: Generic images require alt text');
          generatedAlt = 'Image';
        }
    }
  }

  // Remove SEO-specific props before passing to img
  const { productName, storeName, category, variant, imageIndex, imageType, categoryName, description, ...imgProps } = restProps as any;

  return (
    <img
      src={src}
      alt={generatedAlt}
      loading="lazy" // Performance: lazy load images
      {...imgProps}
    />
  );
}

/**
 * Quick shorthand for product images
 * Most common use case
 */
export function ProductImage({
  src,
  productName,
  storeName,
  category,
  variant,
  imageIndex,
  ...props
}: Omit<ProductImageProps, 'type'>) {
  return (
    <SEOImage
      type="product"
      src={src}
      productName={productName}
      storeName={storeName}
      category={category}
      variant={variant}
      imageIndex={imageIndex}
      {...props}
    />
  );
}

/**
 * Quick shorthand for store images
 */
export function StoreImage({
  src,
  storeName,
  imageType,
  description,
  ...props
}: Omit<StoreImageProps, 'type'>) {
  return (
    <SEOImage
      type="store"
      src={src}
      storeName={storeName}
      imageType={imageType}
      description={description}
      {...props}
    />
  );
}

/**
 * Quick shorthand for category images
 */
export function CategoryImage({
  src,
  categoryName,
  storeName,
  ...props
}: Omit<CategoryImageProps, 'type'>) {
  return (
    <SEOImage
      type="category"
      src={src}
      categoryName={categoryName}
      storeName={storeName}
      {...props}
    />
  );
}
