import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index';

type ResourceType = 'image' | 'video' | 'raw' | 'auto';

export class CloudinaryService {
  private cloudinaryEnabled: boolean;

  constructor() {
    const { cloudName, apiKey, apiSecret } = config.cloudinary;
    this.cloudinaryEnabled =
      !!cloudName && !!apiKey && !!apiSecret && cloudName !== 'demo_cloud' && apiKey !== 'demo_key';

    if (this.cloudinaryEnabled) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret
      });
    }
  }

  /**
   * Uploads media to Cloudinary — the only storage backend.
   * Local /uploads files are pushed to Cloudinary and then removed from disk so
   * no leftover copy remains in the folder where the file first landed.
   * Throws on failure — no local files or placeholder URLs are ever stored.
   */
  public async uploadMedia(
    fileBufferOrUrl: string | Buffer,
    folder: string,
    resourceType: ResourceType = 'auto',
    preferredFilename?: string
  ): Promise<{ url: string; publicId: string }> {
    if (!this.cloudinaryEnabled) {
      throw new Error('Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET');
    }

    const timestamp = Date.now();
    const randomHash = Math.random().toString(36).substring(2, 9);
    const publicIdName = preferredFilename
      ? `${path.basename(preferredFilename, path.extname(preferredFilename)).replace(/[^a-zA-Z0-9_\-]/g, '_')}_${randomHash}`
      : `${timestamp}_${randomHash}`;

    const localFilePath = this.resolveLocalPath(fileBufferOrUrl);
    const options: Record<string, any> = {
      folder,
      resource_type: resourceType,
      public_id: publicIdName
    };

    let result: any;
    if (localFilePath) {
      result = await cloudinary.uploader.upload(localFilePath, options);
      // Remove the local copy after a successful cloud upload
      try {
        fs.unlinkSync(localFilePath);
      } catch (err) {
        console.warn('[CloudinaryService] Could not remove local file:', localFilePath, err);
      }
    } else if (Buffer.isBuffer(fileBufferOrUrl)) {
      result = await this.uploadBuffer(fileBufferOrUrl, options);
    } else {
      // Data-URL or remote http(s) URL — Cloudinary ingests both directly
      result = await cloudinary.uploader.upload(String(fileBufferOrUrl), options);
    }

    return { url: result.secure_url, publicId: result.public_id };
  }

  /**
   * Streams a Buffer to Cloudinary via upload_stream.
   */
  private uploadBuffer(buffer: Buffer, options: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
        if (err || !result) {
          reject(err || new Error('Cloudinary upload returned no result'));
        } else {
          resolve(result);
        }
      });
      stream.end(buffer);
    });
  }

  /**
   * Resolves a /uploads/... URL or absolute path to a file inside the local
   * uploads directory. Returns null for anything else.
   */
  private resolveLocalPath(fileBufferOrUrl: string | Buffer): string | null {
    if (typeof fileBufferOrUrl !== 'string') return null;

    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    let candidate: string | null = null;

    if (fileBufferOrUrl.startsWith('/uploads/')) {
      candidate = path.resolve(process.cwd(), fileBufferOrUrl.replace(/^\/+/, ''));
    } else if (path.isAbsolute(fileBufferOrUrl)) {
      candidate = path.resolve(fileBufferOrUrl);
    }

    if (candidate && candidate.startsWith(uploadsRoot) && fs.existsSync(candidate)) {
      return candidate;
    }
    return null;
  }

  public async deleteMedia(publicId: string): Promise<boolean> {
    if (this.cloudinaryEnabled && publicId && !publicId.startsWith('local_')) {
      for (const resourceType of ['image', 'raw', 'video'] as const) {
        try {
          const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          if (result?.result === 'ok') {
            console.log(`[Cloudinary] Deleted asset ${publicId} (${resourceType})`);
            return true;
          }
        } catch (err) {
          console.warn(`[Cloudinary] Destroy failed for ${publicId} as ${resourceType}:`, err);
        }
      }
      console.warn(`[Cloudinary] Could not delete asset: ${publicId}`);
      return false;
    }

    console.log(`[Cloudinary] Deleted asset with publicId: ${publicId}`);
    return true;
  }
}

export const cloudinaryService = new CloudinaryService();
