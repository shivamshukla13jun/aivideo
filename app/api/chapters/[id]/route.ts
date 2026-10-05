import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Scene } from '@/models/Scene';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    }

    const scenes = await Scene.find({ chapterId: id }).sort({ order: 1 });
    return NextResponse.json({ success: true, data: { ...chapter.toObject(), scenes } });
  } catch (error: any) {
    console.error('Error fetching chapter:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
