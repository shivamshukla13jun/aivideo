/**
 * MinIO object storage client.
 * All file operations (CBZ archives, extracted page images, audio, covers)
 * go through this module — nothing is stored on the local filesystem.
 */

import * as Minio from 'minio';

const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = parseInt(process.env.MINIO_PORT || '9000', 10);
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'webtoon';

let client: Minio.Client | null = null;

export function getMinio(): Minio.Client {
  if (!client) {
    client = new Minio.Client({ endPoint, port, useSSL, accessKey, secretKey });
  }
  return client;
}

let bucketReady: Promise<void> | null = null;

/** Create the bucket once per process if it doesn't exist. */
export async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const mc = getMinio();
      const exists = await mc.bucketExists(MINIO_BUCKET).catch(() => false);
      if (!exists) await mc.makeBucket(MINIO_BUCKET);
    })();
    bucketReady.catch(() => {
      bucketReady = null;
    });
  }
  return bucketReady;
}

export interface StoredFile {
  /** Public URL served through /api/files (same-origin, canvas-safe). */
  url: string;
  /** MinIO object key. */
  objectKey: string;
  fileName: string;
  fileSize: number;
  format: string;
  mimeType: string;
}

const extOf = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || 'bin').toLowerCase();

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp',
  cbz: 'application/x-cbz', zip: 'application/zip',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  mp4: 'video/mp4', webm: 'video/webm',
};

export const mimeFor = (name: string) => MIME[extOf(name)] || 'application/octet-stream';

/** Same-origin URL the browser can load — streams through /api/files. */
export const fileUrl = (objectKey: string) =>
  `/api/files/${objectKey.split('/').map(encodeURIComponent).join('/')}`;

/** Upload a buffer to MinIO and return its stored-file descriptor. */
export async function uploadFile(
  buffer: Buffer,
  objectKey: string,
  fileName?: string,
  mimeType?: string
): Promise<StoredFile> {
  await ensureBucket();
  const mime = mimeType || mimeFor(objectKey);
  await getMinio().putObject(MINIO_BUCKET, objectKey, buffer, buffer.length, {
    'Content-Type': mime,
  });
  return {
    url: fileUrl(objectKey),
    objectKey,
    fileName: fileName || objectKey.split('/').pop() || objectKey,
    fileSize: buffer.length,
    format: extOf(objectKey),
    mimeType: mime,
  };
}

/** Read an object back into memory. */
export async function getFileBuffer(objectKey: string): Promise<Buffer> {
  const stream = await getMinio().getObject(MINIO_BUCKET, objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Get a readable stream for an object (used by /api/files). */
export async function getFileStream(objectKey: string) {
  return getMinio().getObject(MINIO_BUCKET, objectKey);
}

export async function statFile(objectKey: string) {
  return getMinio().statObject(MINIO_BUCKET, objectKey);
}

export async function deleteFile(objectKey: string): Promise<void> {
  try {
    await getMinio().removeObject(MINIO_BUCKET, objectKey);
  } catch (e) {
    console.warn('MinIO delete failed:', objectKey, e);
  }
}

/** Delete all objects under a prefix (e.g. `chapters/<id>/`). Returns count. */
export async function deleteFilesByPrefix(prefix: string): Promise<number> {
  const mc = getMinio();
  const keys: string[] = [];
  const stream = mc.listObjectsV2(MINIO_BUCKET, prefix, true);
  for await (const obj of stream) {
    if (obj.name) keys.push(obj.name);
  }
  if (keys.length === 0) return 0;
  await mc.removeObjects(MINIO_BUCKET, keys);
  return keys.length;
}

/** Delete multiple specific keys. Tolerates missing objects. Returns count. */
export async function deleteFiles(keys: string[]): Promise<number> {
  const valid = keys.filter(Boolean);
  if (valid.length === 0) return 0;
  const mc = getMinio();
  await mc.removeObjects(MINIO_BUCKET, valid);
  return valid.length;
}
