// Data validation and error handling utilities

import { Product, Variant } from './productData';
import { CartItem } from './cartUtils';

// Minimal store settings interface for validation
interface StoreSettings {
  storeName?: string;
  whatsappNumber?: string;
  email?: string;
  deliveryCharge?: number;
  freeShippingThreshold?: number;
  taxRate?: number;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Product validation
export const validateProduct = (product: Partial<Product>): string[] => {
  const errors: string[] = [];

  if (!product.name || product.name.trim().length < 2) {
    errors.push('Product name must be at least 2 characters');
  }

  if (!product.description || product.description.trim().length < 10) {
    errors.push('Product description must be at least 10 characters');
  }

  if (!product.category || product.category.trim().length === 0) {
    errors.push('Product category is required');
  }

  if (!product.images || product.images.length === 0) {
    errors.push('At least one product image is required');
  }

  // Validate variants or base price
  if (product.variants && product.variants.length > 0) {
    product.variants.forEach((variant, index) => {
      if (!variant.name || variant.name.trim().length === 0) {
        errors.push(`Variant ${index + 1} name is required`);
      }
      if (variant.price <= 0) {
        errors.push(`Variant ${index + 1} price must be greater than 0`);
      }
    });
  } else if (!product.basePrice || product.basePrice <= 0) {
    errors.push('Base price must be greater than 0 or variants must be provided');
  }

  return errors;
};

// Variant validation
export const validateVariant = (variant: Partial<Variant>): string[] => {
  const errors: string[] = [];

  if (!variant.name || variant.name.trim().length === 0) {
    errors.push('Variant name is required');
  }

  if (!variant.price || variant.price <= 0) {
    errors.push('Variant price must be greater than 0');
  }

  return errors;
};

// Cart item validation
export const validateCartItem = (item: Partial<CartItem>): string[] => {
  const errors: string[] = [];

  if (!item.productId) {
    errors.push('Product ID is required');
  }

  if (!item.productName || item.productName.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!item.price || item.price <= 0) {
    errors.push('Price must be greater than 0');
  }

  if (!item.quantity || item.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  if (!item.productImage || item.productImage.trim().length === 0) {
    errors.push('Product image is required');
  }

  return errors;
};

// Settings validation
export const validateSettings = (settings: Partial<StoreSettings>): string[] => {
  const errors: string[] = [];

  if (!settings.storeName || settings.storeName.trim().length < 2) {
    errors.push('Store name must be at least 2 characters');
  }

  if (settings.whatsappNumber) {
    const cleanNumber = settings.whatsappNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      errors.push('WhatsApp number must be between 10-15 digits');
    }
  }

  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
    errors.push('Invalid email address');
  }

  if (settings.deliveryCharge !== undefined && settings.deliveryCharge < 0) {
    errors.push('Delivery charge cannot be negative');
  }

  if (settings.freeShippingThreshold !== undefined && settings.freeShippingThreshold < 0) {
    errors.push('Free shipping threshold cannot be negative');
  }

  if (settings.taxRate !== undefined && (settings.taxRate < 0 || settings.taxRate > 100)) {
    errors.push('Tax rate must be between 0 and 100');
  }

  return errors;
};

// Image URL validation
export const validateImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Safe data parsing with error handling
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback;
  }
};

// Data sanitization
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

export const sanitizeNumber = (num: number, min = 0, max = Infinity): number => {
  const sanitized = Math.max(min, Math.min(max, num));
  return isNaN(sanitized) ? min : sanitized;
};
