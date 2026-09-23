import { NextRequest, NextResponse } from 'next/server';
import { getLibraryMangas, mapSuwayomiMangaToSeries } from '@/lib/suwayomi';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const suwayomiMangas = await getLibraryMangas();
    const mappedSeries = suwayomiMangas.map(mapSuwayomiMangaToSeries);
    return NextResponse.json({
      success: true,
      data: mappedSeries,
      total: mappedSeries.length,
      source: 'suwayomi',
    });
  } catch (error: any) {
    console.error('Error fetching series from Suwayomi:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Could not connect to Suwayomi Server at port {SUWAYOMI_URL}: ${error.message}`,
        data: [],
      },
      { status: 500 }
    );
  }
}
