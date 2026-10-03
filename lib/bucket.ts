import mongoose from 'mongoose';
import { connectDB } from './mongodb';
import { Readable } from 'stream';

const BUCKET_NAME = 'manga_bucket';

/**
 * Returns a GridFSBucket instance connected to the MongoDB database.
 */
export async function getGridFSBucket(bucketName = BUCKET_NAME) {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not initialized');
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName });
}

/**
 * Uploads a Buffer directly to MongoDB GridFS Bucket Engine.
 */
export async function uploadBufferToBucket(
  buffer: Buffer,
  filename: string,
  contentType: string = 'image/jpeg',
  metadata: Record<string, any> = {}
): Promise<{ fileId: string; url: string; size: number; filename: string; contentType: string }> {
  const bucket = await getGridFSBucket();

  return new Promise((resolve, reject) => {
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        contentType,
        ...metadata,
        uploadedAt: new Date(),
      },
    } as any);

    uploadStream.on('finish', () => {
      const fileId = uploadStream.id.toString();
      resolve({
        fileId,
        url: `/api/bucket/${fileId}`,
        size: buffer.length,
        filename,
        contentType,
      });
    });

    uploadStream.on('error', (err) => {
      reject(err);
    });

    readableStream.pipe(uploadStream);
  });
}

/**
 * Retrieves a file stream and file document from MongoDB GridFS Bucket Engine.
 */
export async function getBucketFileStream(fileId: string): Promise<{
  stream: NodeJS.ReadableStream;
  file: any;
}> {
  const bucket = await getGridFSBucket();
  const objectId = new mongoose.Types.ObjectId(fileId);

  const files = await bucket.find({ _id: objectId }).toArray();
  if (!files || files.length === 0) {
    throw new Error('File not found in MongoDB Bucket');
  }

  const file = files[0];
  const stream = bucket.openDownloadStream(objectId);
  return { stream, file };
}

/**
 * Deletes a file from MongoDB GridFS Bucket Engine.
 */
export async function deleteBucketFile(fileId: string): Promise<boolean> {
  try {
    const bucket = await getGridFSBucket();
    const objectId = new mongoose.Types.ObjectId(fileId);
    await bucket.delete(objectId);
    return true;
  } catch (err) {
    console.warn(`Failed to delete GridFS file ${fileId}:`, err);
    return false;
  }
}
