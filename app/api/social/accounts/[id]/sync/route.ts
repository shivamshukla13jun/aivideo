import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SocialAccount } from '@/models/SocialAccount';
import { getPlatformLib } from '@/lib/social';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const account = await SocialAccount.findById(id);
    if (!account) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });

    const lib = getPlatformLib(account.platform);
    const accessToken = await lib.getValidAccessToken(account);
    const userInfo = await lib.fetchUserInfo(accessToken);

    account.displayName = userInfo.displayName;
    account.username = userInfo.username;
    account.profileImageUrl = userInfo.profileImageUrl;
    if (userInfo.platformMeta) account.platformMeta = { ...account.platformMeta, ...userInfo.platformMeta };
    account.stats = {
      followers: userInfo.followers || 0,
      totalPosts: userInfo.totalPosts || 0,
      totalViews: account.stats?.totalViews || 0,
      lastSyncedAt: new Date(),
    };
    await account.save();

    return NextResponse.json({ success: true, data: { stats: account.stats } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
