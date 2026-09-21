import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Scene } from '@/models/Scene';
import { Chapter } from '@/models/Chapter';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get('chapterId');
    await connectDB();
    const query = chapterId ? { chapterId } : {};
    const scenes = await Scene.find(query).sort({ order: 1 });
    return NextResponse.json({ success: true, data: scenes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await connectDB();

    // Clean narration: if missing or generic placeholder, try to load page's extractedText or keep empty
    if (!body.narration || body.narration.startsWith('Narration for Page')) {
      const { Page } = await import('@/models/Page');
      let pageDoc: any = null;
      if (body.pageId) {
        pageDoc = await Page.findOne({
          chapterId: body.chapterId,
          $or: [{ _id: body.pageId.length === 24 ? body.pageId : undefined }, { order: body.order }],
        });
      }
      body.narration = pageDoc?.extractedText || '';
    }

    const scene = await Scene.create(body);

    if (body.chapterId && body.chapterId.length === 24) {
      try {
        await Chapter.findByIdAndUpdate(body.chapterId, {
          $push: { scenes: scene._id },
        });
      } catch {
        // Ignored for external/Suwayomi chapters
      }
    }

    return NextResponse.json({ success: true, data: scene });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
