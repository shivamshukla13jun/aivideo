import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';
import { getFileBuffer, uploadFile, fileUrl } from '@/lib/minio';

export const dynamic = 'force-dynamic';

const paddleUrl = () =>
  (process.env.PADDLEOCR_URL || 'http://localhost:5004').replace(/\/+$/, '');

/**
 * POST /api/chapters/[id]/preprocess
 * Clean all chapter page images: denoise, enhance contrast, remove watermarks,
 * sharpen text. Saves processed images back to MinIO and updates Page docs.
 * Must run BEFORE OCR for best results.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chapterId } = await params;
    await connectDB();

    const pages = await Page.find({
      chapterId,
      status: { $ne: 'deleted' },
    }).sort({ order: 1 });

    if (pages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No pages found — upload a CBZ first' },
        { status: 404 }
      );
    }

    let done = 0;
    const failed: number[] = [];

    for (const page of pages) {
      const order = page.order ?? done + 1;
      try {
        // Read original image from MinIO
        const objectKey = page.publicId;
        if (!objectKey) {
          failed.push(order);
          continue;
        }
        const buf = await getFileBuffer(objectKey);

        // Send to OCR server's /preprocess endpoint
        const fd = new FormData();
        fd.append(
          'file',
          new Blob([new Uint8Array(buf)], { type: 'application/octet-stream' }),
          'page.png'
        );
        const res = await fetch(`${paddleUrl()}/preprocess`, {
          method: 'POST',
          body: fd,
          signal: AbortSignal.timeout(120_000),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn(
            `[Preprocess] Page ${order} failed:`,
            err?.error || res.status
          );
          failed.push(order);
          continue;
        }

        // Save processed image to MinIO under a new key
        const processedBuf = Buffer.from(await res.arrayBuffer());
        const editedKey = objectKey.replace(
          /(\.[^.]+)$/,
          '_processed$1'
        );
        const stored = await uploadFile(processedBuf, editedKey);

        // Update Page document with the processed image URL
        await Page.findByIdAndUpdate(page._id, {
          $set: {
            editedUrl: stored.url,
            processedKey: editedKey,
          },
        });

        done++;
      } catch (err: any) {
        console.warn(
          `[Preprocess] Page ${order} error:`,
          err?.message || err
        );
        failed.push(order);
      }
    }

    return NextResponse.json({
      success: true,
      total: pages.length,
      done,
      failed,
    });
  } catch (error: any) {
    console.error('Preprocess error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
