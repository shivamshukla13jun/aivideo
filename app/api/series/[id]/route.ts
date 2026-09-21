import { NextRequest, NextResponse } from 'next/server';
import { getMangaDetails, mapSuwayomiMangaToSeries } from '@/lib/suwayomi';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json({ success: false, error: 'Invalid series id' }, { status: 400 });
    }

    const manga = await getMangaDetails(numericId);
    if (!manga) {
      return NextResponse.json({ success: false, error: 'Series not found in Suwayomi library' }, { status: 404 });
    }

    const mapped = mapSuwayomiMangaToSeries(manga);
    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error(`Error fetching series ${params} from Suwayomi:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
