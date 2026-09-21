import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';
import { Chapter } from '@/models/Chapter';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chapterId } = await params;
    const body = await req.json();
    const { pageIds } = body; // Array of page IDs in new order

    await connectDB();
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    }

    // Update order for each page
    for (let i = 0; i < pageIds.length; i++) {
      await Page.findByIdAndUpdate(pageIds[i], { order: i + 1 });
    }

    chapter.pages = pageIds;
    await chapter.save();

    const updatedPages = await Page.find({ chapterId }).sort({ order: 1 });
    return NextResponse.json({ success: true, data: updatedPages });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
