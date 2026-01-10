/**
 * Client-side image compression utility
 * Compresses images to a maximum file size while maintaining quality
 */

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  initialQuality?: number;
  minQuality?: number;
  step?: number;
}

/**
 * Compress an image file to meet size requirements
 * @param file - The image file to compress
 * @param maxSizeMB - Maximum size in megabytes (default: 5MB)
 * @returns Compressed file
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 5
): Promise<File> {
  const options: CompressionOptions = {
    maxSizeMB,
    maxWidthOrHeight: 2048,
    initialQuality: 0.9,
    minQuality: 0.6,
    step: 0.05,
  };

  // Check if file is already under the size limit
  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB <= maxSizeMB) {
    console.log(`Image already under ${maxSizeMB}MB:`, fileSizeMB.toFixed(2) + 'MB');
    return file;
  }

  console.log(`Compressing image from ${fileSizeMB.toFixed(2)}MB to max ${maxSizeMB}MB`);

  try {
    // Read file as data URL
    const dataUrl = await readFileAsDataURL(file);

    // Load image
    const img = await loadImage(dataUrl);

    // Calculate target dimensions (maintain aspect ratio)
    const { width, height } = calculateDimensions(
      img.width,
      img.height,
      options.maxWidthOrHeight!
    );

    // Compress with iterative quality reduction
    const compressedFile = await compressWithQuality(
      img,
      width,
      height,
      file.name,
      file.type,
      options
    );

    const compressedSizeMB = compressedFile.size / 1024 / 1024;
    console.log(
      `Compression complete: ${fileSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB`
    );

    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Read file as data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Calculate target dimensions maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const aspectRatio = width / height;

  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}

/**
 * Compress image with iterative quality reduction
 */
async function compressWithQuality(
  img: HTMLImageElement,
  width: number,
  height: number,
  fileName: string,
  fileType: string,
  options: CompressionOptions
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw image on canvas
  ctx.drawImage(img, 0, 0, width, height);

  // Determine output format (default to JPEG for better compression)
  let mimeType = fileType;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(fileType)) {
    mimeType = 'image/jpeg';
  }

  // Iteratively reduce quality until size requirement is met
  let quality = options.initialQuality!;
  const maxSizeBytes = (options.maxSizeMB! * 1024 * 1024);
  let blob: Blob | null = null;

  while (quality >= options.minQuality!) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        mimeType,
        quality
      );
    });

    if (!blob) {
      throw new Error('Failed to create blob from canvas');
    }

    // Check if size requirement is met
    if (blob.size <= maxSizeBytes) {
      console.log(`Compression successful at quality ${quality.toFixed(2)}`);
      break;
    }

    // Reduce quality for next iteration
    quality -= options.step!;
  }

  if (!blob) {
    throw new Error('Failed to compress image');
  }

  // Convert blob to File
  const compressedFile = new File([blob], fileName, {
    type: mimeType,
    lastModified: Date.now(),
  });

  return compressedFile;
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
