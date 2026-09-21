import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Library } from '@/models/Library';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const items = await Library.find({}).populate({
      path: 'seriesId',
      populate: { path: 'chapters' },
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seriesId, isFavorite } = body;
    await connectDB();

    let item = await Library.findOne({ seriesId });
    if (item) {
      item.isFavorite = isFavorite ?? item.isFavorite;
      await item.save();
    } else {
      item = await Library.create({ seriesId, isFavorite: isFavorite || false });
    }

    const populated = await Library.findById(item._id).populate({
      path: 'seriesId',
      populate: { path: 'chapters' },
    });

    return NextResponse.json({ success: true, data: populated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seriesId = searchParams.get('seriesId');
    await connectDB();
    await Library.findOneAndDelete({ seriesId });
    return NextResponse.json({ success: true, data: { seriesId } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
