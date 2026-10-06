import { ISocialAccountDoc } from '@/models/SocialAccount';
import { PlatformConfig, PlatformTokens, PlatformUserInfo, PlatformUploadResult, SocialPlatformLib, getAppBase } from './types';

const CLIENT_ID = process.env.REDDIT_CLIENT_ID?.trim() || '';
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET?.trim() || '';
const USER_AGENT = process.env.REDDIT_USER_AGENT?.trim() || 'webtoon-studio/1.0 (multi-platform publisher)';

const SCOPES = 'identity submit';

function getRedirectUri(origin?: string) {
  return `${getAppBase(origin)}/api/social/auth/callback/reddit`;
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
}

async function redditGet(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': USER_AGENT },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.message || data.error || `Reddit API error ${res.status}`);
  }
  return data;
}

export const reddit: SocialPlatformLib = {
  config: {
    platform: 'reddit',
    displayName: 'Reddit',
    icon: 'reddit',
    color: '#FF4500',
    maxVideoSizeMB: 1024,
    maxVideoDurationSec: 900,
    supportedFormats: ['video/mp4', 'video/webm'],
    shortsMaxDuration: 58,
    ready: true,
  } satisfies PlatformConfig,

  isConfigured: () => Boolean(CLIENT_ID && CLIENT_SECRET),

  buildAuthUrl(origin?: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      state: state || '',
      redirect_uri: getRedirectUri(origin),
      duration: 'permanent',
      scope: SCOPES,
    });
    return `https://www.reddit.com/api/v1/authorize?${params}`;
  },

  async exchangeCodeForTokens(code: string, origin?: string): Promise<PlatformTokens> {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(origin),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error || 'Token exchange failed');
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 3600,
      scope: data.scope,
    };
  },

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error || 'Token refresh failed');
    return {
      access_token: data.access_token,
      refresh_token: refreshToken,
      expires_in: data.expires_in || 3600,
      scope: data.scope,
    };
  },

  async getValidAccessToken(account: ISocialAccountDoc): Promise<string> {
    const expiresAt = account.tokenExpiry?.getTime() || 0;
    if (account.accessToken && expiresAt - 60_000 > Date.now()) {
      return account.accessToken;
    }
    if (!account.refreshToken) throw new Error('No refresh token — reconnect Reddit');
    const tokens = await reddit.refreshAccessToken(account.refreshToken);
    account.accessToken = tokens.access_token;
    if (tokens.refresh_token) account.refreshToken = tokens.refresh_token;
    account.tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
    await account.save();
    return tokens.access_token;
  },

  async fetchUserInfo(accessToken: string): Promise<PlatformUserInfo> {
    const me = await redditGet('https://oauth.reddit.com/api/v1/me', accessToken);
    return {
      platformUserId: me.id,
      displayName: me.name,
      username: me.name,
      profileImageUrl: me.icon_img?.split('?')[0] || me.snoovatar_img,
      platformMeta: {
        karma: { link: me.link_karma || 0, comment: me.comment_karma || 0 },
        // Default posting target: the user's own profile subreddit
        subreddit: `u_${me.name}`,
      },
    };
  },

  async uploadVideo(
    accessToken: string,
    videoBuffer: Buffer,
    metadata: { title: string; description: string; tags: string[]; hashtags: string[] },
    platformMeta?: Record<string, any>
  ): Promise<PlatformUploadResult> {
    const headers = { Authorization: `Bearer ${accessToken}`, 'User-Agent': USER_AGENT };

    // Step 1: Request a media upload lease
    const leaseRes = await fetch('https://oauth.reddit.com/api/media/asset.json?raw_json=1', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ filepath: 'video.mp4', mimetype: 'video/mp4' }),
    });
    const lease = await leaseRes.json();
    const action: string | undefined = lease?.args?.action;
    const fields: { name: string; value: string }[] = lease?.args?.fields || [];
    const assetId: string | undefined = lease?.asset?.asset_id;
    if (!action || !assetId) {
      throw new Error(lease?.errors?.[0]?.message || 'Failed to get Reddit upload lease');
    }

    // Step 2: Upload the file to the leased S3 bucket
    const form = new FormData();
    for (const f of fields) form.append(f.name, f.value);
    form.append('file', new Blob([new Uint8Array(videoBuffer)], { type: 'video/mp4' }), 'video.mp4');
    const uploadRes = await fetch(`https:${action}`, { method: 'POST', body: form });
    if (!uploadRes.ok && uploadRes.status !== 204 && uploadRes.status !== 201) {
      throw new Error(`Reddit media upload failed (${uploadRes.status})`);
    }

    // media_id for v.redd.it is the first segment of the S3 key
    const keyField = fields.find((f) => f.name === 'key');
    const mediaId = keyField?.value?.split('/')[0] || assetId;
    const videoUrl = `https://v.redd.it/${mediaId}`;

    // Step 3: Submit the video post (to user's profile subreddit by default)
    const subreddit = platformMeta?.subreddit || platformMeta?.defaultSubreddit || 'test';
    const submitRes = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_type: 'json',
        kind: 'video',
        sr: subreddit,
        title: metadata.title.slice(0, 300),
        url: videoUrl,
        sendreplies: 'true',
        validate_on_submit: 'true',
      }),
    });
    const submitData = await submitRes.json();
    const errors = submitData?.json?.errors || [];
    if (errors.length > 0) {
      throw new Error(errors.map((e: any) => e.join(': ')).join('; ') || 'Reddit submit failed');
    }
    const postUrl = submitData?.json?.data?.url || submitData?.json?.data?.permalink
      ? `https://www.reddit.com${submitData.json.data.permalink || ''}`
      : undefined;

    return {
      postId: submitData?.json?.data?.id || mediaId,
      postUrl: postUrl || videoUrl,
    };
  },
};
