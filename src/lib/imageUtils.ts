/**
 * Converts Google Drive share links to direct image URLs
 * @param url - The image URL (can be Google Drive link or direct URL)
 * @returns Direct image URL that can be used in img src
 */
export const convertToDirectImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  // If it's already a thumbnail URL, return it
  if (url.includes('drive.google.com/thumbnail?')) {
    return url;
  }

  // Convert uc?export=view URLs to thumbnail format (uc format fails in img tags)
  if (url.includes('drive.google.com/uc?')) {
    const fileIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w1000`;
    }
    return url;
  }

  // Convert Google Drive share link to direct link using thumbnail API
  // Handles both formats: /d/FILE_ID and ?id=FILE_ID
  const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) {
    const fileId = fileIdMatch[1] || fileIdMatch[2];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  // If it's not a Google Drive link, return as is
  return url;
};
