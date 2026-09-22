import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { OcrJob } from '@/models/OcrJob';
import { getChapterDetails, getMangaDetails } from '@/lib/suwayomi';
import { publishOcrJob } from '@/lib/queue';
import { runOcrJob } from '@/lib/ocrJob';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chapterId } = await params;
    const numericId = parseInt(chapterId, 10);

    if (isNaN(numericId)) {
      return NextResponse.json({ success: false, error: 'Invalid chapter id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const targetOrders: number[] | null = Array.isArray(body.orders) ? body.orders : null;

    await connectDB();

    // Resolve series/chapter names for the dashboard job card
    let seriesId = '';
    let seriesTitle = '';
    let chapterName = `Chapter ${chapterId}`;
    try {
      const chap = await getChapterDetails(numericId);
      if (chap) {
        chapterName = chap.name || chapterName;
        seriesId = String(chap.mangaId || '');
        if (chap.mangaId != null) {
          const manga = await getMangaDetails(chap.mangaId);
          seriesTitle = manga?.title || '';
        }
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
