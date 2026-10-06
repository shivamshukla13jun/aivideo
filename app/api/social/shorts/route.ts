import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Scene } from '@/models/Scene';
import { Series } from '@/models/Series';
import { generateShortClips, platformMaxDuration } from '@/lib/social/shorts';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chapterId, platforms, maxDurationSec } = body;
    if (!chapterId) {
      return NextResponse.json({ success: false, error: 'chapterId is required' }, { status: 400 });
    }

    await connectDB();
    const chapter = await Chapter.findById(chapterId).lean();
    if (!chapter) return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    const series = await Series.findById(chapter.seriesId).lean();
    const scenes = await Scene.find({ chapterId }).sort({ order: 1 }).lean();

    const seriesTitle = (series as any)?.title || 'Webtoon';
    const chapterNumber = (chapter as any).chapterNumber || 1;
    const chapterTitle = (chapter as any).title || 'Chapter';

    const maxDur = maxDurationSec || platformMaxDuration(platforms || ['youtube']);
    const clips = generateShortClips(scenes, seriesTitle, chapterNumber, chapterTitle, maxDur);

    return NextResponse.json({
      success: true,
      data: {
        clips,
        maxDurationSec: maxDur,
        totalScenes: scenes.length,
      },
    });
  } catch (error: any) {
    console.error('Shorts generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
