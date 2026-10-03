import { NextRequest, NextResponse } from 'next/server';
import { getMangaDetails, mapSuwayomiMangaToSeries } from '@/lib/suwayomi';
import { connectDB } from '@/lib/mongodb';
import { Series } from '@/models/Series';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 1. Check if it is a MongoDB ObjectId or local series in DB
    try {
      await connectDB();
      if (mongoose.isValidObjectId(id)) {
        const localSeries = await Series.findById(id).lean();
        if (localSeries) {
          return NextResponse.json({
            success: true,
            data: {
              ...localSeries,
              _id: String(localSeries._id),
              source: 'local',
              totalChapters: localSeries.chapters?.length || 0,
            },
          });
        }
      }
    } catch (dbErr) {
      console.warn('DB lookup error for series:', dbErr);
    }

    // 2. Fall back to Suwayomi server if numeric ID
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      try {
        const manga = await getMangaDetails(numericId);
        if (manga) {
          const mapped = mapSuwayomiMangaToSeries(manga);
          return NextResponse.json({ success: true, data: mapped });
        }
      } catch (suwaErr: any) {
        console.warn('Suwayomi lookup failed:', suwaErr?.message);
      }
    }

    return NextResponse.json(
      { success: false, error: 'Series not found in local library or Suwayomi' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error fetching series details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
