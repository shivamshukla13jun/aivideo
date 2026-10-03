import { NextRequest, NextResponse } from 'next/server';
import { getChapterDetails, mapSuwayomiChapter } from '@/lib/suwayomi';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Scene } from '@/models/Scene';
import { VideoProject } from '@/models/VideoProject';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    // 1. Check if it is a local MongoDB chapter
    if (mongoose.isValidObjectId(id)) {
      const localChapter = await Chapter.findById(id).lean();
      if (localChapter) {
        const scenes = await Scene.find({ chapterId: id }).sort({ order: 1 }).lean();
        const project = await VideoProject.findOne({ chapterId: id }).lean();

        return NextResponse.json({
          success: true,
          data: {
            ...localChapter,
            _id: String(localChapter._id),
            seriesId: String(localChapter.seriesId),
            scenes,
            audioTrack: localChapter.audioTrack || project?.audioTrack || null,
            source: 'local',
          },
        });
      }
    }

    // 2. Fall back to Suwayomi server if numeric ID
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      try {
        const chap = await getChapterDetails(numericId);
        if (chap) {
          let scenes: any[] = [];
          let audioTrack = null;
          try {
            scenes = await Scene.find({ chapterId: id }).sort({ order: 1 }).lean();
            const project = await VideoProject.findOne({ chapterId: id }).lean();
            audioTrack = project?.audioTrack || null;
          } catch {}

          const mapped = {
            ...mapSuwayomiChapter(chap, ''),
            scenes,
            audioTrack,
            source: 'suwayomi',
          };
          return NextResponse.json({ success: true, data: mapped });
        }
      } catch (suwaErr: any) {
        console.warn('Suwayomi chapter lookup failed:', suwaErr?.message);
      }
    }

    return NextResponse.json(
      { success: false, error: 'Chapter not found' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error(`Error fetching chapter ${params}:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await connectDB();

    if (mongoose.isValidObjectId(id)) {
      const updated = await Chapter.findByIdAndUpdate(id, { $set: body }, { new: true });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: true, message: 'Updated' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
