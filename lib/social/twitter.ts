import crypto from 'crypto';
import { ISocialAccountDoc } from '@/models/SocialAccount';
import { PlatformConfig, PlatformTokens, PlatformUserInfo, PlatformUploadResult, SocialPlatformLib, getAppBase } from './types';

const CLIENT_ID = process.env.TWITTER_CLIENT_ID?.trim() || '';
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET?.trim() || '';

const SCOPES = 'tweet.read tweet.write users.read offline.access';

function getRedirectUri(origin?: string) {
  return `${getAppBase(origin)}/api/social/auth/callback/twitter`;
}

/** Generate PKCE code verifier and S256 challenge for Twitter OAuth 2.0. */
function generatePKCE() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  for (let i = 0; i < 128; i++) verifier += chars[Math.floor(Math.random() * chars.length)];
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge, method: 'S256' as const };
}

// Store PKCE verifiers by OAuth state (keyed per auth attempt).
// For multi-instance deployments, move this to Redis or a DB collection.
const pkceStore = new Map<string, string>();
export function storePKCE(state: string, verifier: string) { pkceStore.set(state, verifier); }
export function getPKCE(state: string): string | undefined { return pkceStore.get(state); }
export function clearPKCE(state: string) { pkceStore.delete(state); }

export const twitter: SocialPlatformLib = {
  config: {
    platform: 'twitter',
    displayName: 'X / Twitter',
    icon: 'twitter',
    color: '#1DA1F2',
    maxVideoSizeMB: 512,
    maxVideoDurationSec: 140,
    supportedFormats: ['video/mp4'],
    shortsMaxDuration: 140,
    ready: true,
  } satisfies PlatformConfig,

  isConfigured: () => Boolean(CLIENT_ID && CLIENT_SECRET),

  buildAuthUrl(origin?: string, state?: string): string {
    const st = state || String(Date.now());
    const { verifier, challenge, method } = generatePKCE();
    storePKCE(st, verifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: getRedirectUri(origin),
      scope: SCOPES,
      state: st,
      code_challenge: challenge,
      code_challenge_method: method,
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  },

  async exchangeCodeForTokens(code: string, origin?: string, state?: string): Promise<PlatformTokens> {
    const codeVerifier = state ? getPKCE(state) : undefined;
    if (state) clearPKCE(state);
    if (!codeVerifier) throw new Error('PKCE verifier not found — restart the Twitter connection');

    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(origin),
        code_verifier: codeVerifier,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error || 'Token exchange failed');
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 7200,
      scope: data.scope,
    };
  },

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
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
      refresh_token: data.refresh_token || refreshToken,
      expires_in: data.expires_in || 7200,
    };
  },

  async getValidAccessToken(account: ISocialAccountDoc): Promise<string> {
    const expiresAt = account.tokenExpiry?.getTime() || 0;
    if (account.accessToken && expiresAt - 300_000 > Date.now()) {
      return account.accessToken;
    }
    if (!account.refreshToken) throw new Error('No refresh token — reconnect Twitter/X');
    const tokens = await twitter.refreshAccessToken(account.refreshToken);
    account.accessToken = tokens.access_token;
    if (tokens.refresh_token) account.refreshToken = tokens.refresh_token;
    account.tokenExpiry = new Date(Date.now() + (tokens.expires_in || 7200) * 1000);
    await account.save();
    return tokens.access_token;
  },

  async fetchUserInfo(accessToken: string): Promise<PlatformUserInfo> {
    const res = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,name,username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    const user = data.data;
    if (!user) throw new Error('Failed to fetch Twitter user info');
    return {
      platformUserId: user.id,
      displayName: user.name || user.username,
      username: user.username,
      profileImageUrl: user.profile_image_url,
      followers: user.public_metrics?.followers_count,
      totalPosts: user.public_metrics?.tweet_count,
    };
  },

  async uploadVideo(
    accessToken: string,
    videoBuffer: Buffer,
    metadata: { title: string; description: string; tags: string[]; hashtags: string[] }
  ): Promise<PlatformUploadResult> {
    // Step 1: Upload media via v1.1 chunked upload (media upload still uses v1.1)
    // INIT
    const initParams = new URLSearchParams({
      command: 'INIT',
      total_bytes: String(videoBuffer.length),
      media_type: 'video/mp4',
      media_category: 'tweet_video',
    });
    const initRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: initParams,
    });
    const initData = await initRes.json();
    if (!initData.media_id_string) throw new Error('Twitter media upload INIT failed');
    const mediaId = initData.media_id_string;

    // APPEND (chunked, 5MB chunks)
    const CHUNK_SIZE = 5 * 1024 * 1024;
    let segmentIndex = 0;
    for (let offset = 0; offset < videoBuffer.length; offset += CHUNK_SIZE) {
      const chunk = videoBuffer.subarray(offset, Math.min(offset + CHUNK_SIZE, videoBuffer.length));
      const formData = new FormData();
      formData.append('command', 'APPEND');
      formData.append('media_id', mediaId);
      formData.append('segment_index', String(segmentIndex));
      formData.append('media_data', Buffer.from(chunk).toString('base64'));
      await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      segmentIndex++;
    }

    // FINALIZE
    const finalizeRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }),
    });
    const finalizeData = await finalizeRes.json();

    // Wait for processing if needed
    if (finalizeData.processing_info) {
      let checkAfter = finalizeData.processing_info.check_after_secs || 5;
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(r => setTimeout(r, checkAfter * 1000));
        const statusRes = await fetch(
          `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const statusData = await statusRes.json();
        const state = statusData.processing_info?.state;
        if (state === 'succeeded') break;
        if (state === 'failed') throw new Error('Twitter video processing failed');
        checkAfter = statusData.processing_info?.check_after_secs || 5;
      }
    }

    // Step 2: Create tweet with the video
    const tweetText = [
      metadata.title,
      '',
      metadata.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' '),
    ].join('\n').slice(0, 280);

    const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: tweetText,
        media: { media_ids: [mediaId] },
      }),
    });
    const tweetData = await tweetRes.json();
    if (tweetData.errors) throw new Error(tweetData.errors[0]?.message || 'Tweet creation failed');

    const tweetId = tweetData.data?.id;
    return {
      postId: tweetId,
      postUrl: `https://twitter.com/i/status/${tweetId}`,
    };
  },
};
