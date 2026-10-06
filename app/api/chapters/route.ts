import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Series } from '@/models/Series';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/chapters?seriesId= — chapters stored in MongoDB
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seriesId = searchParams.get('seriesId');

    await connectDB();
    const query = seriesId ? { seriesId } : {};
    const chapters = await Chapter.find(query).sort({ chapterNumber: 1 });
    return NextResponse.json({ success: true, data: chapters, total: chapters.length });
  } catch (error: any) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/chapters — create a chapter (JSON body, no file).
 * Pages are uploaded separately via POST /api/chapters/[id]/pages.
 * Body: { seriesId, chapterNumber, title? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seriesId, chapterNumber, title } = body;

    if (!seriesId || !mongoose.Types.ObjectId.isValid(seriesId)) {
      return NextResponse.json({ success: false, error: 'Valid seriesId is required' }, { status: 400 });
    }
    const num = parseFloat(chapterNumber);
    if (!Number.isFinite(num)) {
      return NextResponse.json({ success: false, error: 'chapterNumber is required' }, { status: 400 });
    }

    await connectDB();
    const series = await Series.findById(seriesId);
    if (!series) {
      return NextResponse.json({ success: false, error: 'Series not found' }, { status: 404 });
    }

    const chapter = await Chapter.create({
      seriesId: series._id,
      chapterNumber: num,
      title: title?.trim() || `Chapter ${num}`,
      pages: [],
      scenes: [],
      status: 'processing',
    });

    return NextResponse.json({ success: true, data: chapter }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating chapter:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
