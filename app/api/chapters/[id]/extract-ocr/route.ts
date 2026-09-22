import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';
import { Scene } from '@/models/Scene';
import { getChapterPages, resolveSuwayomiInternalUrl } from '@/lib/suwayomi';
import { extractTextFromImage } from '@/lib/ocr';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chapterId } = await params;
    const numericId = parseInt(chapterId, 10);

    if (isNaN(numericId)) {
      return NextResponse.json({ success: false, error: 'Invalid chapter id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const targetPageOrders: number[] | null = Array.isArray(body.orders) ? body.orders : null;

    // 1. Fetch live chapter pages from Suwayomi
    const { pages } = await getChapterPages(numericId);
    await connectDB();

    const results: { order: number; extractedText: string }[] = [];

    for (let idx = 0; idx < pages.length; idx++) {
      const order = idx + 1;

      // If specific orders requested, filter
      if (targetPageOrders && !targetPageOrders.includes(order)) {
        continue;
      }

      const pageUrl = pages[idx];
      let pageDoc = await Page.findOne({ chapterId, order });

      // If already extracted and not forcing, keep existing
      if (pageDoc?.extractedText && !body.force) {
        results.push({ order, extractedText: pageDoc.extractedText });
        continue;
      }

      // Extract text via OCR
      let extractedText = '';
      try {
        extractedText = await extractTextFromImage(resolveSuwayomiInternalUrl(pageUrl));
      } catch (ocrErr) {
        console.warn(`OCR failed for chapter ${chapterId} page ${order}, keeping empty:`, ocrErr);
        extractedText = '';
      }

      // Upsert Page in MongoDB
      if (!pageDoc) {
        pageDoc = await Page.create({
          chapterId,
          order,
          originalUrl: pageUrl,
          editedUrl: pageUrl,
          extractedText: extractedText || '',
          panels: [],
          status: 'active',
        });
      } else {
        pageDoc.extractedText = extractedText || '';
        await pageDoc.save();
      }

      // If any existing scene has generic "Narration for Page..." or empty narration, update it
      const pageIdStr = `${chapterId}_page_${idx}`;
      const existingScenes = await Scene.find({
        chapterId,
        $or: [
          { pageId: pageIdStr },
          { pageId: String(pageDoc._id) },
          { order: order },
        ],
      });

      for (const scene of existingScenes) {
        if (!scene.narration || scene.narration.startsWith('Narration for Page')) {
          scene.narration = extractedText || '';
          await scene.save();
        }
      }

      results.push({ order, extractedText: extractedText || '' });
    }

    return NextResponse.json({
      success: true,
      data: results,
      total: results.length,
    });
  } catch (error: any) {
    console.error('Error in batch OCR extraction:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
