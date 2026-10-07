import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { OcrJob } from '@/models/OcrJob';
import { Chapter } from '@/models/Chapter';
import { Series } from '@/models/Series';
import { Page } from '@/models/Page';
import { publishOcrJob } from '@/lib/queue';
import { runOcrJob } from '@/lib/ocrJob';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chapters/[id]/preprocess — clean all chapter page images
 * (denoise, enhance contrast, remove watermarks, sharpen text) as a
 * background job via RabbitMQ. The processed image REPLACES the original in
 * MinIO — the Page (and scenes built from it) are repointed at the cleaned
 * file and the old object is deleted. Must run BEFORE OCR for best results.
 * Body: { overwrite?: boolean } — reprocess pages even if already cleaned.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chapterId } = await params;
    const body = await req.json().catch(() => ({}));

    await connectDB();

    const pageCount = await Page.countDocuments({ chapterId, status: { $ne: 'deleted' } });
    if (pageCount === 0) {
      return NextResponse.json(
        { success: false, error: 'No pages found — upload a CBZ first' },
        { status: 404 }
      );
    }

    let seriesId = '';
    let seriesTitle = '';
    let chapterName = `Chapter ${chapterId}`;
    try {
      const chap = await Chapter.findById(chapterId);
      if (chap) {
        chapterName = chap.title || `Chapter ${chap.chapterNumber}`;
        seriesId = String(chap.seriesId || '');
        const series = await Series.findById(chap.seriesId);
        seriesTitle = series?.title || '';
      }
    } catch {
      // non-fatal — job still works without display metadata
    }

    // Count what this run will process so queued jobs show "0/N" immediately.
    // Pending = not yet processed; overwrite re-cleans every page.
    const overwrite = Boolean(body.overwrite);
    const totalPages = overwrite
      ? pageCount
      : await Page.countDocuments({
          chapterId,
          status: { $ne: 'deleted' },
          processedKey: { $in: [null, ''] },
        });

    const jobId = `ocr_${chapterId}_${Date.now()}`;
    await OcrJob.create({
      jobId,
      chapterId,
      seriesId,
      seriesTitle,
      chapterName,
      provider: 'paddle',
      stage: 'preprocess',
      overwriteScenes: overwrite,
      status: 'queued',
      totalPages,
      donePages: 0,
      failedOrders: [],
    });

    const queued = await publishOcrJob(jobId);

    if (!queued) {
      // RabbitMQ unavailable — fall back to synchronous processing
      const result = await runOcrJob(jobId);
      return NextResponse.json({ success: true, queued: false, jobId, ...result });
    }

    return NextResponse.json({ success: true, queued: true, jobId }, { status: 202 });
  } catch (error: any) {
    console.error('Error starting preprocess job:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
