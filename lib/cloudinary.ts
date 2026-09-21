import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim().replace(/^^-/, '');
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

const isConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isConfigured) {
  try {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  } catch (e) {
    console.error('Failed to configure Cloudinary:', e);
  }
}

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto'
): Promise<{
  cloudinaryUrl: string;
  publicId: string;
  format: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  duration?: number;
}> {
  if (!isConfigured) {
    const base64Data = fileBuffer.toString('base64');
    const mimeType = resourceType === 'video' ? 'video/mp4' : 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    return {
      cloudinaryUrl: dataUrl,
      publicId: 'local_' + Date.now(),
      format: resourceType === 'video' ? 'mp4' : 'jpg',
      fileSize: fileBuffer.length,
      dimensions: { width: 800, height: 1200 },
    };
  }

  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `webtoon/${folder}`,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          console.warn('Cloudinary upload error, falling back to data URL:', error.message);
          const base64Data = fileBuffer.toString('base64');
          const mimeType = resourceType === 'video' ? 'video/mp4' : 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${base64Data}`;
          return resolve({
            cloudinaryUrl: dataUrl,
            publicId: 'fallback_' + Date.now(),
            format: resourceType === 'video' ? 'mp4' : 'jpg',
            fileSize: fileBuffer.length,
            dimensions: { width: 800, height: 1200 },
          });
        }
        if (!result) {
          const base64Data = fileBuffer.toString('base64');
          const dataUrl = `data:image/jpeg;base64,${base64Data}`;
          return resolve({
            cloudinaryUrl: dataUrl,
            publicId: 'fallback_' + Date.now(),
            format: 'jpg',
            fileSize: fileBuffer.length,
            dimensions: { width: 800, height: 1200 },
          });
        }

        resolve({
          cloudinaryUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format || 'jpg',
          fileSize: result.bytes || 0,
          dimensions: result.width && result.height ? { width: result.width, height: result.height } : undefined,
          duration: result.duration,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

export async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') {
  if (!isConfigured || publicId.startsWith('local_') || publicId.startsWith('fallback_')) {
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.error('Delete from cloudinary error:', e);
  }
}

export default cloudinary;
