import { NextRequest, NextResponse } from 'next/server';
import { getChapterPages } from '@/lib/suwayomi';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json({ success: false, error: 'Invalid chapter id' }, { status: 400 });
    }

    // 1. Fetch live chapter pages from Suwayomi
    const { pages } = await getChapterPages(numericId);

    // 2. Fetch any locally edited pages or panels from MongoDB if exist
    let localPagesMap: Record<number, any> = {};
    try {
      await connectDB();
      const localPages = await Page.find({ chapterId: id, status: { $ne: 'deleted' } });
      localPages.forEach(lp => {
        localPagesMap[lp.order] = lp;
      });
    } catch {
      // Local db connection optional for reading Suwayomi pages
    }

    // 3. Construct unified page list
    const resultPages = pages.map((pageUrl, idx) => {
      const order = idx + 1;
      const local = localPagesMap[order];
      return {
        _id: local?._id ? String(local._id) : `${id}_page_${idx}`,
        chapterId: id,
        order,
        originalUrl: pageUrl,
        editedUrl: local?.editedUrl || pageUrl,
        panels: local?.panels || [],
        extractedText: local?.extractedText || '',
        extractedTextHi: local?.extractedTextHi || '',
        ocrProvider: local?.ocrProvider || '',
        status: local?.status || 'active',
      };
    });

    return NextResponse.json({
      success: true,
      data: resultPages,
      total: resultPages.length,
      source: 'suwayomi',
    });
  } catch (error: any) {
    console.error(`Error fetching pages for chapter ${params}:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
