import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

// Initialize Cloudinary with environment variables
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const apiKey = process.env.CLOUDINARY_API_KEY || '';
const apiSecret = process.env.CLOUDINARY_API_SECRET || '';
const cloudinaryUrl = process.env.CLOUDINARY_URL || '';

if (cloudinaryUrl) {
  cloudinary.config();
  console.log('[Cloudinary] Initialized with CLOUDINARY_URL');
} else if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  console.log(`[Cloudinary] Initialized with cloud_name: ${cloudName}`);
} else {
  console.log('[Cloudinary] Note: Cloudinary credentials not fully configured in environment. Using fallback mode.');
}

/**
 * Check if Cloudinary is configured and ready for uploads
 */
export function isCloudinaryConfigured(): boolean {
  const current = cloudinary.config();
  return Boolean(current.cloud_name && current.api_key && current.api_secret);
}

/**
 * Get Cloudinary status details
 */
export function getCloudinaryStatus(): { configured: boolean; cloudName?: string } {
  const current = cloudinary.config();
  return {
    configured: isCloudinaryConfigured(),
    cloudName: current.cloud_name || undefined,
  };
}

export interface CloudinaryUploadResult {
  url: string;
  publicId?: string;
  success: boolean;
  error?: string;
}

/**
 * Upload single image (Base64 data URL, remote URL, or local file path) to Cloudinary
 */
export async function uploadImageToCloudinary(
  imageSource: string,
  folder: string = 'suwayomi_manga'
): Promise<CloudinaryUploadResult> {
  if (!imageSource || typeof imageSource !== 'string') {
    return { url: imageSource, success: false, error: 'Empty image source' };
  }

  // Already hosted on Cloudinary
  if (imageSource.startsWith('https://res.cloudinary.com/') || imageSource.startsWith('http://res.cloudinary.com/')) {
    return { url: imageSource, success: true };
  }

  // If Cloudinary is not configured, gracefully fallback to original image data
  if (!isCloudinaryConfigured()) {
    return {
      url: imageSource,
      success: false,
      error: 'Cloudinary not configured in environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).',
    };
  }

  try {
    const res = await cloudinary.uploader.upload(imageSource, {
      folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });

    return {
      url: res.secure_url,
      publicId: res.public_id,
      success: true,
    };
  } catch (err: any) {
    console.warn('[Cloudinary Service] Upload warning:', err.message || err);
    // Graceful fallback to avoid data loss
    return {
      url: imageSource,
      success: false,
      error: err.message || 'Upload failed',
    };
  }
}

/**
 * Upload an array of images to Cloudinary concurrently with pool limit
 */
export async function uploadBatchImagesToCloudinary(
  images: string[],
  folder: string = 'suwayomi_manga',
  concurrency: number = 4
): Promise<string[]> {
  if (!images || images.length === 0) return [];
  if (!isCloudinaryConfigured()) {
    return images;
  }

  const results: string[] = new Array(images.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < images.length) {
      const idx = currentIndex++;
      const src = images[idx];
      const res = await uploadImageToCloudinary(src, folder);
      results[idx] = res.url;
    }
  }

  const poolSize = Math.min(concurrency, images.length);
  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Extract the Cloudinary public_id from a delivery URL.
 * e.g. https://res.cloudinary.com/<cloud>/image/upload/v1234/suwayomi_manga/abc.jpg
 *      -> suwayomi_manga/abc
 */
export function extractCloudinaryPublicId(url: string): string | null {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return null;
  const clean = url.split(/[?#]/)[0];
  const match = clean.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]{2,5})?$/);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Delete a batch of images from Cloudinary by their delivery URLs.
 * Non-Cloudinary URLs are skipped. Returns the number of images deleted.
 */
export async function deleteImagesFromCloudinary(urls: (string | undefined)[]): Promise<number> {
  if (!urls || urls.length === 0 || !isCloudinaryConfigured()) return 0;
  const publicIds = urls
    .map((u) => (u ? extractCloudinaryPublicId(u) : null))
    .filter((id): id is string => Boolean(id));
  if (publicIds.length === 0) return 0;

  let deleted = 0;
  await Promise.all(
    publicIds.map(async (publicId) => {
      try {
        const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        if (res.result === 'ok' || res.result === 'not found') deleted++;
      } catch (err: any) {
        console.warn(`[Cloudinary Service] Failed to delete image ${publicId}:`, err.message || err);
      }
    })
  );
  return deleted;
}
