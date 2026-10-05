import { NextRequest, NextResponse } from 'next/server';
import { getFileStream, statFile, mimeFor, MINIO_BUCKET } from '@/lib/minio';

export const dynamic = 'force-dynamic';

/**
 * GET /api/files/<objectKey> — streams a file out of MinIO through Node.
 * Everything the browser needs (page images, covers, audio) is served
 * same-origin through this route, so canvases stay untainted.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const { key } = await params;
    const objectKey = key.map(decodeURIComponent).join('/');
    if (!objectKey || objectKey.includes('..')) {
      return NextResponse.json({ success: false, error: 'Invalid key' }, { status: 400 });
    }

    const stat = await statFile(objectKey);
    const contentType = (stat.metaData?.['content-type'] as string) || mimeFor(objectKey);
    const stream = await getFileStream(objectKey);

    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(webStream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Bucket': MINIO_BUCKET,
      },
    });
  } catch (error: any) {
    if (error?.code === 'NoSuchKey' || error?.code === 'NotFound') {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }
    console.error('MinIO file serve error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
