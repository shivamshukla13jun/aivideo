import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Series } from '@/models/Series';
import { Chapter } from '@/models/Chapter';
import { Page } from '@/models/Page';
import { Scene } from '@/models/Scene';
import { OcrJob } from '@/models/OcrJob';
import { Library } from '@/models/Library';
import { deleteFile, deleteFilesByPrefix } from '@/lib/minio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const series = await Series.findById(id);
    if (!series) {
      return NextResponse.json({ success: false, error: 'Series not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: series });
  } catch (error: any) {
    console.error('Error fetching series:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/series/[id]
 * Cascade-deletes: series, all its chapters, pages, scenes, OCR jobs,
 * library entries, and all MinIO objects (pages, audio, CBZ, covers).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    const series = await Series.findById(id);
    if (!series) {
      return NextResponse.json({ success: false, error: 'Series not found' }, { status: 404 });
    }

    // Find all chapters belonging to this series
    const chapters = await Chapter.find({ seriesId: id }).lean();
    const chapterIds = chapters.map((c) => String(c._id));

    let totalDeletedPages = 0;
    let totalDeletedScenes = 0;
    let totalDeletedOcrJobs = 0;
    let totalDeletedMinioObjects = 0;

    // Cascade-delete each chapter's data
    for (const chId of chapterIds) {
      // Collect scene audio keys stored outside the chapter prefix
      const scenes = await Scene.find({ chapterId: chId }).lean();
      for (const s of scenes) {
        if (s.audio?.objectKey && !s.audio.objectKey.startsWith(`chapters/${chId}/`)) {
          await deleteFile(s.audio.objectKey);
          totalDeletedMinioObjects++;
        }
      }

      // Collect page keys stored outside the chapter prefix
      const pages = await Page.find({ chapterId: chId }).lean();
      for (const p of pages) {
        if (p.publicId && !p.publicId.startsWith(`chapters/${chId}/`)) {
          await deleteFile(p.publicId);
          totalDeletedMinioObjects++;
        }
        if (p.processedKey && !p.processedKey.startsWith(`chapters/${chId}/`)) {
          await deleteFile(p.processedKey);
          totalDeletedMinioObjects++;
        }
      }

      // Delete all MinIO objects under chapters/<chId>/
      const count = await deleteFilesByPrefix(`chapters/${chId}/`);
      totalDeletedMinioObjects += count;

      // Chapter-level CBZ keys outside the prefix
      const chDoc = chapters.find((c) => String(c._id) === chId);
      if (chDoc?.originalCbz?.objectKey && !chDoc.originalCbz.objectKey.startsWith(`chapters/${chId}/`)) {
        await deleteFile(chDoc.originalCbz.objectKey);
        totalDeletedMinioObjects++;
      }
      if (chDoc?.editedCbz?.objectKey && !chDoc.editedCbz.objectKey.startsWith(`chapters/${chId}/`)) {
        await deleteFile(chDoc.editedCbz.objectKey);
        totalDeletedMinioObjects++;
      }

      // Delete MongoDB records for this chapter
      const [pgRes, scRes, ocrRes] = await Promise.all([
        Page.deleteMany({ chapterId: chId }),
        Scene.deleteMany({ chapterId: chId }),
        OcrJob.deleteMany({ chapterId: chId }),
      ]);
      totalDeletedPages += pgRes.deletedCount;
      totalDeletedScenes += scRes.deletedCount;
      totalDeletedOcrJobs += ocrRes.deletedCount;
    }

    // Delete all chapter documents
    await Chapter.deleteMany({ seriesId: id });

    // Delete series-level MinIO objects (cover, banner)
    const seriesPrefixCount = await deleteFilesByPrefix(`series/${id}/`);
    totalDeletedMinioObjects += seriesPrefixCount;

    // Delete library entry if any
    const libRes = await Library.deleteMany({ seriesId: id });

    // Delete the series document itself
    await Series.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      data: {
        deletedChapters: chapterIds.length,
        deletedPages: totalDeletedPages,
        deletedScenes: totalDeletedScenes,
        deletedOcrJobs: totalDeletedOcrJobs,
        deletedLibraryEntries: libRes.deletedCount,
        deletedMinioObjects: totalDeletedMinioObjects,
      },
    });
  } catch (error: any) {
    console.error('Error deleting series:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
