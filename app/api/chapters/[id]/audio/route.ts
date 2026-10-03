import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { uploadBufferToBucket } from '@/lib/bucket';
import { Chapter } from '@/models/Chapter';
import { VideoProject } from '@/models/VideoProject';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const formData = await req.formData();
    const audioFile = formData.get('audioFile') as File | null;
    const duration = parseFloat((formData.get('duration') as string) || '0');

    if (!audioFile) {
      return NextResponse.json({ success: false, error: 'No audio file provided' }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = audioFile.name || `master_dub_${id}_${Date.now()}.webm`;
    const contentType = audioFile.type || 'audio/webm';

    // Store in MongoDB GridFS Bucket Engine
    const uploadResult = await uploadBufferToBucket(buffer, filename, contentType, {
      chapterId: id,
      type: 'master_dub',
    });

    await connectDB();

    const audioTrackData = {
      url: uploadResult.url,
      volume: 1,
      duration: duration || undefined,
      fileName: filename,
    };

    // Update VideoProject
    await VideoProject.findOneAndUpdate(
      { chapterId: id },
      { $set: { audioTrack: audioTrackData } },
      { upsert: true, new: true }
    );

    // Update Chapter if exists
    try {
      await Chapter.findByIdAndUpdate(id, { $set: { audioTrack: audioTrackData } });
    } catch {}

    return NextResponse.json({
      success: true,
      data: audioTrackData,
    });
  } catch (error: any) {
    console.error('Error saving master dub audio:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to save dub audio' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();

    await VideoProject.findOneAndUpdate({ chapterId: id }, { $unset: { audioTrack: 1 } });
    try {
      await Chapter.findByIdAndUpdate(id, { $unset: { audioTrack: 1 } });
    } catch {}

    return NextResponse.json({ success: true, message: 'Master dub track removed' });
  } catch (error: any) {
    console.error('Error deleting dub track:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await connectDB();

    const update: any = {};
    if (body.volume !== undefined) update['audioTrack.volume'] = body.volume;

    await VideoProject.findOneAndUpdate({ chapterId: id }, { $set: update }, { new: true });
    try {
      await Chapter.findByIdAndUpdate(id, { $set: update });
    } catch {}

    return NextResponse.json({ success: true, data: body });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
