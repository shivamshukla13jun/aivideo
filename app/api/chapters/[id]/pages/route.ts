import { NextRequest, NextResponse } from 'next/server';
import { getChapterPages } from '@/lib/suwayomi';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    // 1. Fetch pages from MongoDB (works for both local chapters and edited Suwayomi chapters)
    const localPages = await Page.find({ chapterId: id, status: { $ne: 'deleted' } })
      .sort({ order: 1 })
      .lean();

    if (localPages.length > 0) {
      const result = localPages.map((lp: any) => ({
        _id: String(lp._id),
        chapterId: id,
        order: lp.order,
        originalUrl: lp.originalUrl,
        editedUrl: lp.editedUrl || lp.originalUrl,
        panels: lp.panels || [],
        extractedText: lp.extractedText || '',
        extractedTextHi: lp.extractedTextHi || '',
        ocrProvider: lp.ocrProvider || '',
        isSplitPart: Boolean(lp.isSplitPart),
        status: lp.status || 'active',
      }));

      return NextResponse.json({
        success: true,
        data: result,
        total: result.length,
        source: 'mongodb',
      });
    }

    // 2. If no local pages, try Suwayomi if numeric ID
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      try {
        const { pages } = await getChapterPages(numericId);
        const resultPages = pages.map((pageUrl, idx) => ({
          _id: `${id}_page_${idx}`,
          chapterId: id,
          order: idx + 1,
          originalUrl: pageUrl,
          editedUrl: pageUrl,
          panels: [],
          extractedText: '',
          extractedTextHi: '',
          ocrProvider: '',
          status: 'active',
        }));

        return NextResponse.json({
          success: true,
          data: resultPages,
          total: resultPages.length,
          source: 'suwayomi',
        });
      } catch (suwaErr: any) {
        console.warn('Suwayomi pages fetch failed:', suwaErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
    });
  } catch (error: any) {
    console.error(`Error fetching pages for chapter:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
