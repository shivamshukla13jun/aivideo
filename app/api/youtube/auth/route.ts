import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl, getRedirectUri, isYouTubeConfigured } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isYouTubeConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment, then register the redirect URI: ' +
            getRedirectUri(req.nextUrl.origin),
        },
        { status: 400 }
      );
    }
    const url = buildAuthUrl(req.nextUrl.origin, String(Date.now()));
    return NextResponse.json({ success: true, url, redirectUri: getRedirectUri(req.nextUrl.origin) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
