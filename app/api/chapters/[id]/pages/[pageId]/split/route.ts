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
 *   { regions: [{x, y, w, h, script?}, …] } — each marked RECT (fractions of
 *   image width/height, 0..1) becomes its own page in top→bottom order.
 *   Unmarked parts are removed. Crops are extracted at original resolution
 *   and saved as lossless PNG — no quality loss.
 *   Legacy: {start,end} regions mean full-width bands; {cutAt} splits in two.
 *
 *   A region's `script` text is stored as the new page's English narration
 *   (`ocrProvider='script'` so the extract stage skips it; translate still runs).
 *
 * The first part keeps the existing Page doc; the rest are inserted right
 * after it (later page orders shift). Scenes built from the old page are
 * repointed at the first part; the original object is deleted.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id: chapterId, pageId } = await params;
    const body = await req.json().catch(() => ({}));

    type Rect = { x: number; y: number; w: number; h: number; script: string };
    let regions: Rect[];
    if (Array.isArray(body.regions)) {
      regions = body.regions
        .map((r: any) => {
          // Rect form {x,y,w,h} or legacy band form {start,end}
          const isRect = r.x !== undefined || r.w !== undefined;
          const x = clamp01(Number(isRect ? r.x : 0));
          const y = clamp01(Number(isRect ? r.y : r.start));
          const w = isRect ? clamp01(Number(r.w)) : 1;
          const h = isRect ? clamp01(Number(r.h)) : clamp01(Number(r.end) - Number(r.start));
          return {
            x,
            y,
            w: Math.min(w, 1 - x),
            h: Math.min(h, 1 - y),
            script: typeof r.script === 'string' ? r.script.trim() : '',
          };
        })
        .filter((r: Rect) => r.w >= 0.02 && r.h >= 0.01)
        .sort((a: Rect, b: Rect) => a.y - b.y || a.x - b.x);
    } else if (Number.isFinite(Number(body.cutAt))) {
      const c = clamp01(Number(body.cutAt));
      if (c < 0.05 || c > 0.95) {
        return NextResponse.json(
          { success: false, error: 'cutAt must be a fraction between 0.05 and 0.95' },
          { status: 400 }
        );
      }
      regions = [
        { x: 0, y: 0, w: 1, h: c, script: '' },
        { x: 0, y: c, w: 1, h: 1 - c, script: '' },
      ];
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide regions: [{x, y, w, h, script?}, …] or cutAt' },
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

    // Slice every rect → PNG buffers (extract at native resolution — no resampling)
    const parts = [];
    for (const r of regions) {
      const left = Math.round(r.x * width);
      const top = Math.round(r.y * height);
      const w = Math.min(width - left, Math.max(1, Math.round(r.w * width)));
      const h = Math.min(height - top, Math.max(1, Math.round(r.h * height)));
      if (w < 40 || h < 40) {
        return NextResponse.json(
          { success: false, error: 'A selected part is too small — each crop must be at least 40×40px' },
          { status: 400 }
        );
      }
      parts.push(await sharp(buf).extract({ left, top, width: w, height: h }).png().toBuffer());
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

    // First part keeps the existing doc. A part with a script keeps that text
    // (marked 'script' so extract skips it); otherwise OCR is cleared → re-runs.
    page.originalUrl = uploads[0].url;
    page.editedUrl = uploads[0].url;
    page.publicId = `chapters/${chapterId}/pages/${pad}a-${stamp}.png`;
    page.processedKey = '';
    page.extractedText = regions[0].script;
    page.extractedTextHi = '';
    page.ocrRaw = '';
    page.ocrProvider = regions[0].script ? 'script' : '';
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
          extractedText: regions[i].script || '',
          ocrProvider: regions[i].script ? 'script' : '',
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
