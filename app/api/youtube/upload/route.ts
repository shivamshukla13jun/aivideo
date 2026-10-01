import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { YouTubeAccount } from '@/models/YouTubeAccount';
import { YouTubeUpload } from '@/models/YouTubeUpload';
import { getValidAccessToken, uploadVideoToYouTube } from '@/lib/youtube';

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
    const accountIds: string[] = meta.accountIds || [];
    if (accountIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Select at least one YouTube channel' }, { status: 400 });
    }

    await connectDB();
    const accounts = await YouTubeAccount.find({ _id: { $in: accountIds } });
    if (accounts.length === 0) {
      return NextResponse.json({ success: false, error: 'No matching connected channels found' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'video/webm';

    const uploadDoc = await YouTubeUpload.create({
      chapterId: meta.chapterId,
      fileName: file.name || `video_${Date.now()}.webm`,
      fileSize: file.size,
      mimeType,
      seo: {
        title: meta.title || 'Untitled Video',
        description: meta.description || '',
        tags: meta.tags || [],
        categoryId: meta.categoryId || '24',
        privacyStatus: meta.privacyStatus || 'unlisted',
        madeForKids: Boolean(meta.madeForKids),
      },
      targets: accounts.map((a) => ({
        accountId: a._id,
        channelId: a.channelId,
        channelTitle: a.channelTitle,
        status: 'pending',
      })),
      status: 'uploading',
    });

    const results: any[] = [];
    for (const account of accounts) {
      const target = uploadDoc.targets.find(
        (t: any) => String(t.accountId) === String(account._id)
      );
      try {
        if (target) {
          target.status = 'uploading';
          uploadDoc.markModified('targets');
          await uploadDoc.save();
        }
        const accessToken = await getValidAccessToken(account);
        const { videoId } = await uploadVideoToYouTube(accessToken, buffer, mimeType, {
          title: meta.title || 'Untitled Video',
          description: meta.description || '',
          tags: meta.tags || [],
          categoryId: meta.categoryId,
          privacyStatus: meta.privacyStatus,
          madeForKids: meta.madeForKids,
        });
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (target) {
          target.status = 'done';
          target.videoId = videoId;
          target.watchUrl = watchUrl;
        }
        results.push({ channelId: account.channelId, channelTitle: account.channelTitle, success: true, videoId, watchUrl });
      } catch (err: any) {
        if (target) {
          target.status = 'failed';
          target.error = err.message;
        }
        results.push({ channelId: account.channelId, channelTitle: account.channelTitle, success: false, error: err.message });
      }
      uploadDoc.markModified('targets');
      await uploadDoc.save();
    }

    const doneCount = results.filter((r) => r.success).length;
    uploadDoc.status =
      doneCount === results.length ? 'done' : doneCount > 0 ? 'partial' : 'failed';
    await uploadDoc.save();

    return NextResponse.json({ success: true, data: { uploadId: uploadDoc._id, results } });
  } catch (error: any) {
    console.error('YouTube upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
