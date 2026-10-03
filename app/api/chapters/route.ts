import { NextRequest, NextResponse } from 'next/server';
import { getMangaChapters, mapSuwayomiChapter } from '@/lib/suwayomi';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Series } from '@/models/Series';
import { Page } from '@/models/Page';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seriesId = searchParams.get('seriesId');

    if (!seriesId) {
      return NextResponse.json({ success: true, data: [] });
    }

    await connectDB();

    // 1. Fetch any local chapters in MongoDB for this seriesId
    const localChapters = await Chapter.find({ seriesId }).sort({ chapterNumber: 1 }).lean();

    if (localChapters.length > 0) {
      const mappedLocal = localChapters.map((c: any) => ({
        _id: String(c._id),
        seriesId: String(c.seriesId),
        chapterNumber: c.chapterNumber,
        title: c.title || `Chapter ${c.chapterNumber}`,
        status: c.status || 'ready',
        isDownloaded: true,
        source: 'local',
        audioTrack: c.audioTrack || null,
        uploadDate: c.createdAt,
        pages: c.pages || [],
      }));

      return NextResponse.json({
        success: true,
        data: mappedLocal,
        total: mappedLocal.length,
        source: 'local',
      });
    }

    // 2. If no local chapters, check Suwayomi if numeric seriesId
    const numericSeriesId = parseInt(seriesId, 10);
    if (!isNaN(numericSeriesId)) {
      try {
        const suwayomiChapters = await getMangaChapters(numericSeriesId);
        const mapped = suwayomiChapters.map((chap) => mapSuwayomiChapter(chap, seriesId));

        return NextResponse.json({
          success: true,
          data: mapped,
          total: mapped.length,
          source: 'suwayomi',
        });
      } catch (suwaErr: any) {
        console.warn('Suwayomi chapter fetch error:', suwaErr?.message);
      }
    }

    return NextResponse.json({ success: true, data: [], total: 0 });
  } catch (error: any) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const { seriesId, chapterNumber, title, pages = [] } = body;

    if (!seriesId || chapterNumber === undefined) {
      return NextResponse.json(
        { success: false, error: 'seriesId and chapterNumber are required' },
        { status: 400 }
      );
    }

    const chapNum = typeof chapterNumber === 'number' ? chapterNumber : parseInt(chapterNumber, 10);
    const chapTitle = title?.trim() || `Chapter ${chapNum}`;

    // 1. Create the chapter in MongoDB
    const newChapter = await Chapter.create({
      seriesId,
      chapterNumber: chapNum,
      title: chapTitle,
      status: 'ready',
      source: 'local',
      pages: [],
      scenes: [],
    });

    const chapterId = String(newChapter._id);

    // 2. Create Page documents for each extracted page
    // Preserve strict natural order: 1, 2, 3...
    const pageDocs = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const pageOrder = p.order !== undefined ? p.order : i + 1;
      const originalUrl = typeof p === 'string' ? p : p.originalUrl || p.url;

      pageDocs.push({
        chapterId,
        order: pageOrder,
        originalUrl,
        panels: [],
        status: 'active',
      });
    }

    let createdPages: any[] = [];
    if (pageDocs.length > 0) {
      createdPages = await Page.insertMany(pageDocs);
      newChapter.pages = createdPages.map((p) => p._id);
      await newChapter.save();
    }

    // 3. Update the Series document's chapters array if it's a MongoDB series
    try {
      await Series.findByIdAndUpdate(seriesId, {
        $addToSet: { chapters: newChapter._id },
      });
    } catch {}

    return NextResponse.json(
      {
        success: true,
        data: newChapter,
        pages: createdPages,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating chapter:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create chapter' },
      { status: 500 }
    );
  }
}
