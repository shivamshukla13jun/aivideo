import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { YouTubeAccount } from '@/models/YouTubeAccount';
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
  fetchMyChannel,
  fetchRecentUploads90,
  fetchShortsViews90,
  fetchWatchHours365,
} from '@/lib/youtube';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${origin}/youtube?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/youtube?error=${encodeURIComponent('Missing authorization code')}`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, origin);
    const accessToken = tokens.access_token;

    const [channel, email] = await Promise.all([
      fetchMyChannel(accessToken),
      fetchGoogleEmail(accessToken),
    ]);

    if (!channel) {
      return NextResponse.redirect(
        `${origin}/youtube?error=${encodeURIComponent('No YouTube channel found on this Google account')}`
      );
    }

    // Best-effort stats collection (requires analytics scope; may return null)
    const [watchHours365, shortsViews90, uploads90d] = await Promise.all([
      fetchWatchHours365(accessToken),
      fetchShortsViews90(accessToken),
      fetchRecentUploads90(accessToken, channel.uploadsPlaylistId),
    ]);

    await connectDB();
    await YouTubeAccount.findOneAndUpdate(
      { channelId: channel.channelId },
      {
        channelId: channel.channelId,
        channelTitle: channel.title,
        customUrl: channel.customUrl,
        thumbnailUrl: channel.thumbnailUrl,
        email,
        accessToken,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        tokenExpiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        scopes: (tokens.scope || '').split(' ').filter(Boolean),
        uploadsPlaylistId: channel.uploadsPlaylistId,
        stats: {
          subscribers: channel.subscribers,
          totalViews: channel.totalViews,
          videoCount: channel.videoCount,
          watchHours365,
          shortsViews90,
          uploads90d,
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return NextResponse.redirect(
      `${origin}/youtube?connected=${encodeURIComponent(channel.title)}`
    );
  } catch (err: any) {
    console.error('YouTube OAuth callback error:', err);
    return NextResponse.redirect(
      `${origin}/youtube?error=${encodeURIComponent(err.message || 'Connection failed')}`
    );
  }
}
