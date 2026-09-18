/**
 * Follow-up fix for migrateLocalToCloudinary: rewrites any remaining
 * /uploads/... clip URLs inside stored video projects to the Cloudinary URL
 * of the matching page (matched by chapter folder + page_NNN filename).
 * Run with: npx tsx server/scripts/fixClipUrls.ts
 */
import fs from 'fs';
import path from 'path';

const storePath = path.join(process.cwd(), 'server', 'data', 'store.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));

// Build lookup: "chapterId/page_NNN" -> cloudinary page url
const pageUrlByKey = new Map<string, string>();
for (const [chapterId, pages] of store.pages || []) {
  for (const pg of pages) {
    const num = String(pg.pageNumber).padStart(3, '0');
    pageUrlByKey.set(`${chapterId}/page_${num}`, pg.imageUrl);
  }
}

let rewritten = 0;
for (const [, project] of store.videoProjects || []) {
  for (const track of project.tracks || []) {
    for (const clip of track.clips || []) {
      const url = clip.url || clip.mediaUrl || '';
      const m = url.match(/^\/uploads\/webtoon_pages\/([^/]+)\/(page_\d+)/);
      if (m) {
        const cloudUrl = pageUrlByKey.get(`${m[1]}/${m[2]}`);
        if (cloudUrl) {
          clip.url = cloudUrl;
          clip.mediaUrl = cloudUrl;
          rewritten++;
        }
      }
    }
  }
}

fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
console.log(`Rewrote ${rewritten} clip URLs to Cloudinary.`);
