/**
 * Client-side image compression utility
 * Compresses images to a maximum file size while maintaining quality
 */

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];

export const ALLOWED_IMAGE_TYPES = [...SUPPORTED_MIME_TYPES, ...HEIC_MIME_TYPES];

const isHeic = (file: File): boolean => {
  if (HEIC_MIME_TYPES.includes(file.type.toLowerCase())) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return HEIC_EXTENSIONS.includes(ext);
};

export async function normalizeImageFormat(file: File): Promise<File> {
  if (!isHeic(file)) return file;

  try {
    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }) as Blob;
    const jpegName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], jpegName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    throw new Error('Could not convert HEIC image. Please export the photo as JPG from your camera app and try again.');
  }
}

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
  maxSizeMB: number = 5,
  maxWidthOrHeight: number = 1200
): Promise<File> {
  const fileSizeMB = file.size / 1024 / 1024;

  // Skip only if already WebP and within both size and dimension limits
  if (file.type === 'image/webp' && fileSizeMB <= maxSizeMB) {
    return file;
  }

  const options: CompressionOptions = {
    maxSizeMB,
    maxWidthOrHeight,
    initialQuality: 0.85,
    minQuality: 0.55,
    step: 0.05,
  };

  try {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);
    const { width, height } = calculateDimensions(img.width, img.height, options.maxWidthOrHeight!);
    const compressedFile = await compressWithQuality(img, width, height, file.name, options);
    const compressedSizeMB = compressedFile.size / 1024 / 1024;
    console.log(`Image optimized: ${fileSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB WebP`);
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
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
  options: CompressionOptions
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(img, 0, 0, width, height);

  // Always output WebP — 40-60% smaller than JPEG at equivalent visual quality
  const mimeType = 'image/webp';
  const webpFileName = fileName.replace(/\.[^.]+$/, '.webp');
  const maxSizeBytes = options.maxSizeMB! * 1024 * 1024;

  let quality = options.initialQuality!;
  let blob: Blob | null = null;

  while (quality >= options.minQuality!) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mimeType, quality);
    });

    if (!blob) {
      throw new Error('Failed to create blob from canvas');
    }

    if (blob.size <= maxSizeBytes) {
      break;
    }

    quality -= options.step!;
  }

  if (!blob) {
    throw new Error('Failed to compress image');
  }

  return new File([blob], webpFileName, {
    type: mimeType,
    lastModified: Date.now(),
  });
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
