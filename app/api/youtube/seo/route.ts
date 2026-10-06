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

function buildFallbackSeo(seriesTitle: string, chapter: any, narrations: string[], extraKeywords?: string): SeoResult {
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
    const fallback = buildFallbackSeo(seriesTitle, chapter, narrations, extraKeywords);

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ success: true, data: fallback, source: 'fallback' });
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const scriptSample = narrations.join('\n').slice(0, 4000);
      const prompt = `You are a YouTube SEO expert for webtoon/manga recap channels. Generate optimized metadata for this video as strict JSON.

Series: ${seriesTitle}
Chapter: ${chapter.chapterNumber} - ${chapter.title}
Scene count: ${scenes.length}
Narration/script sample:
${scriptSample || '(no script)'}
Extra keywords to include: ${extraKeywords || 'none'}

Return ONLY a JSON object, no markdown fences:
{
  "title": "high-CTR YouTube title under 100 chars with keywords like '${seriesTitle}', 'Chapter ${chapter.chapterNumber}', 'webtoon'",
  "description": "YouTube description: first 150 chars must contain the main keywords (they show in search). Then a short engaging summary, a call-to-action to subscribe, and 5 hashtags at the end.",
  "tags": ["15-25 SEO tags mixing broad (webtoon, manhwa recap) and specific terms"],
  "hashtags": ["5 hashtags"],
  "categoryId": "24"
}`;

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = (result.text || '').trim();
      const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(jsonStr);

      const data: SeoResult = {
        title: String(parsed.title || fallback.title).slice(0, 100),
        description: String(parsed.description || fallback.description).slice(0, 5000),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 50) : fallback.tags,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).slice(0, 15) : fallback.hashtags,
        categoryId: String(parsed.categoryId || '24'),
      };
      return NextResponse.json({ success: true, data, source: 'gemini' });
    } catch (aiErr: any) {
      console.warn('Gemini SEO generation failed, using fallback:', aiErr.message);
      return NextResponse.json({ success: true, data: fallback, source: 'fallback' });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
