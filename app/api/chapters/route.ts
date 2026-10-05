import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Series } from '@/models/Series';
import { Page } from '@/models/Page';
import { parseUpload } from '@/lib/upload';
import { storeChapterArchive } from '@/lib/cbz';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
 * POST /api/chapters — upload a chapter as a .cbz (ZIP of page images).
 * Multipart fields: cbz (file), seriesId, chapterNumber, title?
 * The archive is stored in MinIO, images are extracted to MinIO page
 * objects, and Chapter + Page documents are created in MongoDB.
 */
export async function POST(req: NextRequest) {
  let chapterId: mongoose.Types.ObjectId | null = null;
  try {
    const { file, fields } = await parseUpload(req, 'cbz');
    if (!file) {
      return NextResponse.json({ success: false, error: 'No .cbz file uploaded (field "cbz")' }, { status: 400 });
    }
    if (!fields.seriesId || !mongoose.Types.ObjectId.isValid(fields.seriesId)) {
      return NextResponse.json({ success: false, error: 'Valid seriesId is required' }, { status: 400 });
    }
    const chapterNumber = parseFloat(fields.chapterNumber);
    if (!Number.isFinite(chapterNumber)) {
      return NextResponse.json({ success: false, error: 'chapterNumber is required' }, { status: 400 });
    }

    await connectDB();
    const series = await Series.findById(fields.seriesId);
    if (!series) {
      return NextResponse.json({ success: false, error: 'Series not found' }, { status: 404 });
    }

    chapterId = new mongoose.Types.ObjectId();
    const id = String(chapterId);

    // Store the CBZ + extract every page image into MinIO
    const { archive, pages } = await storeChapterArchive(id, file.buffer, file.originalname);
    if (pages.length === 0) {
      return NextResponse.json({ success: false, error: 'CBZ contained no image pages' }, { status: 400 });
    }

    const chapter = await Chapter.create({
      _id: chapterId,
      seriesId: series._id,
      chapterNumber,
      title: fields.title?.trim() || `Chapter ${chapterNumber}`,
      originalCbz: archive,
      pages: [],
      scenes: [],
      status: 'ready',
    });

    const pageDocs = await Page.insertMany(
      pages.map((p) => ({
        chapterId: id,
        pageId: `${id}_page_${p.index + 1}`,
        order: p.index + 1,
        originalUrl: p.url,
        editedUrl: p.url,
        publicId: p.objectKey,
        panels: [],
        status: 'active',
      }))
    );

    chapter.pages = pageDocs.map((p) => p._id);
    await chapter.save();
    await Series.findByIdAndUpdate(series._id, { $push: { chapters: chapter._id } });

    return NextResponse.json({ success: true, data: { chapter, pageCount: pageDocs.length } }, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading chapter CBZ:', error);
    if (chapterId) await Chapter.findByIdAndDelete(chapterId).catch(() => {});
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
