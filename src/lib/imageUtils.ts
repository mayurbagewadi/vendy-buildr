/**
 * Converts Google Drive share links to direct image URLs
 * @param url - The image URL (can be Google Drive link or direct URL)
 * @returns Direct image URL that can be used in img src
 */
export const convertToDirectImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  // If it's already a direct Google Drive link, return it
  if (url.includes('drive.google.com/uc?')) {
    return url;
  }
  
  // Convert Google Drive share link to direct link
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }
  
  // If it's not a Google Drive link, return as is
  return url;
};
