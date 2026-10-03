import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';
import { Chapter } from '@/models/Chapter';
import { getChapterPages } from '@/lib/suwayomi';
import { splitTallImageMihon, isTallImage } from '@/lib/mihonSplitter';
import { uploadBufferToBucket } from '@/lib/bucket';
import sharp from 'sharp';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    // 1. Determine whether this is a numeric Suwayomi chapter or a local MongoDB chapter
    const numericId = parseInt(id, 10);
    const isNumeric = !isNaN(numericId);

    let rawPages: { originalUrl: string; order: number; _id?: string }[] = [];

    // Check MongoDB pages first by chapterId
    let existingDbPages = await Page.find({ chapterId: id, status: { $ne: 'deleted' } }).sort({ order: 1 });

    // Also check chapter document's referenced pages if valid ObjectId
    if (existingDbPages.length === 0 && mongoose.isValidObjectId(id)) {
      try {
        const chap = await Chapter.findById(id).populate('pages');
        if (chap && chap.pages && chap.pages.length > 0) {
          existingDbPages = (chap.pages as any[]).filter((p) => p && p.status !== 'deleted');
        }
      } catch {}
    }

    if (existingDbPages.length > 0) {
      rawPages = existingDbPages.map((p) => ({
        originalUrl: p.editedUrl || p.originalUrl,
        order: p.order,
        _id: String(p._id),
      }));
    } else if (isNumeric) {
      // Fetch pages from Suwayomi server if numeric ID and not already in MongoDB
      try {
        const suwaRes = await getChapterPages(numericId);
        rawPages = (suwaRes.pages || []).map((url, idx) => ({
          originalUrl: url,
          order: idx + 1,
        }));
      } catch (suwaErr: any) {
        const isTimeout = suwaErr?.name === 'TimeoutError' || suwaErr?.message?.includes('timeout');
        return NextResponse.json(
          {
            success: false,
            error: isTimeout
              ? 'Suwayomi server timed out while fetching chapter pages. Please ensure Suwayomi is responsive.'
              : 'Could not connect to Suwayomi server. Please check your connection.',
          },
          { status: isTimeout ? 504 : 503 }
        );
      }
    }

    if (rawPages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No pages found for this chapter to split' },
        { status: 404 }
      );
    }

    const newPageList: any[] = [];
    let splitCount = 0;
    let nextOrder = 1;

    // 2. Iterate through each page, detect tall webtoon strips, and split if needed
    for (let i = 0; i < rawPages.length; i++) {
      const page = rawPages[i];
      let imgBuffer: Buffer | null = null;

      try {
        let fetchUrl = page.originalUrl;
        if (fetchUrl.startsWith('/api/bucket/')) {
          const fileId = fetchUrl.replace('/api/bucket/', '');
          const { getBucketFileStream } = await import('@/lib/bucket');
          const { stream } = await getBucketFileStream(fileId);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          imgBuffer = Buffer.concat(chunks);
        } else {
          if (!/^https?:\/\//i.test(fetchUrl)) {
            const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
            fetchUrl = `${base}${fetchUrl.startsWith('/') ? '' : '/'}${fetchUrl}`;
          }
          const imgRes = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
          if (imgRes.ok) {
            const ab = await imgRes.arrayBuffer();
            imgBuffer = Buffer.from(ab);
          }
        }
      } catch {
        // Silently continue if an individual remote image fails to download
      }

      if (!imgBuffer) {
        newPageList.push({
          chapterId: id,
          order: nextOrder++,
          originalUrl: page.originalUrl,
          status: 'active',
        });
        continue;
      }

      const meta = await sharp(imgBuffer).metadata();
      const w = meta.width || 0;
      const h = meta.height || 0;

      if (isTallImage(w, h)) {
        const slices = await splitTallImageMihon(imgBuffer, 'jpeg');
        if (slices.length > 1) {
          splitCount++;
          for (let sIdx = 0; sIdx < slices.length; sIdx++) {
            const slice = slices[sIdx];
            const filename = `ch_${id}_p${page.order}_part${sIdx + 1}.jpg`;
            const uploadRes = await uploadBufferToBucket(
              slice.buffer,
              filename,
              'image/jpeg',
              {
                chapterId: id,
                originalPageOrder: page.order,
                partIndex: sIdx + 1,
                totalParts: slices.length,
                isSplit: true,
              }
            );

            newPageList.push({
              chapterId: id,
              order: nextOrder++,
              originalUrl: uploadRes.url,
              isSplitPart: true,
              sourcePageId: page._id || `${id}_p${page.order}`,
              status: 'active',
            });
          }
          continue;
        }
      }

      newPageList.push({
        chapterId: id,
        order: nextOrder++,
        originalUrl: page.originalUrl,
        status: 'active',
      });
    }

    // 3. Update MongoDB
    await Page.deleteMany({ chapterId: id });
    const insertedPages = await Page.insertMany(newPageList);

    if (!isNumeric) {
      await Chapter.findByIdAndUpdate(id, {
        pages: insertedPages.map((p) => p._id),
      });
    }

    return NextResponse.json({
      success: true,
      splitCount,
      originalPagesCount: rawPages.length,
      newPagesCount: insertedPages.length,
      data: insertedPages,
    });
  } catch (error: any) {
    console.error('Error during Mihon tall image splitting:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to split tall images' },
      { status: 500 }
    );
  }
}
