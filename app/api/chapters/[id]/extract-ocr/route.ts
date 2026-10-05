import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { OcrJob } from '@/models/OcrJob';
import { Chapter } from '@/models/Chapter';
import { Series } from '@/models/Series';
import { publishOcrJob } from '@/lib/queue';
import { runOcrJob } from '@/lib/ocrJob';
import { isProviderAvailable } from '@/lib/ocr';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chapterId } = await params;

    const body = await req.json().catch(() => ({}));
    const targetOrders: number[] | null = Array.isArray(body.orders) ? body.orders : null;
    const provider = typeof body.provider === 'string' ? body.provider : 'tesseract';
    if (!isProviderAvailable(provider)) {
      return NextResponse.json(
        { success: false, error: `OCR provider "${provider}" is not configured — add its API key to .env` },
        { status: 400 }
      );
    }

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

    const jobId = `ocr_${chapterId}_${Date.now()}`;
    await OcrJob.create({
      jobId,
      chapterId,
      seriesId,
      seriesTitle,
      chapterName,
      provider,
      overwriteScenes: Boolean(body.overwrite),
      status: 'queued',
      totalPages: targetOrders ? targetOrders.length : 0,
      donePages: 0,
      failedOrders: [],
    });

    const queued = await publishOcrJob(jobId);

    if (!queued) {
      // RabbitMQ unavailable — fall back to synchronous extraction so OCR still works
      const result = await runOcrJob(jobId);
      return NextResponse.json({ success: true, queued: false, jobId, ...result });
    }

    return NextResponse.json({ success: true, queued: true, jobId }, { status: 202 });
  } catch (error: any) {
    console.error('Error starting OCR extraction job:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
