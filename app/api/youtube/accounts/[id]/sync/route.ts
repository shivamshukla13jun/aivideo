import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { YouTubeAccount } from '@/models/YouTubeAccount';
import {
  fetchMyChannel,
  fetchRecentUploads90,
  fetchShortsViews90,
  fetchWatchHours365,
  getValidAccessToken,
} from '@/lib/youtube';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const account = await YouTubeAccount.findById(id);
    if (!account) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });

    const accessToken = await getValidAccessToken(account);
    const channel = await fetchMyChannel(accessToken);
    if (!channel) return NextResponse.json({ success: false, error: 'Channel not found' }, { status: 404 });

    const [watchHours365, shortsViews90, uploads90d] = await Promise.all([
      fetchWatchHours365(accessToken),
      fetchShortsViews90(accessToken),
      fetchRecentUploads90(accessToken, channel.uploadsPlaylistId || account.uploadsPlaylistId),
    ]);

    account.channelTitle = channel.title;
    account.customUrl = channel.customUrl;
    account.thumbnailUrl = channel.thumbnailUrl;
    account.uploadsPlaylistId = channel.uploadsPlaylistId;
    account.stats = {
      subscribers: channel.subscribers,
      totalViews: channel.totalViews,
      videoCount: channel.videoCount,
      watchHours365,
      shortsViews90,
      uploads90d,
      lastSyncedAt: new Date(),
    };
    await account.save();

    return NextResponse.json({ success: true, data: { stats: account.stats } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
