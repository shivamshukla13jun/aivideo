import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SocialAccount, SocialPlatform } from '@/models/SocialAccount';
import { SocialUpload } from '@/models/SocialUpload';
import { YouTubeAccount } from '@/models/YouTubeAccount';
import { getValidAccessToken as getYTToken, uploadVideoToYouTube } from '@/lib/youtube';
import { getPlatformLib } from '@/lib/social';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File | null;
    const metaRaw = formData.get('metadata') as string | null;
    if (!file) return NextResponse.json({ success: false, error: 'No video file provided' }, { status: 400 });
    if (!metaRaw) return NextResponse.json({ success: false, error: 'No metadata provided' }, { status: 400 });

    const meta = JSON.parse(metaRaw);
    const youtubeAccountIds: string[] = meta.youtubeAccountIds || [];
    const socialTargets: { platform: SocialPlatform; accountId: string }[] = meta.socialTargets || [];

    if (youtubeAccountIds.length === 0 && socialTargets.length === 0) {
      return NextResponse.json({ success: false, error: 'Select at least one platform to upload to' }, { status: 400 });
    }

    await connectDB();
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'video/mp4';

    // Build upload document with all targets
    const targets: any[] = [];

    // YouTube targets
    const ytAccounts = youtubeAccountIds.length > 0
      ? await YouTubeAccount.find({ _id: { $in: youtubeAccountIds } })
      : [];
    for (const a of ytAccounts) {
      targets.push({
        platform: 'youtube',
        accountId: a._id,
        displayName: a.channelTitle,
        status: 'pending',
      });
    }

    // Social platform targets
    const socialAccountIds = socialTargets.map(t => t.accountId);
    const socialAccounts = socialAccountIds.length > 0
      ? await SocialAccount.find({ _id: { $in: socialAccountIds } })
      : [];
    for (const target of socialTargets) {
      const account = socialAccounts.find(a => String(a._id) === target.accountId);
      if (account) {
        targets.push({
          platform: target.platform,
          accountId: account._id,
          displayName: account.displayName,
          status: 'pending',
        });
      }
    }

    const uploadDoc = await SocialUpload.create({
      chapterId: meta.chapterId,
      videoType: meta.videoType || 'full',
      fileName: file.name || `video_${Date.now()}.mp4`,
      fileSize: file.size,
      mimeType,
      seo: {
        title: meta.title || 'Untitled Video',
        description: meta.description || '',
        tags: meta.tags || [],
        hashtags: meta.hashtags || [],
      },
      targets,
      status: 'uploading',
    });

    const results: any[] = [];

    // Upload to YouTube accounts
    for (const account of ytAccounts) {
      const target = uploadDoc.targets.find(
        (t: any) => String(t.accountId) === String(account._id) && t.platform === 'youtube'
      );
      try {
        if (target) { target.status = 'uploading'; uploadDoc.markModified('targets'); await uploadDoc.save(); }
        const accessToken = await getYTToken(account);
        const { videoId } = await uploadVideoToYouTube(accessToken, buffer, mimeType, {
          title: meta.title || 'Untitled Video',
          description: meta.description || '',
          tags: meta.tags || [],
          categoryId: meta.categoryId,
          privacyStatus: meta.privacyStatus,
          madeForKids: meta.madeForKids,
        });
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (target) { target.status = 'done'; target.postId = videoId; target.postUrl = watchUrl; }
        results.push({ platform: 'youtube', displayName: account.channelTitle, success: true, postId: videoId, postUrl: watchUrl });
      } catch (err: any) {
        if (target) { target.status = 'failed'; target.error = err.message; }
        results.push({ platform: 'youtube', displayName: account.channelTitle, success: false, error: err.message });
      }
      uploadDoc.markModified('targets');
      await uploadDoc.save();
    }

    // Upload to social platforms
    for (const socialTarget of socialTargets) {
      const account = socialAccounts.find(a => String(a._id) === socialTarget.accountId);
      if (!account) continue;
      const target = uploadDoc.targets.find(
        (t: any) => String(t.accountId) === String(account._id) && t.platform === socialTarget.platform
      );
      try {
        if (target) { target.status = 'uploading'; uploadDoc.markModified('targets'); await uploadDoc.save(); }
        const lib = getPlatformLib(socialTarget.platform);
        const accessToken = await lib.getValidAccessToken(account);

        // Use platform-specific SEO if available
        const platformMeta = account.platformMeta || {};
        const result = await lib.uploadVideo(accessToken, buffer, {
          title: meta.platformSeo?.[socialTarget.platform]?.title || meta.title || 'Untitled',
          description: meta.platformSeo?.[socialTarget.platform]?.caption || meta.description || '',
          tags: meta.tags || [],
          hashtags: meta.platformSeo?.[socialTarget.platform]?.hashtags || meta.hashtags || [],
        }, platformMeta);

        if (target) { target.status = 'done'; target.postId = result.postId; target.postUrl = result.postUrl; }
        results.push({ platform: socialTarget.platform, displayName: account.displayName, success: true, ...result });
      } catch (err: any) {
        if (target) { target.status = 'failed'; target.error = err.message; }
        results.push({ platform: socialTarget.platform, displayName: account.displayName, success: false, error: err.message });
      }
      uploadDoc.markModified('targets');
      await uploadDoc.save();
    }

    const doneCount = results.filter(r => r.success).length;
    uploadDoc.status = doneCount === results.length ? 'done' : doneCount > 0 ? 'partial' : 'failed';
    await uploadDoc.save();

    return NextResponse.json({ success: true, data: { uploadId: uploadDoc._id, results } });
  } catch (error: any) {
    console.error('Multi-platform upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
