import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Scene } from '@/models/Scene';
import { parseUpload } from '@/lib/upload';
import { uploadFile, deleteFile } from '@/lib/minio';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const scene = await Scene.findById(id);
    if (!scene) return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });

    const { file } = await parseUpload(req, 'audioFile');
    if (!file) return NextResponse.json({ success: false, error: 'No audio file uploaded' }, { status: 400 });

    const ext = file.originalname.match(/\.[a-z0-9]+$/i)?.[0] || '.mp3';
    const stored = await uploadFile(
      file.buffer,
      `chapters/${scene.chapterId}/audio/${id}-${Date.now()}${ext}`,
      file.originalname,
      file.mimetype
    );

    // Clean up the previous audio object
    if (scene.audio?.objectKey) await deleteFile(scene.audio.objectKey);

    scene.audio = {
      url: stored.url,
      objectKey: stored.objectKey,
      duration: 0,
      format: stored.format,
      fileSize: stored.fileSize,
    } as any;

    await scene.save();
    return NextResponse.json({ success: true, data: scene });
  } catch (error: any) {
    console.error('Scene audio upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
