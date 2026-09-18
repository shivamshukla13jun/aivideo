import { Response } from 'express';
import JSZip from 'jszip';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { cloudinaryService } from '../services/cloudinaryService';
import { getIO } from '../sockets/socketHandler';
import { Page } from '../../src/types/index';
import { config } from '../config/index';

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export const uploadChapterImages = async (req: AuthRequest, res: Response) => {
  try {
    const { chapterId, images, socketId, replaceExisting = true, pageOffset = 0 } = req.body;
    // images is an array of { filename: string, dataUrl: string, pageNumber?: number }
    if (!chapterId || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: 'chapterId and array of images are required' });
    }

    const chapter = db.chapters.get(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    const uploadId = `upl_${Date.now()}`;
    const totalFiles = images.length;
    let completedFiles = 0;
    const completedPages: Page[] = [];
    const failedIndices: number[] = [];

    const io = getIO();

    // Natural sort images array based on filename or page number
    images.sort((a, b) => {
      if (a.pageNumber !== undefined && b.pageNumber !== undefined) {
        return a.pageNumber - b.pageNumber;
      }
      return naturalSort(a.filename || '', b.filename || '');
    });

    // Notify upload start
    const startPayload = {
      uploadId,
      chapterId,
      totalFiles,
      completedFiles: 0,
      currentFile: images[0]?.filename || 'page_1.jpg',
      progress: 0,
      status: 'uploading'
    };

    if (socketId) {
      io.to(socketId).emit('chapter-upload:start', startPayload);
    } else {
      io.emit('chapter-upload:start', startPayload);
    }

    // Process with controlled concurrency
    const concurrency = config.uploadConcurrency || 4;
    for (let i = 0; i < images.length; i += concurrency) {
      const chunk = images.slice(i, i + concurrency);

      await Promise.all(
        chunk.map(async (img, chunkIdx) => {
          const globalIdx = i + chunkIdx;
          try {
            const pageNum = Number(img.pageNumber) || (pageOffset + globalIdx + 1);
            const uploadResult = await cloudinaryService.uploadMedia(
              img.dataUrl || img.url,
              `webtoon_pages/${chapterId}`,
              'image',
              img.filename || `page_${String(pageNum).padStart(3, '0')}.jpg`
            );

            const newPage: Page = {
              id: `pg_${chapterId}_${pageNum}_${Math.random().toString(36).substring(2, 6)}`,
              chapterId,
              pageNumber: pageNum,
              imageUrl: uploadResult.url,
              cloudinaryPublicId: uploadResult.publicId,
              width: 1000,
              height: 1500,
              createdAt: new Date().toISOString()
            };

            completedPages.push(newPage);
            completedFiles += 1;

            const progressPct = Math.round((completedFiles / totalFiles) * 100);

            const progressPayload = {
              uploadId,
              chapterId,
              totalFiles,
              completedFiles,
              currentFile: img.filename || `Page ${pageNum}`,
              progress: progressPct,
              status: 'uploading'
            };

            if (socketId) {
              io.to(socketId).emit('chapter-upload:progress', progressPayload);
              io.to(socketId).emit('chapter-upload:page-complete', newPage);
            } else {
              io.emit('chapter-upload:progress', progressPayload);
              io.emit('chapter-upload:page-complete', newPage);
            }
          } catch (err: any) {
            failedIndices.push(globalIdx);
            console.error(`Failed uploading page ${globalIdx + 1}:`, err);
          }
        })
      );
    }

    // Sort completed pages by pageNumber
    completedPages.sort((a, b) => a.pageNumber - b.pageNumber);

    // Save pages to DB
    let finalPages: Page[];
    if (replaceExisting) {
      finalPages = completedPages;
    } else {
      const existingPages = db.pages.get(chapterId) || [];
      const pageMap = new Map<number, Page>();
      existingPages.forEach(p => pageMap.set(p.pageNumber, p));
      completedPages.forEach(p => pageMap.set(p.pageNumber, p));
      finalPages = Array.from(pageMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
    }

    db.pages.set(chapterId, finalPages);

    // Update chapter status
    db.chapters.set(chapterId, {
      ...chapter,
      status: 'reading',
      updatedAt: new Date().toISOString()
    });

    db.saveToDisk();

    const finalPayload = {
      uploadId,
      chapterId,
      totalFiles,
      completedFiles,
      currentFile: 'Done',
      progress: 100,
      status: 'completed',
      completedPages: finalPages,
      failedIndices
    };

    if (socketId) {
      io.to(socketId).emit('chapter-upload:complete', finalPayload);
    } else {
      io.emit('chapter-upload:complete', finalPayload);
    }

    return res.json({
      message: 'Upload completed',
      completedCount: completedFiles,
      failedIndices,
      pages: finalPages
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Upload failed' });
  }
};

/**
 * Direct CBZ / ZIP archive upload handler.
 * Unpacks comic archive server-side, extracts all pages (all extensions + magic bytes),
 * writes images to static uploads directory, updates DB, and broadcasts real-time progress.
 */
export const uploadCBZArchive = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    const { chapterId, socketId } = req.body;

    if (!file || !chapterId) {
      return res.status(400).json({ message: 'chapterId and CBZ archive file are required' });
    }

    const chapter = db.chapters.get(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file.buffer);

    const imageRegex = /\.(jpe?g|png|webp|avif|jfif|bmp|tiff?|gif|heic|heif|svg|jxl)$/i;
    const imageEntries: { name: string; zipEntry: JSZip.JSZipObject; ext: string }[] = [];

    // Filter and collect image entries
    const inspectPromises: Promise<void>[] = [];

    loadedZip.forEach((relativePath, zipEntry) => {
      const normalizedPath = relativePath.replace(/\\/g, '/').trim();
      if (zipEntry.dir || normalizedPath.endsWith('/')) return;
      if (normalizedPath.includes('__MACOSX') || normalizedPath.includes('/.') || normalizedPath.startsWith('.')) return;

      const fileName = normalizedPath.split('/').pop() || '';
      if (fileName.startsWith('.') || fileName === 'Thumbs.db' || fileName === 'desktop.ini') return;

      const extMatch = fileName.match(imageRegex);
      if (extMatch) {
        imageEntries.push({
          name: normalizedPath,
          zipEntry,
          ext: extMatch[0].toLowerCase() === '.jpeg' || extMatch[0].toLowerCase() === '.jfif' ? '.jpg' : extMatch[0].toLowerCase()
        });
      } else {
        // Inspect magic bytes for nameless/extensionless images
        const checkBytes = async () => {
          try {
            const buf = await zipEntry.async('nodebuffer');
            if (buf.length < 3) return;

            let ext = '';
            if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = '.jpg';
            else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ext = '.png';
            else if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) ext = '.webp';
            else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) ext = '.gif';
            else if (buf[0] === 0x42 && buf[1] === 0x4d) ext = '.bmp';

            if (ext) {
              imageEntries.push({ name: `${normalizedPath}${ext}`, zipEntry, ext });
            }
          } catch {
            // Ignore corrupted zip entry
          }
        };
        inspectPromises.push(checkBytes());
      }
    });

    if (inspectPromises.length > 0) {
      await Promise.all(inspectPromises);
    }

    // Natural sort so 1, 2, ... 10, ... 103 are in natural comic order
    imageEntries.sort((a, b) => naturalSort(a.name, b.name));

    if (imageEntries.length === 0) {
      return res.status(400).json({ message: 'No valid comic images found in CBZ archive' });
    }

    const pages: Page[] = [];
    const io = getIO();
    const totalFiles = imageEntries.length;

    // Notify start
    const startPayload = {
      uploadId: `cbz_${Date.now()}`,
      chapterId,
      totalFiles,
      completedFiles: 0,
      currentFile: imageEntries[0]?.name || 'page_001',
      progress: 0,
      status: 'uploading'
    };
    if (socketId) io.to(socketId).emit('chapter-upload:start', startPayload);
    else io.emit('chapter-upload:start', startPayload);

    for (let i = 0; i < imageEntries.length; i++) {
      const entry = imageEntries[i];
      const pageNum = i + 1;
      const buffer = await entry.zipEntry.async('nodebuffer');
      const safeFilename = `page_${String(pageNum).padStart(3, '0')}${entry.ext}`;

      // Upload the page straight to media storage — nothing is left behind in
      // the local folder where the archive entry first lands
      const uploadResult = await cloudinaryService.uploadMedia(
        buffer,
        `webtoon_pages/${chapterId}`,
        'image',
        safeFilename
      );

      const page: Page = {
        id: `pg_${chapterId}_${pageNum}_${Math.random().toString(36).substring(2, 6)}`,
        chapterId,
        pageNumber: pageNum,
        imageUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.publicId,
        width: 1000,
        height: 1500,
        createdAt: new Date().toISOString()
      };
      pages.push(page);

      // Emit progress periodically or for every 5 pages
      if (pageNum % 5 === 0 || pageNum === totalFiles) {
        const progressPct = Math.round((pageNum / totalFiles) * 100);
        const progressPayload = {
          chapterId,
          totalFiles,
          completedFiles: pageNum,
          currentFile: entry.name,
          progress: progressPct,
          status: 'uploading'
        };
        if (socketId) {
          io.to(socketId).emit('chapter-upload:progress', progressPayload);
        } else {
          io.emit('chapter-upload:progress', progressPayload);
        }
      }
    }

    // Save pages in database
    db.pages.set(chapterId, pages);

    // Update chapter status and timestamp
    db.chapters.set(chapterId, {
      ...chapter,
      status: 'reading',
      updatedAt: new Date().toISOString()
    });

    db.saveToDisk();

    const completePayload = {
      chapterId,
      totalFiles,
      completedFiles: totalFiles,
      progress: 100,
      status: 'completed',
      completedPages: pages
    };

    if (socketId) {
      io.to(socketId).emit('chapter-upload:complete', completePayload);
    } else {
      io.emit('chapter-upload:complete', completePayload);
    }

    return res.json({
      message: `Successfully extracted and stored all ${pages.length} pages.`,
      completedCount: pages.length,
      pages
    });
  } catch (err: any) {
    console.error('CBZ extraction error:', err);
    return res.status(500).json({ message: 'Failed to process CBZ archive: ' + err.message });
  }
};

