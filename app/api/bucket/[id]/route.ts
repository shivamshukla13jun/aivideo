import { NextRequest, NextResponse } from 'next/server';
import { getBucketFileStream } from '@/lib/bucket';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id.length !== 24) {
      return new NextResponse('Invalid file ID', { status: 400 });
    }

    const { stream, file } = await getBucketFileStream(id);
    const contentType = file.contentType || 'application/octet-stream';
    const fileSize = file.length || 0;

    // Range support for audio/video streaming
    const rangeHeader = req.headers.get('range');
    if (rangeHeader && fileSize > 0) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (!isNaN(start) && start < fileSize) {
        const chunksize = end - start + 1;
        const { getGridFSBucket } = await import('@/lib/bucket');
        const bucket = await getGridFSBucket();
        const mongoose = (await import('mongoose')).default;
        const rangedStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(id), {
          start,
          end: end + 1,
        });

        const webStream = Readable.toWeb(rangedStream as any) as ReadableStream<Uint8Array>;
        return new NextResponse(webStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunksize),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }

    const webStream = Readable.toWeb(stream as any) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.filename || 'file')}"`,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('File not found')) {
      return new NextResponse('File not found in bucket', { status: 404 });
    }
    console.error('Bucket stream error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
