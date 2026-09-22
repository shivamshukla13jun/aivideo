import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { OcrJob } from '@/models/OcrJob';

export const dynamic = 'force-dynamic';

// GET /api/ocr-jobs — recent OCR jobs for the dashboard (optionally ?chapterId=)
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const chapterId = req.nextUrl.searchParams.get('chapterId');

    const filter: any = {};
    if (chapterId) filter.chapterId = chapterId;

    const jobs = await OcrJob.find(filter).sort({ createdAt: -1 }).limit(20).lean();

    return NextResponse.json({ success: true, data: jobs });
  } catch (error: any) {
    console.error('Error listing OCR jobs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
