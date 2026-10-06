import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SocialAccount } from '@/models/SocialAccount';
import { getAllPlatforms } from '@/lib/social';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    const accounts = await SocialAccount.find().sort({ connectedAt: -1 }).lean();
    const platforms = getAllPlatforms();
    const data = accounts.map((a: any) => ({
      _id: a._id,
      platform: a.platform,
      platformUserId: a.platformUserId,
      displayName: a.displayName,
      username: a.username,
      profileImageUrl: a.profileImageUrl,
      email: a.email,
      connectedAt: a.connectedAt,
      stats: a.stats,
      platformMeta: {
        pageId: a.platformMeta?.pageId,
        pageName: a.platformMeta?.pageName,
      },
    }));
    return NextResponse.json({ success: true, data, platforms });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing account id' }, { status: 400 });
    await connectDB();
    const account = await SocialAccount.findById(id);
    if (!account) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    await account.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
