import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { YouTubeUpload } from '@/models/YouTubeUpload';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const chapterId = req.nextUrl.searchParams.get('chapterId');
    const filter: any = {};
    if (chapterId) filter.chapterId = chapterId;
    const uploads = await YouTubeUpload.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({ success: true, data: uploads });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
