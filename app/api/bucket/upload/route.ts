import { NextRequest, NextResponse } from 'next/server';
import { uploadBufferToBucket } from '@/lib/bucket';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const files = formData.getAll('files') as File[];

    if (!file && (!files || files.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const filesToUpload = file ? [file] : files;
    const uploadedResults = [];

    for (const f of filesToUpload) {
      const arrayBuffer = await f.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = f.name || `file_${Date.now()}`;
      const contentType = f.type || 'application/octet-stream';

      const result = await uploadBufferToBucket(buffer, filename, contentType);
      uploadedResults.push(result);
    }

    if (uploadedResults.length === 1) {
      return NextResponse.json({
        success: true,
        data: uploadedResults[0],
      });
    }

    return NextResponse.json({
      success: true,
      data: uploadedResults,
      total: uploadedResults.length,
    });
  } catch (error: any) {
    console.error('Bucket upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Bucket upload failed' },
      { status: 500 }
    );
  }
}
