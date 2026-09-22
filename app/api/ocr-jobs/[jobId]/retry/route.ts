import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { OcrJob } from '@/models/OcrJob';
import { publishOcrJob } from '@/lib/queue';
import { runOcrJob } from '@/lib/ocrJob';

export const dynamic = 'force-dynamic';

// POST /api/ocr-jobs/:jobId/retry — requeue a failed job (only failed pages are reprocessed)
export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    await connectDB();

    const job = await OcrJob.findOne({ jobId });
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    if (job.status === 'running' || job.status === 'queued') {
      return NextResponse.json({ success: false, error: `Job is already ${job.status}` }, { status: 409 });
    }

    job.status = 'queued';
    job.error = '';
    await job.save();

    const queued = await publishOcrJob(jobId);
    if (!queued) {
      const result = await runOcrJob(jobId);
      return NextResponse.json({ success: true, queued: false, jobId, ...result });
    }

    return NextResponse.json({ success: true, queued: true, jobId }, { status: 202 });
  } catch (error: any) {
    console.error('Error retrying OCR job:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
