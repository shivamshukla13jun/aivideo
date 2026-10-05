import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';

export const dynamic = 'force-dynamic';

// GET /api/chapters/[id]/pages — pages extracted from the uploaded CBZ (stored in MinIO)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const pages = await Page.find({ chapterId: id, status: { $ne: 'deleted' } }).sort({ order: 1 });
    return NextResponse.json({ success: true, data: pages, total: pages.length });
  } catch (error: any) {
    console.error('Error fetching pages:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
