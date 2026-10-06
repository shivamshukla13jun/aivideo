import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Scene } from '@/models/Scene';
import { Series } from '@/models/Series';

export const dynamic = 'force-dynamic';

interface SeoResult {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  categoryId: string;
}

function buildSeo(seriesTitle: string, chapter: any, narrations: string[], extraKeywords?: string): SeoResult {
  const title = `${seriesTitle} Chapter ${chapter.chapterNumber}: ${chapter.title} | Full Animated Webtoon`.slice(0, 100);
  const summary = narrations.join(' ').slice(0, 600);
  const extra = (extraKeywords || '').split(',').map((k) => k.trim()).filter(Boolean);
  const description = [
    `${seriesTitle} Chapter ${chapter.chapterNumber} - ${chapter.title}`,
    '',
    summary || 'Watch this webtoon chapter brought to life with animated panels and narration.',
    '',
    `Read more chapters and explore the full ${seriesTitle} series.`,
    '',
    '#webtoon #manhwa #manga #webtoonedit #animated',
  ].join('\n');
  const tags = [
    seriesTitle,
    `${seriesTitle} chapter ${chapter.chapterNumber}`,
    'webtoon',
    'manhwa',
    'manga',
    'webtoon animation',
    'webtoon dub',
    chapter.title,
    ...extra,
  ].filter(Boolean);
  return { title, description, tags, hashtags: ['#webtoon', '#manhwa', '#manga'], categoryId: '24' };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chapterId, extraKeywords } = body;
    if (!chapterId) {
      return NextResponse.json({ success: false, error: 'chapterId is required' }, { status: 400 });
    }

    await connectDB();
    const chapter = await Chapter.findById(chapterId).lean();
    if (!chapter) return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    const series = await Series.findById(chapter.seriesId).lean();
    const scenes = await Scene.find({ chapterId }).sort({ order: 1 }).lean();

    const seriesTitle = (series as any)?.title || 'Webtoon';
    const narrations = scenes.map((s: any) => s.narration).filter(Boolean) as string[];
    const data = buildSeo(seriesTitle, chapter, narrations, extraKeywords);

    return NextResponse.json({ success: true, data, source: 'auto' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
