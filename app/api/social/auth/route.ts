import { NextRequest, NextResponse } from 'next/server';
import { SocialPlatform } from '@/models/SocialAccount';
import { getPlatformLib } from '@/lib/social';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const platform = req.nextUrl.searchParams.get('platform') as SocialPlatform;
    if (!platform) {
      return NextResponse.json({ success: false, error: 'Missing platform parameter' }, { status: 400 });
    }

    const lib = getPlatformLib(platform);
    if (!lib.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: `${lib.config.displayName} OAuth is not configured. Check your environment variables.`,
          platform,
        },
        { status: 400 }
      );
    }

    const state = `${platform}_${Date.now()}`;
    const url = lib.buildAuthUrl(req.nextUrl.origin, state);
    return NextResponse.json({
      success: true,
      url,
      platform,
      redirectUri: `${req.nextUrl.origin}/api/social/auth/callback/${platform}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
