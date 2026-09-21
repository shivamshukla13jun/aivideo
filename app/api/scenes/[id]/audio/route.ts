import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Scene } from '@/models/Scene';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const scene = await Scene.findById(id);
    if (!scene) return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('audioFile') as File;
    if (!file) return NextResponse.json({ success: false, error: 'No audio file uploaded' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cloudinaryAsset = await uploadToCloudinary(buffer, 'audio', 'video'); // Cloudinary treats audio as video/auto resource type

    scene.audio = {
      cloudinaryUrl: cloudinaryAsset.cloudinaryUrl,
      publicId: cloudinaryAsset.publicId,
      duration: cloudinaryAsset.duration || 5,
      format: cloudinaryAsset.format || 'mp3',
      fileSize: file.size,
    };

    await scene.save();
    return NextResponse.json({ success: true, data: scene });
  } catch (error: any) {
    console.error('Scene audio upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
