/**
 * One-time migration: uploads every locally stored media file (uploads/...) to
 * Cloudinary, rewrites the URLs in server/data/store.json, and removes the
 * local copies. Run with: npx tsx server/scripts/migrateLocalToCloudinary.ts
 *
 * Stop the dev server first so it cannot overwrite store.json mid-migration.
 */
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../src/config/index';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret
});

const storePath = path.join(process.cwd(), 'server', 'data', 'store.json');
const uploadsRoot = path.join(process.cwd(), 'uploads');

let migrated = 0;
let skipped = 0;
let failed = 0;

async function migrateUrl(localUrl: string | undefined): Promise<{ url: string; publicId: string } | null> {
  if (!localUrl || !localUrl.startsWith('/uploads/')) return null;

  const rel = localUrl.replace(/^\/uploads\//, '');
  const filePath = path.join(uploadsRoot, rel);
  if (!fs.existsSync(filePath)) {
    skipped++;
    return null;
  }

  const folder = path.posix.dirname(rel);
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto'
    });
    fs.unlinkSync(filePath);
    migrated++;
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    failed++;
    console.error(`  FAILED ${localUrl}:`, (err as any)?.message || err);
    return null;
  }
}

async function main() {
  const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));

  // pages: [[chapterId, Page[]]]
  for (const [, pages] of store.pages || []) {
    for (const pg of pages) {
      const res = await migrateUrl(pg.imageUrl);
      if (res) {
        pg.imageUrl = res.url;
        pg.cloudinaryPublicId = res.publicId;
      }
    }
  }

  // videoProjects: [[id, project]] — rewrite clip urls
  for (const [, project] of store.videoProjects || []) {
    for (const track of project.tracks || []) {
      for (const clip of track.clips || []) {
        const res = await migrateUrl(clip.url || clip.mediaUrl);
        if (res) {
          clip.url = res.url;
          clip.mediaUrl = res.url;
        }
      }
    }
  }

  // narrations: [[chapterId, GeneratedNarration[]]]
  for (const [, narrations] of store.narrations || []) {
    for (const nar of narrations) {
      const res = await migrateUrl(nar.audioUrl);
      if (res) {
        nar.audioUrl = res.url;
        nar.cloudinaryPublicId = res.publicId;
      }
    }
  }

  // assets: [[userId, Asset[]]]
  for (const [, assets] of store.assets || []) {
    for (const asset of assets) {
      const res = await migrateUrl(asset.url || asset.fileUrl);
      if (res) {
        asset.url = res.url;
        asset.fileUrl = res.url;
        asset.cloudinaryPublicId = res.publicId;
      }
    }
  }

  // users: [[userId, user]] — reference voice audio
  for (const [, user] of store.users || []) {
    if (user.referenceVoice?.audioUrl) {
      const res = await migrateUrl(user.referenceVoice.audioUrl);
      if (res) {
        user.referenceVoice.audioUrl = res.url;
        user.referenceVoice.cloudinaryPublicId = res.publicId;
      }
    }
  }

  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`\nDone. migrated=${migrated} skipped(missing file)=${skipped} failed=${failed}`);

  // Remove now-empty folders inside uploads/
  const pruneEmpty = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) pruneEmpty(path.join(dir, entry.name));
    }
    if (fs.readdirSync(dir).length === 0 && dir !== uploadsRoot) {
      fs.rmdirSync(dir);
      console.log(`Removed empty dir: ${dir}`);
    }
  };
  pruneEmpty(uploadsRoot);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
