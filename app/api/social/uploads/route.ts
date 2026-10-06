import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SocialUpload } from '@/models/SocialUpload';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    const uploads = await SocialUpload.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return NextResponse.json({ success: true, data: uploads });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
