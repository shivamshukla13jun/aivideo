import { NextRequest, NextResponse } from 'next/server';
import { getLibraryMangas, mapSuwayomiMangaToSeries } from '@/lib/suwayomi';
import { connectDB } from '@/lib/mongodb';
import { Series } from '@/models/Series';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const mergedSeries: any[] = [];

  // 1. Fetch local series from MongoDB
  try {
    await connectDB();
    const localSeries = await Series.find().sort({ updatedAt: -1 }).lean();
    localSeries.forEach((s: any) => {
      mergedSeries.push({
        _id: String(s._id),
        title: s.title,
        alternativeTitle: s.alternativeTitle || '',
        author: s.author || 'Unknown Author',
        artist: s.artist || 'Unknown Artist',
        description: s.description || '',
        genres: s.genres?.length ? s.genres : ['Webtoon'],
        status: s.status || 'ongoing',
        coverImage: s.coverImage,
        bannerImage: s.bannerImage || s.coverImage,
        language: s.language || 'English',
        releaseYear: s.releaseYear || new Date().getFullYear(),
        chapters: s.chapters || [],
        totalChapters: s.chapters?.length || 0,
        source: 'local',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });
    });
  } catch (dbErr) {
    console.warn('Could not fetch local series from DB:', dbErr);
  }

  // 2. Fetch Suwayomi server mangas if available
  try {
    const suwayomiMangas = await getLibraryMangas();
    const mappedSuwa = suwayomiMangas.map(mapSuwayomiMangaToSeries);
    mergedSeries.push(...mappedSuwa);
  } catch (suwaErr: any) {
    console.warn('Suwayomi server unreachable for series list:', suwaErr?.message);
  }

  return NextResponse.json({
    success: true,
    data: mergedSeries,
    total: mergedSeries.length,
  });
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const {
      title,
      alternativeTitle,
      description,
      author,
      artist,
      genres,
      status,
      coverImage,
      bannerImage,
      language,
      releaseYear,
    } = body;

    if (!title || !description || !author || !artist || !coverImage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Title, description, author, artist, and cover image are required',
        },
        { status: 400 }
      );
    }

    const newSeries = await Series.create({
      title: title.trim(),
      alternativeTitle: alternativeTitle?.trim(),
      description: description.trim(),
      author: author.trim(),
      artist: artist.trim(),
      genres: Array.isArray(genres) && genres.length > 0 ? genres : ['Webtoon'],
      status: status || 'ongoing',
      coverImage,
      bannerImage: bannerImage || coverImage,
      language: language || 'English',
      releaseYear: releaseYear ? parseInt(releaseYear, 10) : new Date().getFullYear(),
      chapters: [],
      source: 'local',
    });

    return NextResponse.json(
      {
        success: true,
        data: newSeries,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating local series:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create series' },
      { status: 500 }
    );
  }
}
