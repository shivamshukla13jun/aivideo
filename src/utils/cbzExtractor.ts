import JSZip from 'jszip';

export interface ExtractedPage {
  name: string;
  previewUrl: string;
  dataUrl: string;
  blob: Blob;
  file?: File;
  pageNumber: number;
}

/**
 * Natural sort comparator for filenames (e.g., 1.jpg, 2.jpg, 10.jpg, Chapter 1/page_003.webp)
 */
export function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read blob as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function getMimeTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
    case '.jfif':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    case '.svg':
      return 'image/svg+xml';
    case '.heic':
    case '.heif':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

/**
 * Extracts images from a CBZ / ZIP file directly in the browser.
 * Supports all image formats (.jpg, .jpeg, .png, .webp, .avif, .jfif, .bmp, .gif, .tiff, etc.)
 * Handles Windows paths, subfolders, magic-byte fallbacks, and uses fast Blob URLs.
 */
export async function extractCBZFile(file: File): Promise<ExtractedPage[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const imageRegex = /\.(jpe?g|png|webp|avif|jfif|bmp|tiff?|gif|heic|heif|svg|jxl)$/i;
  const imageEntries: { name: string; zipEntry: JSZip.JSZipObject; mimeType: string }[] = [];

  const entryPromises: Promise<void>[] = [];

  loadedZip.forEach((relativePath, zipEntry) => {
    // Normalize path separators (handle Windows backslashes)
    const normalizedPath = relativePath.replace(/\\/g, '/').trim();

    // Skip directories and Mac OS metadata
    if (zipEntry.dir || normalizedPath.endsWith('/')) return;
    if (normalizedPath.includes('__MACOSX') || normalizedPath.includes('/.') || normalizedPath.startsWith('.')) return;

    const fileName = normalizedPath.split('/').pop() || '';
    if (fileName.startsWith('.') || fileName === 'Thumbs.db' || fileName === 'desktop.ini') return;

    // Check extension
    const extMatch = fileName.match(imageRegex);
    if (extMatch) {
      const mime = getMimeTypeFromExt(extMatch[0]);
      imageEntries.push({ name: normalizedPath, zipEntry, mimeType: mime });
    } else {
      // Check magic bytes for images with no extension or unknown extension
      const checkMagic = async () => {
        try {
          // Read first 16 bytes
          const buffer = await zipEntry.async('uint8array');
          if (buffer.length < 3) return;

          let detectedMime = '';
          let detectedExt = '';

          // JPEG: FF D8 FF
          if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            detectedMime = 'image/jpeg';
            detectedExt = '.jpg';
          }
          // PNG: 89 50 4E 47
          else if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
            detectedMime = 'image/png';
            detectedExt = '.png';
          }
          // WEBP: RIFF ... WEBP
          else if (
            buffer.length >= 12 &&
            buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
            buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
          ) {
            detectedMime = 'image/webp';
            detectedExt = '.webp';
          }
          // GIF: GIF
          else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
            detectedMime = 'image/gif';
            detectedExt = '.gif';
          }
          // BMP: BM
          else if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
            detectedMime = 'image/bmp';
            detectedExt = '.bmp';
          }

          if (detectedMime) {
            imageEntries.push({
              name: `${normalizedPath}${detectedExt}`,
              zipEntry,
              mimeType: detectedMime
            });
          }
        } catch {
          // Ignore non-readable entry
        }
      };
      entryPromises.push(checkMagic());
    }
  });

  if (entryPromises.length > 0) {
    await Promise.all(entryPromises);
  }

  // Apply natural sorting to file names so pages 1, 2... 10... 103 are properly sequenced
  imageEntries.sort((a, b) => naturalSort(a.name, b.name));

  const extractedPages: ExtractedPage[] = [];

  // Extract all pages
  for (let i = 0; i < imageEntries.length; i++) {
    const entry = imageEntries[i];
    const rawBlob = await entry.zipEntry.async('blob');
    // Ensure correct MIME type on blob
    const typedBlob = rawBlob.type ? rawBlob : new Blob([rawBlob], { type: entry.mimeType });
    const previewUrl = URL.createObjectURL(typedBlob);
    const pageFile = new File([typedBlob], entry.name.split('/').pop() || `page_${i + 1}`, { type: entry.mimeType });

    extractedPages.push({
      name: entry.name,
      previewUrl,
      dataUrl: previewUrl, // Fast blob URL for immediate preview
      blob: typedBlob,
      file: pageFile,
      pageNumber: i + 1
    });
  }

  return extractedPages;
}

