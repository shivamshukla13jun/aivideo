/**
 * CBZ archive handling. A .cbz is a ZIP of page images; we extract them,
 * order pages by filename, and upload each page + the original archive
 * to MinIO.
 */

import JSZip from 'jszip';
import { uploadFile, StoredFile } from '@/lib/minio';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;

/** Natural sort so page2 sorts before page10. */
const natural = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export interface ExtractedPage {
  index: number; // 0-based
  fileName: string;
  buffer: Buffer;
}

/** Extract image pages from a CBZ/ZIP buffer in reading order. */
export async function extractCbzPages(cbzBuffer: Buffer): Promise<ExtractedPage[]> {
  const zip = await JSZip.loadAsync(cbzBuffer);
  const entries = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir && IMAGE_EXT.test(name))
    .sort(natural);

  const pages: ExtractedPage[] = [];
  for (let i = 0; i < entries.length; i++) {
    const file = zip.files[entries[i]];
    const buffer = Buffer.from(await file.async('arraybuffer'));
    pages.push({ index: i, fileName: entries[i].split('/').pop() || `page-${i + 1}`, buffer });
  }
  return pages;
}

/**
 * Store a chapter CBZ + all its extracted pages in MinIO under
 * `chapters/<chapterId>/`. Returns the archive descriptor and page files.
 */
export async function storeChapterArchive(
  chapterId: string,
  cbzBuffer: Buffer,
  cbzFileName: string
): Promise<{ archive: StoredFile; pages: (StoredFile & { index: number })[] }> {
  const base = `chapters/${chapterId}`;
  const archive = await uploadFile(cbzBuffer, `${base}/original.cbz`, cbzFileName, 'application/x-cbz');

  const pages = await extractCbzPages(cbzBuffer);
  const stored: (StoredFile & { index: number })[] = [];
  for (const p of pages) {
    const ext = p.fileName.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
    const key = `${base}/pages/${String(p.index + 1).padStart(4, '0')}${ext}`;
    const f = await uploadFile(p.buffer, key, p.fileName);
    stored.push({ ...f, index: p.index });
  }
  return { archive, pages: stored };
}
