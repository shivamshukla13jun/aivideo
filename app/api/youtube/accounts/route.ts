import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { YouTubeAccount } from '@/models/YouTubeAccount';
import { computeMonetizationProgress, isYouTubeConfigured, revokeToken } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    const accounts = await YouTubeAccount.find().sort({ connectedAt: -1 }).lean();
    const data = accounts.map((a: any) => ({
      _id: a._id,
      channelId: a.channelId,
      channelTitle: a.channelTitle,
      customUrl: a.customUrl,
      thumbnailUrl: a.thumbnailUrl,
      email: a.email,
      connectedAt: a.connectedAt,
      stats: a.stats,
      monetization: computeMonetizationProgress({
        subscribers: a.stats?.subscribers || 0,
        watchHours365: a.stats?.watchHours365 ?? null,
        shortsViews90: a.stats?.shortsViews90 ?? null,
        uploads90d: a.stats?.uploads90d ?? null,
      }),
    }));
    return NextResponse.json({ success: true, data, configured: isYouTubeConfigured() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing account id' }, { status: 400 });
    await connectDB();
    const account = await YouTubeAccount.findById(id);
    if (!account) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    if (account.accessToken) await revokeToken(account.accessToken);
    await account.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
