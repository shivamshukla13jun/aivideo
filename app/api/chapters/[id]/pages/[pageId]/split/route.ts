import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';
import { Scene } from '@/models/Scene';
import { getFileBuffer, uploadFile, deleteFile } from '@/lib/minio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * POST /api/chapters/[id]/pages/[pageId]/split — cut a page into pieces.
 *
 * Body:
 *   { regions: [{start, end}, …] }  — each marked part (fractions of height,
 *   0..1) becomes its own page in order; unmarked parts are removed.
 *   { cutAt: 0..1 }                 — legacy single cut → top + bottom halves.
 *
 * The first part keeps the existing Page doc; the rest are inserted right
 * after it (later page orders shift). OCR fields are cleared on every new
 * page so the extract stage re-runs on them. Scenes built from the old page
 * are repointed at the first part; the original object is deleted.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id: chapterId, pageId } = await params;
    const body = await req.json().catch(() => ({}));

    // Normalize input → ordered region list
    let regions: { start: number; end: number }[];
    if (Array.isArray(body.regions)) {
      regions = body.regions
        .map((r: any) => ({ start: clamp01(Number(r.start)), end: clamp01(Number(r.end)) }))
        .filter((r: any) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end - r.start >= 0.02)
        .sort((a: any, b: any) => a.start - b.start);
    } else if (Number.isFinite(Number(body.cutAt))) {
      const c = clamp01(Number(body.cutAt));
      if (c < 0.05 || c > 0.95) {
        return NextResponse.json(
          { success: false, error: 'cutAt must be a fraction between 0.05 and 0.95' },
          { status: 400 }
        );
      }
      regions = [
        { start: 0, end: c },
        { start: c, end: 1 },
      ];
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide regions: [{start, end}, …] or cutAt' },
        { status: 400 }
      );
    }
    if (!regions.length) {
      return NextResponse.json({ success: false, error: 'No regions to keep' }, { status: 400 });
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

    // Slice every region → PNG buffers
    const parts = [];
    for (const r of regions) {
      const top = Math.floor(r.start * height);
      const bottom = Math.min(height, Math.ceil(r.end * height));
      if (bottom - top < 50) {
        return NextResponse.json(
          { success: false, error: 'A selected part is too thin — every part must be at least 50px tall' },
          { status: 400 }
        );
      }
      parts.push(await sharp(buf).extract({ left: 0, top, width, height: bottom - top }).png().toBuffer());
    }

    // Upload parts, make room: shift later pages by (regions - 1)
    const stamp = Date.now();
    const pad = String(page.order).padStart(4, '0');
    const suffixes = 'abcdefghijklmnopqrstuvwxyz';
    const uploads = await Promise.all(
      parts.map((b, i) =>
        uploadFile(b, `chapters/${chapterId}/pages/${pad}${suffixes[i] || `x${i}`}-${stamp}.png`)
      )
    );

    const extra = parts.length - 1;
    if (extra > 0) {
      await Page.updateMany(
        { chapterId, order: { $gt: page.order }, status: { $ne: 'deleted' } },
        { $inc: { order: extra } }
      );
    }

    const oldUrls = [page.originalUrl, page.editedUrl].filter((u): u is string => Boolean(u));

    // First part keeps the existing doc; OCR cleared (image changed)
    page.originalUrl = uploads[0].url;
    page.editedUrl = uploads[0].url;
    page.publicId = `chapters/${chapterId}/pages/${pad}a-${stamp}.png`;
    page.processedKey = '';
    page.extractedText = '';
    page.extractedTextHi = '';
    page.ocrRaw = '';
    page.ocrProvider = '';
    await page.save();

    const created = [];
    for (let i = 1; i < parts.length; i++) {
      created.push(
        await Page.create({
          chapterId,
          pageId: `${chapterId}_page_${page.order}${suffixes[i] || `x${i}`}_${stamp}`,
          order: page.order + i,
          originalUrl: uploads[i].url,
          editedUrl: uploads[i].url,
          publicId: `chapters/${chapterId}/pages/${pad}${suffixes[i] || `x${i}`}-${stamp}.png`,
          panels: [],
          status: 'active',
        })
      );
    }

    // Scenes built from this page now show the first part
    if (oldUrls.length) {
      await Scene.updateMany(
        { chapterId, image: { $in: oldUrls } },
        { $set: { image: uploads[0].url } }
      );
    }

    await deleteFile(objectKey).catch(() => {});

    return NextResponse.json({ success: true, data: { first: page, created, removed: true } });
  } catch (error: any) {
    console.error('Page split error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
