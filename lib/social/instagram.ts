import { ISocialAccountDoc } from '@/models/SocialAccount';
import { PlatformConfig, PlatformTokens, PlatformUserInfo, PlatformUploadResult, SocialPlatformLib, getAppBase } from './types';

const CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim() || '';
const CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim() || '';

const SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
].join(',');

function getRedirectUri(origin?: string) {
  return `${getAppBase(origin)}/api/social/auth/callback/instagram`;
}

async function apiFetch(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + `access_token=${accessToken}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Instagram API error');
  return data;
}

export const instagram: SocialPlatformLib = {
  config: {
    platform: 'instagram',
    displayName: 'Instagram',
    icon: 'instagram',
    color: '#E4405F',
    maxVideoSizeMB: 1024,
    maxVideoDurationSec: 5400,
    supportedFormats: ['video/mp4'],
    shortsMaxDuration: 90,
    ready: true,
  } satisfies PlatformConfig,

  isConfigured: () => Boolean(CLIENT_ID && CLIENT_SECRET),

  buildAuthUrl(origin?: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: getRedirectUri(origin),
      scope: SCOPES,
      response_type: 'code',
      state: state || '',
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
  },

  async exchangeCodeForTokens(code: string, origin?: string): Promise<PlatformTokens> {
    const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('client_secret', CLIENT_SECRET);
    url.searchParams.set('redirect_uri', getRedirectUri(origin));
    url.searchParams.set('code', code);
    const tokenRes = await fetch(url.toString());
    const data = await tokenRes.json();
    if (data.error) throw new Error(data.error.message || 'Token exchange failed');

    // Exchange short-lived token for long-lived token
    const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', CLIENT_ID);
    longUrl.searchParams.set('client_secret', CLIENT_SECRET);
    longUrl.searchParams.set('fb_exchange_token', data.access_token);
    const longRes = await fetch(longUrl.toString());
    const longData = await longRes.json();

    return {
      access_token: longData.access_token || data.access_token,
      expires_in: longData.expires_in || 5184000, // ~60 days
    };
  },

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    // Facebook long-lived tokens can be refreshed by exchanging again
    const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('client_secret', CLIENT_SECRET);
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
    if (!token) throw new Error('No token stored — reconnect this account');
    const tokens = await instagram.refreshAccessToken(token);
    account.accessToken = tokens.access_token;
    account.tokenExpiry = new Date(Date.now() + (tokens.expires_in || 5184000) * 1000);
    await account.save();
    return tokens.access_token;
  },

  async fetchUserInfo(accessToken: string): Promise<PlatformUserInfo> {
    // Get Facebook pages the user manages
    const pagesData = await apiFetch('https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account', accessToken);
    const pages = pagesData.data || [];
    // Find a page with an Instagram business account
    const page = pages.find((p: any) => p.instagram_business_account?.id);
    if (!page) throw new Error('No Instagram Business Account found. Link your Instagram to a Facebook Page first.');

    const igId = page.instagram_business_account.id;
    const igData = await apiFetch(
      `https://graph.facebook.com/v21.0/${igId}?fields=id,name,username,profile_picture_url,followers_count,media_count`,
      page.access_token || accessToken
    );
    return {
      platformUserId: igId,
      displayName: igData.name || igData.username || 'Instagram Account',
      username: igData.username,
      profileImageUrl: igData.profile_picture_url,
      followers: igData.followers_count,
      totalPosts: igData.media_count,
      platformMeta: {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        igBusinessAccountId: igId,
      },
    };
  },

  async uploadVideo(
    accessToken: string,
    videoBuffer: Buffer,
    metadata: { title: string; description: string; tags: string[]; hashtags: string[] },
    platformMeta?: Record<string, any>
  ): Promise<PlatformUploadResult> {
    const igAccountId = platformMeta?.igBusinessAccountId;
    const pageToken = platformMeta?.pageAccessToken || accessToken;
    if (!igAccountId) throw new Error('Missing Instagram Business Account ID');

    const caption = [
      metadata.title,
      '',
      metadata.description,
      '',
      metadata.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' '),
    ].join('\n').slice(0, 2200);

    // Step 1: Create a container (for Reels)
    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: `data:video/mp4;base64,${videoBuffer.toString('base64')}`,
          caption,
          access_token: pageToken,
        }),
      }
    );
    let containerData = await containerRes.json();

    // If direct base64 is not supported, fall back to hosted URL approach
    // For now we use the resumable upload flow
    if (containerData.error) {
      // Resumable upload: init
      const initRes = await fetch(
        `https://graph.facebook.com/v21.0/${igAccountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'REELS',
            upload_type: 'resumable',
            caption,
            access_token: pageToken,
          }),
        }
      );
      const initData = await initRes.json();
      if (initData.error) throw new Error(initData.error.message || 'Container creation failed');

      const containerId = initData.id;
      const uploadUrl = initData.uri;

      if (uploadUrl) {
        // Upload the video bytes
        await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `OAuth ${pageToken}`,
            'Content-Type': 'video/mp4',
            'Content-Length': String(videoBuffer.length),
          },
          body: new Uint8Array(videoBuffer),
        });
      }

      containerData = { id: containerId };
    }

    const containerId = containerData.id;
    if (!containerId) throw new Error('Failed to create media container');

    // Step 2: Wait for processing and publish
    let status = 'IN_PROGRESS';
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));
      const checkRes = await fetch(
        `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${pageToken}`
      );
      const checkData = await checkRes.json();
      status = checkData.status_code;
      if (status === 'FINISHED') break;
      if (status === 'ERROR') throw new Error('Instagram video processing failed');
    }
    if (status !== 'FINISHED') throw new Error('Instagram processing timed out');

    // Step 3: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: pageToken,
        }),
      }
    );
    const publishData = await publishRes.json();
    if (publishData.error) throw new Error(publishData.error.message || 'Publish failed');

    const postId = publishData.id;
    const username = platformMeta?.username || '';
    return {
      postId,
      postUrl: username
        ? `https://www.instagram.com/reel/${postId}/`
        : `https://www.instagram.com/p/${postId}/`,
    };
  },
};
