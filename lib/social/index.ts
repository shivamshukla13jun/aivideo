import { SocialPlatform } from '@/models/SocialAccount';
import { SocialPlatformLib, PlatformConfig } from './types';
import { instagram } from './instagram';
import { reddit } from './reddit';
import { twitter } from './twitter';
import { facebook } from './facebook';

export type { PlatformConfig, PlatformTokens, PlatformUserInfo, PlatformUploadResult, SocialPlatformLib } from './types';

const platformMap: Record<SocialPlatform, SocialPlatformLib> = {
  instagram,
  reddit,
  twitter,
  facebook,
};

export function getPlatformLib(platform: SocialPlatform): SocialPlatformLib {
  const lib = platformMap[platform];
  if (!lib) throw new Error(`Unknown platform: ${platform}`);
  return lib;
}

export function getAllPlatforms(): PlatformConfig[] {
  return Object.values(platformMap).map((lib) => lib.config);
}

export function getConfiguredPlatforms(): PlatformConfig[] {
  return Object.values(platformMap)
    .filter((lib) => lib.isConfigured())
    .map((lib) => lib.config);
}

export { instagram, reddit, twitter, facebook };
