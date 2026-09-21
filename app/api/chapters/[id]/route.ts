import { NextRequest, NextResponse } from 'next/server';
import { getChapterDetails, mapSuwayomiChapter } from '@/lib/suwayomi';
import { connectDB } from '@/lib/mongodb';
import { Scene } from '@/models/Scene';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json({ success: false, error: 'Invalid chapter id' }, { status: 400 });
    }

    const chap = await getChapterDetails(numericId);
    if (!chap) {
      return NextResponse.json({ success: false, error: 'Chapter not found in Suwayomi' }, { status: 404 });
    }

    let scenes: any[] = [];
    try {
      await connectDB();
      scenes = await Scene.find({ chapterId: id }).sort({ order: 1 });
    } catch (dbErr) {
      console.warn('Could not fetch scenes from DB:', dbErr);
    }

    const mapped = {
      ...mapSuwayomiChapter(chap, ''),
      scenes,
    };

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error(`Error fetching chapter ${params} from Suwayomi:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
