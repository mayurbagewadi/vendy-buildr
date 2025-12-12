// Default images pool for products and categories without custom images
// These images are randomly assigned when store owners don't provide their own images

export const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1763359161311-1a62681fb3c0?w=800&q=80",
  "https://images.unsplash.com/photo-1763359161278-0cabc4924746?w=800&q=80",
  "https://images.unsplash.com/photo-1763359161530-6631e16431fd?w=800&q=80",
  "https://images.unsplash.com/photo-1763359161346-dbb620ef8fe9?w=800&q=80",
  "https://images.unsplash.com/photo-1763359161317-5e4e5ea3075f?w=800&q=80",
  "https://images.unsplash.com/photo-1763359161302-ccacb7b785da?w=800&q=80",
  "https://images.unsplash.com/photo-1763358991454-2d0059bf6796?w=800&q=80",
  "https://images.unsplash.com/photo-1763358958563-b9efe06f989f?w=800&q=80",
  "https://images.unsplash.com/photo-1763358927011-ab7d82821124?w=800&q=80",
  "https://images.unsplash.com/photo-1763358896930-3982ec4e3293?w=800&q=80",
];

/**
 * Get a random image from the default images pool
 * @returns A random image URL
 */
export const getRandomDefaultImage = (): string => {
  const randomIndex = Math.floor(Math.random() * DEFAULT_IMAGES.length);
  return DEFAULT_IMAGES[randomIndex];
};

/**
 * Get multiple random images from the default pool
 * @param count Number of images to get (default: 1)
 * @returns Array of random image URLs
 */
export const getRandomDefaultImages = (count: number = 1): string[] => {
  const images: string[] = [];
  for (let i = 0; i < count; i++) {
    images.push(getRandomDefaultImage());
  }
  return images;
};
