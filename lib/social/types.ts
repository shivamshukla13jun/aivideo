import { SocialPlatform, ISocialAccountDoc } from '@/models/SocialAccount';

export interface PlatformTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

export interface PlatformUserInfo {
  platformUserId: string;
  displayName: string;
  username?: string;
  profileImageUrl?: string;
  email?: string;
  followers?: number;
  totalPosts?: number;
  platformMeta?: Record<string, any>;
}

export interface PlatformUploadResult {
  postId: string;
  postUrl: string;
}

export interface PlatformConfig {
  platform: SocialPlatform;
  displayName: string;
  icon: string;
  color: string;
  maxVideoSizeMB: number;
  maxVideoDurationSec: number;
  supportedFormats: string[];
  shortsMaxDuration: number;
  /** Whether this platform is ready for production use (has complete API integration) */
  ready: boolean;
}

export interface SocialPlatformLib {
  config: PlatformConfig;
  isConfigured(): boolean;
  buildAuthUrl(origin?: string, state?: string): string;
  exchangeCodeForTokens(code: string, origin?: string, state?: string): Promise<PlatformTokens>;
  refreshAccessToken(refreshToken: string): Promise<PlatformTokens>;
  getValidAccessToken(account: ISocialAccountDoc): Promise<string>;
  fetchUserInfo(accessToken: string): Promise<PlatformUserInfo>;
  uploadVideo(
    accessToken: string,
    videoBuffer: Buffer,
    metadata: { title: string; description: string; tags: string[]; hashtags: string[] },
    platformMeta?: Record<string, any>
  ): Promise<PlatformUploadResult>;
}

/** Redirect base URL for OAuth callbacks. */
export function getAppBase(origin?: string): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    origin ||
    'http://localhost:5000'
  ).replace(/\/$/, '');
}
