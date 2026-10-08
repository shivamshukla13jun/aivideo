import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';
import { Scene } from '@/models/Scene';
import { getFileBuffer, uploadFile, deleteFile } from '@/lib/minio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/chapters/[id]/pages/[pageId]/split — split a page image into two
 * pages at a horizontal cut line. Body: { cutAt: 0..1 } (fraction of height).
 * The top part keeps the existing Page doc; the bottom part becomes a new page
 * inserted at order+1 (later pages shift up). OCR text fields are cleared on
 * both halves so the pipeline re-extracts them. Scenes already built from the
 * page are repointed at the top part.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id: chapterId, pageId } = await params;
    const body = await req.json().catch(() => ({}));
    const cutAt = Number(body.cutAt);
    if (!Number.isFinite(cutAt) || cutAt < 0.05 || cutAt > 0.95) {
      return NextResponse.json(
        { success: false, error: 'cutAt must be a fraction between 0.05 and 0.95' },
        { status: 400 }
      );
    }

    await connectDB();
    const page = await Page.findById(pageId);
    if (!page || page.chapterId !== chapterId || page.status === 'deleted') {
      return NextResponse.json({ success: false, error: 'Page not found' }, { status: 404 });
    }

    const objectKey = page.publicId;
    if (!objectKey) {
      return NextResponse.json({ success: false, error: 'Page has no stored image' }, { status: 400 });
    }

    const buf = await getFileBuffer(objectKey);
    const meta = await sharp(buf).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    const cutY = Math.round(height * cutAt);
    if (cutY < 50 || height - cutY < 50) {
      return NextResponse.json(
        { success: false, error: 'Cut is too close to the edge — both parts must be at least 50px tall' },
        { status: 400 }
      );
    }

    const [topBuf, bottomBuf] = await Promise.all([
      sharp(buf).extract({ left: 0, top: 0, width, height: cutY }).png().toBuffer(),
      sharp(buf).extract({ left: 0, top: cutY, width, height: height - cutY }).png().toBuffer(),
    ]);

    const stamp = Date.now();
    const pad = String(page.order).padStart(4, '0');
    const keyA = `chapters/${chapterId}/pages/${pad}a-${stamp}.png`;
    const keyB = `chapters/${chapterId}/pages/${pad}b-${stamp}.png`;
    const [partA, partB] = await Promise.all([
      uploadFile(topBuf, keyA),
      uploadFile(bottomBuf, keyB),
    ]);

    // Shift later pages up one slot, then insert the new page at order+1
    await Page.updateMany(
      { chapterId, order: { $gt: page.order }, status: { $ne: 'deleted' } },
      { $inc: { order: 1 } }
    );

    const oldUrls = [page.originalUrl, page.editedUrl].filter((u): u is string => Boolean(u));

    // The existing page becomes the top half — clear OCR fields (now stale)
    page.originalUrl = partA.url;
    page.editedUrl = partA.url;
    page.publicId = keyA;
    page.processedKey = '';
    page.extractedText = '';
    page.extractedTextHi = '';
    page.ocrRaw = '';
    page.ocrProvider = '';
    await page.save();

    const bottom = await Page.create({
      chapterId,
      pageId: `${chapterId}_page_${page.order}b_${stamp}`,
      order: page.order + 1,
      originalUrl: partB.url,
      editedUrl: partB.url,
      publicId: keyB,
      panels: [],
      status: 'active',
    });

    // Scenes built from this page now show the top half
    if (oldUrls.length) {
      await Scene.updateMany(
        { chapterId, image: { $in: oldUrls } },
        { $set: { image: partA.url } }
      );
    }

    // Remove the original object — both halves replace it
    await deleteFile(objectKey).catch(() => {});

    return NextResponse.json({ success: true, data: { top: page, bottom } });
  } catch (error: any) {
    console.error('Page split error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
