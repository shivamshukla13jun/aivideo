import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { OcrJob } from '@/models/OcrJob';
import { Chapter } from '@/models/Chapter';
import { Series } from '@/models/Series';
import { Page } from '@/models/Page';
import { publishOcrJob } from '@/lib/queue';
import { runOcrJob } from '@/lib/ocrJob';

export const dynamic = 'force-dynamic';

const NOT_EMPTY = /\S/;
const EMPTY = { $in: [null, ''] };

/**
 * POST /api/chapters/[id]/pipeline — enqueue the full image pipeline:
 * preprocess → extract (OCR→EN) → translate (EN→HI).
 * Jobs land on the shared queue whose worker runs one at a time, so the
 * stages execute back-to-back. Stages already queued/running are not
 * duplicated. Body: { overwrite?: boolean } — re-run every stage on all pages.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chapterId } = await params;
    const body = await req.json().catch(() => ({}));
    const overwrite = Boolean(body.overwrite);

    await connectDB();

    const base = { chapterId, status: { $ne: 'deleted' as const } };
    const [allPages, unprocessed, unextracted, hasText, textPending] = await Promise.all([
      Page.countDocuments(base),
      Page.countDocuments({ ...base, processedKey: EMPTY }),
      Page.countDocuments({ ...base, ocrProvider: EMPTY }),
      Page.countDocuments({ ...base, extractedText: { $regex: NOT_EMPTY } }),
      Page.countDocuments({ ...base, extractedText: { $regex: NOT_EMPTY }, extractedTextHi: EMPTY }),
    ]);
    if (allPages === 0) {
      return NextResponse.json(
        { success: false, error: 'No pages found — upload a CBZ first' },
        { status: 404 }
      );
    }

    // Translate's total is an estimate at enqueue time: pages already pending
    // plus pages the extract stage is about to OCR (may end up with no text).
    const totals: Record<string, number> = {
      preprocess: overwrite ? allPages : unprocessed,
      extract: overwrite ? allPages : unextracted,
      translate: overwrite ? hasText : textPending + (overwrite ? 0 : unextracted),
    };

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

    const jobIds: string[] = [];
    const newJobIds: string[] = [];
    const created: string[] = [];
    for (const stage of ['preprocess', 'extract', 'translate'] as const) {
      // Don't stack duplicates — reuse the active job for this stage.
      const active = await OcrJob.findOne({
        chapterId,
        stage,
        status: { $in: ['queued', 'running'] },
      }).lean();
      if (active) {
        jobIds.push((active as any).jobId);
        continue;
      }

      const jobId = `ocr_${chapterId}_${Date.now()}_${stage}`;
      await OcrJob.create({
        jobId,
        chapterId,
        seriesId,
        seriesTitle,
        chapterName,
        provider: stage === 'translate' ? 'ai' : 'paddle',
        stage,
        overwriteScenes: overwrite,
        status: 'queued',
        totalPages: totals[stage],
        donePages: 0,
        failedOrders: [],
      });
      jobIds.push(jobId);
      newJobIds.push(jobId);
      created.push(stage);
      await new Promise((r) => setTimeout(r, 1)); // keep ids unique
    }

    // Only publish jobs this request created — reused active jobs already have
    // a queue entry, and republishing would run them twice.
    const failedIds: string[] = [];
    for (const jobId of newJobIds) {
      if (!(await publishOcrJob(jobId))) failedIds.push(jobId);
    }

    if (failedIds.length) {
      // Broker unreachable — run only the jobs that couldn't be queued,
      // sequentially and in pipeline order.
      const results = [];
      for (const jobId of failedIds) results.push(await runOcrJob(jobId));
      return NextResponse.json({
        success: true,
        queued: newJobIds.length - failedIds.length,
        jobIds,
        results,
      });
    }

    return NextResponse.json({ success: true, queued: true, jobIds, created }, { status: 202 });
  } catch (error: any) {
    console.error('Error starting pipeline:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
