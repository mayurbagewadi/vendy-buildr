// Utility for generating unique identifiers

/**
 * Generates a unique ID using timestamp and random characters
 * Format: [timestamp]-[random]
 * Example: 1728567890123-a3k9f2
 */
export const generateUniqueId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
};

/**
 * Generates a product-specific unique ID (numbers only)
 * Format: [timestamp][random-digits]
 * Example: 17285678901234567
 */
export const generateProductId = (): string => {
  const timestamp = Date.now();
  const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${timestamp}${randomDigits}`;
};

/**
 * Generates a UUID v4 (more robust, longer)
 * Example: 550e8400-e29b-41d4-a716-446655440000
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
