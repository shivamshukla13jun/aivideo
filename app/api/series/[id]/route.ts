import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Series } from '@/models/Series';

export const dynamic = 'force-dynamic';

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
