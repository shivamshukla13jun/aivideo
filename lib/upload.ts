/**
 * Multer file-upload adapter for Next.js App Router.
 * Route handlers receive a Web Request; multer expects a Node IncomingMessage,
 * so we wrap the request stream. Files land in memory buffers (they are
 * forwarded to MinIO, never written to disk).
 */

import { Readable } from 'stream';
import { IncomingMessage } from 'http';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB — CBZ archives can be large
});

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ParsedUpload {
  file: UploadedFile | null;
  files: UploadedFile[];
  fields: Record<string, string>;
}

/** Parse multipart/form-data via multer. Runs fields/filters through multer too. */
export async function parseUpload(req: Request, fieldName = 'file'): Promise<ParsedUpload> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return { file: null, files: [], fields: {} };
  }

  const buf = Buffer.from(await req.arrayBuffer());
  const stream = new Readable({
    read() {
      this.push(buf);
      this.push(null);
    },
  }) as Readable & IncomingMessage;

  stream.headers = Object.fromEntries(req.headers.entries());
  stream.method = req.method;

  const parsed = await new Promise<ParsedUpload>((resolve, reject) => {
    upload.any()(stream as any, {} as any, (err: any) => {
      if (err) return reject(err);
      const files = ((stream as any).files || []) as UploadedFile[];
      const fields = ((stream as any).body || {}) as Record<string, string>;
      resolve({ file: files.find((f) => f.fieldname === fieldName) || files[0] || null, files, fields });
    });
  });

  return parsed;
}
