import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Series } from '@/models/Series';
import { parseUpload } from '@/lib/upload';
import { uploadFile } from '@/lib/minio';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// GET /api/series — all series stored in MongoDB
export async function GET() {
  try {
    await connectDB();
    const series = await Series.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: series, total: series.length });
  } catch (error: any) {
    console.error('Error fetching series:', error);
    return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 500 });
  }
}

// POST /api/series — create a series (multipart; optional cover image file)
export async function POST(req: NextRequest) {
  try {
    const { file, fields } = await parseUpload(req, 'cover');
    const title = (fields.title || '').trim();
    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    await connectDB();
    const seriesId = new mongoose.Types.ObjectId();

    let coverImage = '';
    if (file && file.buffer.length > 0) {
      const ext = file.originalname.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
      const stored = await uploadFile(file.buffer, `series/${seriesId}/cover${ext}`, file.originalname, file.mimetype);
      coverImage = stored.url;
    }

    const series = await Series.create({
      _id: seriesId,
      title,
      alternativeTitle: fields.alternativeTitle || '',
      description: fields.description || '',
      author: fields.author || 'Unknown Author',
      artist: fields.artist || 'Unknown Artist',
      genres: (fields.genres || '').split(',').map((g) => g.trim()).filter(Boolean),
      status: (['ongoing', 'completed', 'hiatus'].includes(fields.status) ? fields.status : 'ongoing') as 'ongoing' | 'completed' | 'hiatus',
      coverImage,
      bannerImage: coverImage,
      language: fields.language || 'English',
      releaseYear: parseInt(fields.releaseYear, 10) || new Date().getFullYear(),
      chapters: [],
    });

    return NextResponse.json({ success: true, data: series }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating series:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
