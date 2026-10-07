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
 * POST /api/chapters/[id]/translate-text — translate extracted English text
 * (Page.extractedText) into Hindi (Page.extractedTextHi) as a background job.
 * Body: { overwrite?: boolean } — overwrite also re-translates pages that already
 * have Hindi text; default only fills pages where it's still pending.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chapterId } = await params;

    const body = await req.json().catch(() => ({}));

    await connectDB();

    // Resolve series/chapter names for the dashboard job card
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

    // Nothing to translate until extraction has produced English text
    const translatable = await Page.countDocuments({
      chapterId,
      status: { $ne: 'deleted' },
      extractedText: { $regex: /\S/ },
    });
    if (translatable === 0) {
      return NextResponse.json(
        { success: false, error: 'No extracted text yet — run Extract Text first' },
        { status: 400 }
      );
    }

    // Count what this run will process so queued jobs show "0/N" immediately.
    // Pending = has English text, no Hindi yet; overwrite re-translates all.
    const overwrite = Boolean(body.overwrite);
    const totalPages = await Page.countDocuments({
      chapterId,
      status: { $ne: 'deleted' },
      extractedText: { $regex: /\S/ },
      ...(overwrite ? {} : { extractedTextHi: { $in: [null, ''] } }),
    });

    const jobId = `ocr_${chapterId}_${Date.now()}`;
    await OcrJob.create({
      jobId,
      chapterId,
      seriesId,
      seriesTitle,
      chapterName,
      provider: 'ai',
      stage: 'translate',
      overwriteScenes: overwrite,
      status: 'queued',
      totalPages,
      donePages: 0,
      failedOrders: [],
    });

    const queued = await publishOcrJob(jobId);

    if (!queued) {
      // RabbitMQ unavailable — fall back to synchronous translation
      const result = await runOcrJob(jobId);
      return NextResponse.json({ success: true, queued: false, jobId, ...result });
    }

    return NextResponse.json({ success: true, queued: true, jobId }, { status: 202 });
  } catch (error: any) {
    console.error('Error starting translation job:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
