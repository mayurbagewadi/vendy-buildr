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
 * Generates a product-specific unique ID
 * Format: PRD-[timestamp]-[random]
 * Example: PRD-1728567890123-a3k9f2
 */
export const generateProductId = (): string => {
  return `PRD-${generateUniqueId()}`;
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
