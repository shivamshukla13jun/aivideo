import { YouTubeAccount, IYouTubeAccountDoc } from '@/models/YouTubeAccount';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim() || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

export function isYouTubeConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function getRedirectUri(origin?: string): string {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || origin || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/api/youtube/auth/callback`;
}

export function buildAuthUrl(origin?: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(origin),
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: state || '',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeCodeForTokens(code: string, origin?: string): Promise<GoogleTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token exchange failed');
  return data;
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token refresh failed');
  return data;
}

/** Returns a valid access token for the account, refreshing and persisting if expired. */
export async function getValidAccessToken(account: IYouTubeAccountDoc): Promise<string> {
  const expiresAt = account.tokenExpiry?.getTime() || 0;
  if (account.accessToken && expiresAt - 60_000 > Date.now()) {
    return account.accessToken;
  }
  if (!account.refreshToken) {
    throw new Error('No refresh token stored — reconnect this account');
  }
  const tokens = await refreshAccessToken(account.refreshToken);
  account.accessToken = tokens.access_token;
  if (tokens.refresh_token) account.refreshToken = tokens.refresh_token;
  account.tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
  await account.save();
  return tokens.access_token;
}

async function googleApiGet(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Google API error ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | undefined> {
  try {
    const data = await googleApiGet(
      'https://www.googleapis.com/oauth2/v2/userinfo?fields=email',
      accessToken
    );
    return data.email;
  } catch {
    return undefined;
  }
}

export interface ChannelInfo {
  channelId: string;
  title: string;
  customUrl?: string;
  thumbnailUrl?: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  uploadsPlaylistId?: string;
}

/** Fetch the authenticated user's own channel. */
export async function fetchMyChannel(accessToken: string): Promise<ChannelInfo | null> {
  const data = await googleApiGet(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
    accessToken
  );
  const ch = data.items?.[0];
  if (!ch) return null;
  return {
    channelId: ch.id,
    title: ch.snippet?.title || 'Untitled Channel',
    customUrl: ch.snippet?.customUrl,
    thumbnailUrl:
      ch.snippet?.thumbnails?.default?.url || ch.snippet?.thumbnails?.medium?.url,
    subscribers: Number(ch.statistics?.subscriberCount || 0),
    totalViews: Number(ch.statistics?.viewCount || 0),
    videoCount: Number(ch.statistics?.videoCount || 0),
    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads,
  };
}

function daysAgoISO(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Total public watch hours over the trailing 365 days via YouTube Analytics API. */
export async function fetchWatchHours365(accessToken: string): Promise<number | null> {
  try {
    const data = await googleApiGet(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${daysAgoISO(365)}&endDate=${todayISO()}&metrics=estimatedMinutesWatched`,
      accessToken
    );
    const minutes = data.rows?.[0]?.[0];
    return typeof minutes === 'number' ? minutes / 60 : null;
  } catch {
    return null;
  }
}

/** Public Shorts feed views over the trailing 90 days via YouTube Analytics API. */
export async function fetchShortsViews90(accessToken: string): Promise<number | null> {
  try {
    const data = await googleApiGet(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${daysAgoISO(90)}&endDate=${todayISO()}&metrics=views&dimensions=creatorContentType`,
      accessToken
    );
    const rows: any[] = data.rows || [];
    const shortRow = rows.find((r) => r[0] === 'SHORTS');
    return shortRow ? Number(shortRow[1]) : 0;
  } catch {
    return null;
  }
}

/** Count public uploads in the trailing 90 days from the channel's uploads playlist. */
export async function fetchRecentUploads90(accessToken: string, uploadsPlaylistId?: string): Promise<number | null> {
  if (!uploadsPlaylistId) return null;
  try {
    const data = await googleApiGet(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&fields=items/contentDetails/videoPublishedAt`,
      accessToken
    );
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const items: any[] = data.items || [];
    return items.filter((i) => {
      const t = i?.contentDetails?.videoPublishedAt;
      return t && new Date(t).getTime() >= cutoff;
    }).length;
  } catch {
    return null;
  }
}

export interface VideoSeoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  madeForKids?: boolean;
}

/**
 * Upload a video using YouTube's resumable upload protocol.
 * Returns the created video resource ({ id, snippet, ... }).
 */
export async function uploadVideoToYouTube(
  accessToken: string,
  videoBuffer: Buffer,
  mimeType: string,
  metadata: VideoSeoMetadata
): Promise<{ videoId: string }> {
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || 'video/mp4',
        'X-Upload-Content-Length': String(videoBuffer.length),
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title.slice(0, 100),
          description: metadata.description.slice(0, 5000),
          tags: (metadata.tags || []).slice(0, 50),
          categoryId: metadata.categoryId || '24', // Entertainment
        },
        status: {
          privacyStatus: metadata.privacyStatus || 'unlisted',
          selfDeclaredMadeForKids: Boolean(metadata.madeForKids),
        },
      }),
    }
  );

  if (!initRes.ok) {
    const errBody = await initRes.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Upload init failed (${initRes.status})`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube did not return an upload session URL');

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType || 'video/mp4',
      'Content-Length': String(videoBuffer.length),
    },
    body: new Uint8Array(videoBuffer),
  });

  const result = await putRes.json().catch(() => ({}));
  if (!putRes.ok) {
    throw new Error(result?.error?.message || `Video upload failed (${putRes.status})`);
  }
  return { videoId: result.id };
}

/** Revoke the stored refresh token on Google side (best effort). */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    });
  } catch {}
}

// ---- Monetization thresholds (YouTube Partner Program) ----
export const YPP_THRESHOLDS = {
  fanFunding: {
    subscribers: 500,
    watchHours365: 3000,
    shortsViews90: 3_000_000,
    uploads90d: 3,
  },
  fullMonetization: {
    subscribers: 1000,
    watchHours365: 4000,
    shortsViews90: 10_000_000,
  },
};

export interface MonetizationStats {
  subscribers: number;
  watchHours365: number | null;
  shortsViews90: number | null;
  uploads90d: number | null;
}

export interface MonetizationProgress {
  stats: MonetizationStats;
  fanFunding: {
    reached: boolean;
    percent: number;
    missing: { subscribers: number; watchHours: number | null; shortsViews: number | null; uploads90d: number | null };
  };
  fullMonetization: {
    reached: boolean;
    percent: number;
    missing: { subscribers: number; watchHours: number | null; shortsViews: number | null };
  };
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 100;
  return Math.min(100, Math.round((part / whole) * 100));
}

export function computeMonetizationProgress(stats: MonetizationStats): MonetizationProgress {
  const T = YPP_THRESHOLDS;
  const subs = stats.subscribers;
  const watch = stats.watchHours365;
  const shorts = stats.shortsViews90;
  const uploads = stats.uploads90d;

  // Full monetization: 1000 subs + (4000h watch OR 10M shorts views)
  const fullWatchOk = watch != null && watch >= T.fullMonetization.watchHours365;
  const fullShortsOk = shorts != null && shorts >= T.fullMonetization.shortsViews90;
  const fullEngagementPct = Math.max(
    watch != null ? pct(watch, T.fullMonetization.watchHours365) : 0,
    shorts != null ? pct(shorts, T.fullMonetization.shortsViews90) : 0
  );
  const fullReached = subs >= T.fullMonetization.subscribers && (fullWatchOk || fullShortsOk);

  // Fan funding tier: 500 subs + 3 uploads/90d + (3000h watch OR 3M shorts views)
  const fanWatchOk = watch != null && watch >= T.fanFunding.watchHours365;
  const fanShortsOk = shorts != null && shorts >= T.fanFunding.shortsViews90;
  const fanUploadsOk = uploads != null && uploads >= T.fanFunding.uploads90d;
  const fanEngagementPct = Math.max(
    watch != null ? pct(watch, T.fanFunding.watchHours365) : 0,
    shorts != null ? pct(shorts, T.fanFunding.shortsViews90) : 0
  );
  const fanReached =
    subs >= T.fanFunding.subscribers && (fanWatchOk || fanShortsOk) && fanUploadsOk;

  const fanParts = [
    pct(subs, T.fanFunding.subscribers),
    fanEngagementPct,
    uploads != null ? pct(uploads, T.fanFunding.uploads90d) : fanEngagementPct,
  ];
  const fullParts = [pct(subs, T.fullMonetization.subscribers), fullEngagementPct];

  return {
    stats,
    fanFunding: {
      reached: fanReached,
      percent: Math.round(fanParts.reduce((a, b) => a + b, 0) / fanParts.length),
      missing: {
        subscribers: Math.max(0, T.fanFunding.subscribers - subs),
        watchHours: watch != null && !fanWatchOk && !fanShortsOk ? Math.max(0, T.fanFunding.watchHours365 - watch) : null,
        shortsViews: shorts != null && !fanShortsOk && !fanWatchOk ? Math.max(0, T.fanFunding.shortsViews90 - shorts) : null,
        uploads90d: uploads != null ? Math.max(0, T.fanFunding.uploads90d - uploads) : null,
      },
    },
    fullMonetization: {
      reached: fullReached,
      percent: Math.round(fullParts.reduce((a, b) => a + b, 0) / fullParts.length),
      missing: {
        subscribers: Math.max(0, T.fullMonetization.subscribers - subs),
        watchHours: watch != null && !fullWatchOk && !fullShortsOk ? Math.max(0, T.fullMonetization.watchHours365 - watch) : null,
        shortsViews: shorts != null && !fullShortsOk && !fullWatchOk ? Math.max(0, T.fullMonetization.shortsViews90 - shorts) : null,
      },
    },
  };
}
