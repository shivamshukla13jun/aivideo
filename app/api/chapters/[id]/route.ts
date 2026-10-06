import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chapter } from '@/models/Chapter';
import { Page } from '@/models/Page';
import { Scene } from '@/models/Scene';
import { OcrJob } from '@/models/OcrJob';
import { deleteFile, deleteFilesByPrefix } from '@/lib/minio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    }

    const scenes = await Scene.find({ chapterId: id }).sort({ order: 1 });
    return NextResponse.json({ success: true, data: { ...chapter.toObject(), scenes } });
  } catch (error: any) {
    console.error('Error fetching chapter:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/chapters/[id]
 * Cascade-deletes: chapter doc, pages, scenes, OCR jobs, and all MinIO objects.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 });
    }

    // Collect explicit MinIO keys from scenes (audio)
    const scenes = await Scene.find({ chapterId: id }).lean();
    const audioKeys: string[] = [];
    for (const s of scenes) {
      if (s.audio?.objectKey) audioKeys.push(s.audio.objectKey);
    }

    // Collect explicit MinIO keys from pages (processedKey, publicId)
    const pages = await Page.find({ chapterId: id }).lean();
    const pageKeys: string[] = [];
    for (const p of pages) {
      if (p.publicId) pageKeys.push(p.publicId);
      if (p.processedKey) pageKeys.push(p.processedKey);
    }

    // Delete all objects under chapters/<id>/ prefix (covers CBZ + page images)
    const prefixCount = await deleteFilesByPrefix(`chapters/${id}/`);

    // Delete any keys stored outside the prefix (audio, processed images, etc.)
    const extraKeys = [...audioKeys, ...pageKeys].filter(
      (k) => k && !k.startsWith(`chapters/${id}/`)
    );
    for (const k of extraKeys) await deleteFile(k);

    // Delete the original CBZ object if stored outside the prefix
    if (chapter.originalCbz?.objectKey && !chapter.originalCbz.objectKey.startsWith(`chapters/${id}/`)) {
      await deleteFile(chapter.originalCbz.objectKey);
    }
    if (chapter.editedCbz?.objectKey && !chapter.editedCbz.objectKey.startsWith(`chapters/${id}/`)) {
      await deleteFile(chapter.editedCbz.objectKey);
    }

    // Delete MongoDB records
    const [pageResult, sceneResult, ocrResult] = await Promise.all([
      Page.deleteMany({ chapterId: id }),
      Scene.deleteMany({ chapterId: id }),
      OcrJob.deleteMany({ chapterId: id }),
    ]);
    await Chapter.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      data: {
        deletedPages: pageResult.deletedCount,
        deletedScenes: sceneResult.deletedCount,
        deletedOcrJobs: ocrResult.deletedCount,
        deletedMinioObjects: prefixCount + extraKeys.length,
      },
    });
  } catch (error: any) {
    console.error('Error deleting chapter:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
