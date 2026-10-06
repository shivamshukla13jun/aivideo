import { ISocialAccountDoc } from '@/models/SocialAccount';
import { PlatformConfig, PlatformTokens, PlatformUserInfo, PlatformUploadResult, SocialPlatformLib, getAppBase } from './types';

const APP_ID = process.env.FACEBOOK_APP_ID?.trim() || '';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET?.trim() || '';

const SCOPES = 'pages_show_list,pages_read_engagement,pages_manage_posts,publish_video';

function getRedirectUri(origin?: string) {
  return `${getAppBase(origin)}/api/social/auth/callback/facebook`;
}

async function apiFetch(url: string, accessToken: string): Promise<any> {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}access_token=${accessToken}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Facebook API error');
  return data;
}

export const facebook: SocialPlatformLib = {
  config: {
    platform: 'facebook',
    displayName: 'Facebook',
    icon: 'facebook',
    color: '#1877F2',
    maxVideoSizeMB: 10240,
    maxVideoDurationSec: 14400,
    supportedFormats: ['video/mp4'],
    shortsMaxDuration: 60,
    ready: true,
  } satisfies PlatformConfig,

  isConfigured: () => Boolean(APP_ID && APP_SECRET),

  buildAuthUrl(origin?: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: getRedirectUri(origin),
      scope: SCOPES,
      response_type: 'code',
      state: state || '',
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
  },

  async exchangeCodeForTokens(code: string, origin?: string): Promise<PlatformTokens> {
    const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    url.searchParams.set('client_id', APP_ID);
    url.searchParams.set('client_secret', APP_SECRET);
    url.searchParams.set('redirect_uri', getRedirectUri(origin));
    url.searchParams.set('code', code);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Token exchange failed');

    // Get long-lived token
    const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', APP_ID);
    longUrl.searchParams.set('client_secret', APP_SECRET);
    longUrl.searchParams.set('fb_exchange_token', data.access_token);
    const longRes = await fetch(longUrl.toString());
    const longData = await longRes.json();

    return {
      access_token: longData.access_token || data.access_token,
      expires_in: longData.expires_in || 5184000,
    };
  },

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', APP_ID);
    url.searchParams.set('client_secret', APP_SECRET);
    url.searchParams.set('fb_exchange_token', refreshToken);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Token refresh failed');
    return { access_token: data.access_token, expires_in: data.expires_in || 5184000 };
  },

  async getValidAccessToken(account: ISocialAccountDoc): Promise<string> {
    const expiresAt = account.tokenExpiry?.getTime() || 0;
    if (account.accessToken && expiresAt - 86400_000 > Date.now()) {
      return account.accessToken;
    }
    const token = account.refreshToken || account.accessToken;
    if (!token) throw new Error('No token stored — reconnect Facebook');
    const tokens = await facebook.refreshAccessToken(token);
    account.accessToken = tokens.access_token;
    account.tokenExpiry = new Date(Date.now() + (tokens.expires_in || 5184000) * 1000);
    await account.save();
    return tokens.access_token;
  },

  async fetchUserInfo(accessToken: string): Promise<PlatformUserInfo> {
    // Get user's pages
    const pagesData = await apiFetch('https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,fan_count,picture', accessToken);
    const pages = pagesData.data || [];
    if (pages.length === 0) {
      // Fall back to personal profile
      const me = await apiFetch('https://graph.facebook.com/v21.0/me?fields=id,name,picture', accessToken);
      return {
        platformUserId: me.id,
        displayName: me.name || 'Facebook User',
        profileImageUrl: me.picture?.data?.url,
      };
    }
    const page = pages[0]; // Use first page
    return {
      platformUserId: page.id,
      displayName: page.name || 'Facebook Page',
      profileImageUrl: page.picture?.data?.url,
      followers: page.fan_count,
      platformMeta: {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        allPages: pages.map((p: any) => ({ id: p.id, name: p.name })),
      },
    };
  },

  async uploadVideo(
    accessToken: string,
    videoBuffer: Buffer,
    metadata: { title: string; description: string; tags: string[]; hashtags: string[] },
    platformMeta?: Record<string, any>
  ): Promise<PlatformUploadResult> {
    const pageId = platformMeta?.pageId;
    const pageToken = platformMeta?.pageAccessToken || accessToken;
    const target = pageId || 'me';

    const caption = [
      metadata.title,
      '',
      metadata.description,
      '',
      metadata.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' '),
    ].join('\n').slice(0, 5000);

    // Resumable upload flow
    // Step 1: Start upload session
    const startRes = await fetch(
      `https://graph-video.facebook.com/v21.0/${target}/videos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: pageToken,
          upload_phase: 'start',
          file_size: String(videoBuffer.length),
        }),
      }
    );
    const startData = await startRes.json();
    if (startData.error) throw new Error(startData.error.message || 'Upload start failed');

    const uploadSessionId = startData.upload_session_id;
    const videoId = startData.video_id;

    // Step 2: Upload chunks
    const CHUNK_SIZE = 4 * 1024 * 1024;
    let startOffset = Number(startData.start_offset || 0);
    let endOffset = Number(startData.end_offset || videoBuffer.length);

    while (startOffset < videoBuffer.length) {
      const chunk = videoBuffer.subarray(startOffset, endOffset);
      const form = new FormData();
      form.append('access_token', pageToken);
      form.append('upload_phase', 'transfer');
      form.append('upload_session_id', uploadSessionId);
      form.append('start_offset', String(startOffset));
      form.append('video_file_chunk', new Blob([new Uint8Array(chunk)], { type: 'video/mp4' }), 'chunk.mp4');

      const chunkRes = await fetch(
        `https://graph-video.facebook.com/v21.0/${target}/videos`,
        { method: 'POST', body: form }
      );
      const chunkData = await chunkRes.json();
      if (chunkData.error) throw new Error(chunkData.error.message || 'Chunk upload failed');
      startOffset = Number(chunkData.start_offset);
      endOffset = Number(chunkData.end_offset);
    }

    // Step 3: Finish upload
    const finishRes = await fetch(
      `https://graph-video.facebook.com/v21.0/${target}/videos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: pageToken,
          upload_phase: 'finish',
          upload_session_id: uploadSessionId,
          title: metadata.title.slice(0, 100),
          description: caption,
        }),
      }
    );
    const finishData = await finishRes.json();
    if (finishData.error) throw new Error(finishData.error.message || 'Upload finish failed');

    return {
      postId: videoId,
      postUrl: `https://www.facebook.com/${target}/videos/${videoId}`,
    };
  },
};
