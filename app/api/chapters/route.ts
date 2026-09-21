import { NextRequest, NextResponse } from 'next/server';
import { getMangaChapters, mapSuwayomiChapter } from '@/lib/suwayomi';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seriesId = searchParams.get('seriesId');

    if (!seriesId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const numericSeriesId = parseInt(seriesId, 10);
    if (isNaN(numericSeriesId)) {
      return NextResponse.json({ success: false, error: 'Invalid seriesId' }, { status: 400 });
    }

    const suwayomiChapters = await getMangaChapters(numericSeriesId);
    const mapped = suwayomiChapters.map(chap => mapSuwayomiChapter(chap, seriesId));

    return NextResponse.json({
      success: true,
      data: mapped,
      total: mapped.length,
    });
  } catch (error: any) {
    console.error('Error fetching chapters from Suwayomi:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
