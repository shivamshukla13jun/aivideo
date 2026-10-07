import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SocialAccount, SocialPlatform } from '@/models/SocialAccount';
import { getPlatformLib } from '@/lib/social';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform: rawPlatform } = await params;
  const platform = rawPlatform as SocialPlatform;
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state') || undefined;
  const error = req.nextUrl.searchParams.get('error') || req.nextUrl.searchParams.get('error_reason');

  if (error) {
    return NextResponse.redirect(`${origin}/distribute?error=${encodeURIComponent(error)}&platform=${platform}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/distribute?error=${encodeURIComponent('Missing authorization code')}&platform=${platform}`);
  }

  try {
    const lib = getPlatformLib(platform);
    const tokens = await lib.exchangeCodeForTokens(code, origin, state);
    const userInfo = await lib.fetchUserInfo(tokens.access_token);

    await connectDB();
    await SocialAccount.findOneAndUpdate(
      { platform, platformUserId: userInfo.platformUserId },
      {
        platform,
        platformUserId: userInfo.platformUserId,
        displayName: userInfo.displayName,
        username: userInfo.username,
        profileImageUrl: userInfo.profileImageUrl,
        email: userInfo.email,
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        tokenExpiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        scopes: (tokens.scope || '').split(/[\s,]+/).filter(Boolean),
        platformMeta: userInfo.platformMeta || {},
        stats: {
          followers: userInfo.followers || 0,
          totalPosts: userInfo.totalPosts || 0,
          totalViews: 0,
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return NextResponse.redirect(
      `${origin}/distribute?connected=${encodeURIComponent(userInfo.displayName)}&platform=${platform}`
    );
  } catch (err: any) {
    console.error(`${platform} OAuth callback error:`, err);
    return NextResponse.redirect(
      `${origin}/distribute?error=${encodeURIComponent(err.message || 'Connection failed')}&platform=${platform}`
    );
  }
}
