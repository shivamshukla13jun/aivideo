import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Page } from '@/models/Page';
import { parseUpload } from '@/lib/upload';
import { uploadFile } from '@/lib/minio';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/chapters/[id]/pages — pages extracted from the uploaded CBZ (stored in MinIO)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const pages = await Page.find({ chapterId: id, status: { $ne: 'deleted' } }).sort({ order: 1 });
    return NextResponse.json({ success: true, data: pages, total: pages.length });
  } catch (error: any) {
    console.error('Error fetching pages:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/chapters/[id]/pages — upload a single page image.
 * Multipart fields: page (file), order (number), fileName?
 * Stores to MinIO under chapters/<id>/pages/, creates the Page doc.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    }

    const { file, fields } = await parseUpload(req, 'page');
    if (!file) {
      return NextResponse.json({ success: false, error: 'No page image uploaded (field "page")' }, { status: 400 });
    }
    const order = parseInt(fields.order, 10);
    if (!Number.isFinite(order) || order < 1) {
      return NextResponse.json({ success: false, error: 'order is required (1-based page number)' }, { status: 400 });
    }

    // Reject duplicate order — a page already exists at this position
    const existing = await Page.findOne({ chapterId: id, order });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Page ${order} already exists`, data: existing },
        { status: 409 }
      );
    }

    const ext = file.originalname.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
    const key = `chapters/${id}/pages/${String(order).padStart(4, '0')}${ext}`;
    const stored = await uploadFile(file.buffer, key, file.originalname, file.mimetype);

    const page = await Page.create({
      chapterId: id,
      pageId: `${id}_page_${order}`,
      order,
      originalUrl: stored.url,
      editedUrl: stored.url,
      publicId: stored.objectKey,
      panels: [],
      status: 'active',
    });

    // Add to chapter's pages array if not already there
    await Chapter.findByIdAndUpdate(id, {
      $addToSet: { pages: page._id },
    });

    return NextResponse.json({ success: true, data: page }, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading page:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
