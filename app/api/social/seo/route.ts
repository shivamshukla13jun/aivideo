import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Scene } from '@/models/Scene';
import { Series } from '@/models/Series';
import { generateAdvancedSeo, enhanceSeoWithAI } from '@/lib/social/seo';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chapterId, extraKeywords, isShort, useAI } = body;
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

    // Generate advanced SEO
    let seoResult = generateAdvancedSeo(
      scenes,
      seriesTitle,
      chapterNumber,
      chapterTitle,
      extraKeywords,
      Boolean(isShort)
    );

    // Optionally enhance with AI
    let source = 'algorithm';
    if (useAI !== false) {
      const narrations = scenes.map((s: any) => s.narration).filter(Boolean) as string[];
      const enhanced = await enhanceSeoWithAI(seoResult, narrations, seriesTitle, chapterNumber, chapterTitle);
      if (enhanced !== seoResult) {
        seoResult = enhanced;
        source = 'ai-enhanced';
      }
    }

    return NextResponse.json({ success: true, data: seoResult, source });
  } catch (error: any) {
    console.error('Advanced SEO error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
