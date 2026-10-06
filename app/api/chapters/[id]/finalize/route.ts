import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Page } from '@/models/Page';
import { Series } from '@/models/Series';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chapters/[id]/finalize — mark chapter as ready after all pages uploaded.
 * Verifies pages are sequential (1..N with no gaps or duplicates) before marking ready.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    }

    const pages = await Page.find({ chapterId: id, status: { $ne: 'deleted' } })
      .sort({ order: 1 })
      .lean();

    if (pages.length === 0) {
      return NextResponse.json({ success: false, error: 'No pages uploaded yet' }, { status: 400 });
    }

    // Verify orders are sequential 1..N — no gaps, no duplicates
    const orders = pages.map((p) => p.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      return NextResponse.json(
        { success: false, error: `Duplicate page orders detected: ${orders.join(', ')}` },
        { status: 400 }
      );
    }
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        return NextResponse.json(
          { success: false, error: `Page order gap: expected ${i + 1}, got ${orders[i]}` },
          { status: 400 }
        );
      }
    }

    chapter.status = 'ready';
    await chapter.save();

    // Ensure chapter is in the series' chapters array
    await Series.findByIdAndUpdate(chapter.seriesId, {
      $addToSet: { chapters: chapter._id },
    });

    return NextResponse.json({ success: true, data: { chapter, pageCount: pages.length } });
  } catch (error: any) {
    console.error('Error finalizing chapter:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
