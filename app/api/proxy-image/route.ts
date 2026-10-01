import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Same-origin image proxy so remote webtoon images can be drawn onto a
 * canvas (video rendering) without tainting it.
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ success: false, error: 'Invalid url' }, { status: 400 });
    }

    const upstream = await fetch(url, {
      headers: { Referer: new URL(url).origin },
      redirect: 'follow',
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream error ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
