/**
 * Client-side CBZ extraction — runs in the browser.
 * Extracts page images from a .cbz File using JSZip,
 * deduplicates identical images, returns them in natural sort order.
 */

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;

/** Natural sort so page2 sorts before page10. */
const natural = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export interface ClientPage {
  index: number;    // 0-based (position in CBZ, after dedup)
  order: number;    // 1-based page number sent to the API
  fileName: string;
  blob: Blob;
  size: number;
}

/** Simple hash for image dedup — first 8KB + file size. */
async function imageHash(blob: Blob): Promise<string> {
  const buf = await blob.slice(0, 8192).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let h = 0;
  for (let i = 0; i < bytes.length; i++) {
    h = ((h << 5) - h + bytes[i]) | 0;
  }
  return `${h.toString(36)}_${blob.size}`;
}

/**
 * Extract image pages from a .cbz File in the browser.
 * Deduplicates by content (same image data → same hash) and by filename.
 * Returns pages sorted by filename (natural order), with sequential
 * order numbers — no gaps, no duplicates.
 */
export async function extractCbzInBrowser(file: File): Promise<ClientPage[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const entries = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir && IMAGE_EXT.test(name))
    .sort(natural);

  // Dedup by filename (same file listed twice in a ZIP)
  const seenNames = new Set<string>();
  const uniqueEntries = entries.filter((name) => {
    if (seenNames.has(name)) return false;
    seenNames.add(name);
    return true;
  });

  // Dedup by image content hash
  const seenHashes = new Set<string>();
  const pages: ClientPage[] = [];

  for (const name of uniqueEntries) {
    const entry = zip.files[name];
    const blob = await entry.async('blob');
    const hash = await imageHash(blob);
    if (seenHashes.has(hash)) continue; // duplicate image content
    seenHashes.add(hash);

    pages.push({
      index: pages.length,
      order: pages.length + 1, // 1-based, sequential — no gaps
      fileName: name.split('/').pop() || `page-${pages.length + 1}`,
      blob,
      size: blob.size,
    });
  }
  return pages;
}
