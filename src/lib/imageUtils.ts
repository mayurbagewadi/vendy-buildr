/**
 * Converts Google Drive share links to direct image URLs
 * Supports various Google Drive URL formats:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/file/d/FILE_ID/view?usp=drive_link
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/thumbnail?id=FILE_ID
 * 
 * @param url - The image URL (can be Google Drive link or direct URL)
 * @returns Direct image URL that can be used in img src
 */
export const convertToDirectImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;
  
  // If it's already a direct Google Drive thumbnail/uc link, return it
  if (trimmedUrl.includes('drive.google.com/thumbnail?') || trimmedUrl.includes('drive.google.com/uc?')) {
    return trimmedUrl;
  }
  
  // Check if it's a Google Drive link that needs conversion
  if (trimmedUrl.includes('drive.google.com')) {
    // Extract file ID from various formats:
    // Format 1: /d/FILE_ID (most common share links)
    // Format 2: ?id=FILE_ID or &id=FILE_ID (open links)
    // Format 3: /file/d/FILE_ID
    const fileIdMatch = trimmedUrl.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
    
    if (fileIdMatch) {
      const fileId = fileIdMatch[1] || fileIdMatch[2];
      // Use thumbnail API with large size - more reliable for public images
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
  
  // If it's not a Google Drive link or no ID found, return as is
  return trimmedUrl;
};
