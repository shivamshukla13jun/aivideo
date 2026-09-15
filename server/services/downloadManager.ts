import fs from 'fs';
import path from 'path';
import axios from 'axios';

import { DownloadQueueModel } from '../db/models.js';
import { isMongoActive } from '../db/connection.js';
import {
  getChapterById,
  getMangaById,
  updateChapter,
} from '../db/store.js';


// ============================================================
// TYPES
// ============================================================

export interface DownloadQueueItem {
  id: string;
  chapterId: number;
  mangaId: number;
  mangaTitle: string;
  mangaThumbnail: string;
  chapterName: string;
  chapterNumber: number;
  progress: number;
  status:
    | 'QUEUED'
    | 'DOWNLOADING'
    | 'PAUSED'
    | 'DOWNLOADED'
    | 'ERROR';
  pagesDownloaded: number;
  totalPages: number;
  error?: string;
}


// ============================================================
// INTERNAL PAGE TYPES
// ============================================================

interface SuwayomiPage {
  url: string;
  name: string;
  groupIndex: number;
  pageIndex: number;
  originalIndex: number;
}


// ============================================================
// DOWNLOAD DIRECTORY
//
// Same general idea as Suwayomi's downloadsPath.
// Override with:
//
// DOWNLOADS_PATH=/your/path
//
// Otherwise:
// <project>/downloads
// ============================================================

const DOWNLOADS_ROOT =
  process.env.DOWNLOADS_PATH ||
  path.join(process.cwd(), 'downloads');


// ============================================================
// QUEUE STATE
// ============================================================

let queue: DownloadQueueItem[] = [];

let isRunning = false;
let isPaused = false;

let timer: NodeJS.Timeout | null = null;


// ============================================================
// FILESYSTEM HELPERS
// ============================================================

function sanitizeFileName(value: string): string {
  return String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
}


function ensureDirectory(directory: string) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true,
    });
  }
}


function extractFileName(value: string): string {
  if (!value) return '';

  try {
    const clean = value
      .split('?')[0]
      .split('#')[0];

    const decoded = decodeURIComponent(clean);

    const parts = decoded.split('/');

    return parts[parts.length - 1] || '';
  } catch {
    const parts = value.split('/');

    return parts[parts.length - 1] || '';
  }
}


// ============================================================
// SUWAYOMI PAGE NAME PARSER
//
// Examples:
//
// 001__001.jpg
// 001__002.jpg
// 002__001.jpg
//
// groupIndex = first number
// pageIndex  = second number
// ============================================================

function parseSuwayomiFileName(
  fileName: string
): {
  groupIndex: number;
  pageIndex: number;
} | null {
  const match = fileName.match(
    /^(\d+)__(\d+)\.(jpg|jpeg|png|webp|gif|avif)$/i
  );

  if (!match) {
    return null;
  }

  return {
    groupIndex: parseInt(match[1], 10),
    pageIndex: parseInt(match[2], 10),
  };
}


// ============================================================
// MIME → EXTENSION
// ============================================================

function extensionFromContentType(
  contentType?: string
): string {
  if (!contentType) return '.jpg';

  const type = contentType
    .split(';')[0]
    .trim()
    .toLowerCase();

  switch (type) {
    case 'image/jpeg':
      return '.jpg';

    case 'image/jpg':
      return '.jpg';

    case 'image/png':
      return '.png';

    case 'image/webp':
      return '.webp';

    case 'image/gif':
      return '.gif';

    case 'image/avif':
      return '.avif';

    default:
      return '.jpg';
  }
}


// ============================================================
// FALLBACK SUWAYOMI NAME
//
// If original filename is unavailable:
//
// 001__001.jpg
// 001__002.jpg
// 001__003.jpg
//
// This keeps alphanumeric ordering stable.
// ============================================================

function createFallbackPageName(
  index: number,
  extension = '.jpg'
): string {
  return (
    `001__${String(index + 1).padStart(3, '0')}` +
    extension
  );
}


// ============================================================
// NORMALIZE ONE PAGE
// ============================================================

function normalizePage(
  page: any,
  index: number
): SuwayomiPage {
  let url = '';
  let name = '';

  // ----------------------------------------------------------
  // String page
  // ----------------------------------------------------------

  if (typeof page === 'string') {
    url = page;

    name = extractFileName(page);
  }

  // ----------------------------------------------------------
  // Object page
  // ----------------------------------------------------------

  else if (page && typeof page === 'object') {
    url = String(
      page.url ||
      page.pageUrl ||
      page.imageUrl ||
      ''
    );

    name = String(
      page.name ||
      page.fileName ||
      page.filename ||
      ''
    );

    if (!name) {
      name = extractFileName(url);
    }
  }


  // ----------------------------------------------------------
  // Data URI has no filename
  // ----------------------------------------------------------

  if (!name || name.startsWith('data:')) {
    name = createFallbackPageName(index);
  }


  // ----------------------------------------------------------
  // Parse Suwayomi naming
  // ----------------------------------------------------------

  const parsed = parseSuwayomiFileName(name);

  if (parsed) {
    return {
      url,
      name,
      groupIndex: parsed.groupIndex,
      pageIndex: parsed.pageIndex,
      originalIndex: index,
    };
  }


  // ----------------------------------------------------------
  // Unknown filename.
  //
  // Put these after valid Suwayomi filenames.
  // ----------------------------------------------------------

  return {
    url,
    name,
    groupIndex: Number.MAX_SAFE_INTEGER,
    pageIndex: Number.MAX_SAFE_INTEGER,
    originalIndex: index,
  };
}


// ============================================================
// SORT SUWAYOMI PAGES
//
// Example incoming:
//
// 002__003
// 001__002
// 003__001
// 001__001
// 002__001
//
// Result:
//
// 001__001
// 001__002
// 002__001
// 002__003
// 003__001
// ============================================================

function sortSuwayomiPages(
  pages: any[],
  metadata?: any[]
): SuwayomiPage[] {
  const normalized = pages.map((page, index) => {
    const metadataItem =
      Array.isArray(metadata)
        ? metadata[index]
        : undefined;

    // If pageMetadata exists, prefer its original filename.
    if (
      metadataItem &&
      typeof metadataItem === 'object'
    ) {
      return normalizePage(
        {
          url:
            typeof page === 'string'
              ? page
              : page?.url || page?.pageUrl || '',

          name:
            metadataItem.name ||
            metadataItem.fileName ||
            metadataItem.filename ||
            extractFileName(
              typeof page === 'string'
                ? page
                : page?.url || ''
            ),
        },
        index
      );
    }

    return normalizePage(page, index);
  });


  return normalized.sort((a, b) => {
    // First index.
    if (a.groupIndex !== b.groupIndex) {
      return a.groupIndex - b.groupIndex;
    }

    // Second index.
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }

    // Stable fallback.
    return a.originalIndex - b.originalIndex;
  });
}


// ============================================================
// DATA URI DOWNLOAD
// ============================================================

function decodeDataUri(
  dataUri: string
): {
  buffer: Buffer;
  extension: string;
} {
  const match = dataUri.match(
    /^data:([^;,]+)?(;base64)?,(.*)$/s
  );

  if (!match) {
    throw new Error('Invalid data URI');
  }

  const mimeType =
    match[1] || 'image/jpeg';

  const isBase64 =
    Boolean(match[2]);

  const data = match[3];

  const buffer = isBase64
    ? Buffer.from(data, 'base64')
    : Buffer.from(
        decodeURIComponent(data),
        'utf8'
      );

  return {
    buffer,
    extension:
      extensionFromContentType(mimeType),
  };
}


// ============================================================
// DOWNLOAD ONE IMAGE
// ============================================================

async function downloadImage(
  page: SuwayomiPage,
  outputPath: string
): Promise<void> {
  if (!page.url) {
    throw new Error(
      `Missing image URL for ${page.name}`
    );
  }


  // ----------------------------------------------------------
  // Data URI
  // ----------------------------------------------------------

  if (page.url.startsWith('data:')) {
    const decoded =
      decodeDataUri(page.url);

    await fs.promises.writeFile(
      outputPath,
      decoded.buffer
    );

    return;
  }


  // ----------------------------------------------------------
  // HTTP / HTTPS
  // ----------------------------------------------------------

  const response = await axios.get(
    page.url,
    {
      responseType: 'arraybuffer',

      timeout: 120000,

      maxContentLength:
        100 * 1024 * 1024,

      maxBodyLength:
        100 * 1024 * 1024,

      headers: {
        'User-Agent':
          'Mozilla/5.0 ' +
          '(Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) ' +
          'Chrome/131 Safari/537.36',

        Accept:
          'image/avif,image/webp,image/apng,' +
          'image/svg+xml,image/*,*/*;q=0.8',
      },
    }
  );


  const buffer = Buffer.from(
    response.data
  );

  if (!buffer.length) {
    throw new Error(
      `Empty image response for ${page.name}`
    );
  }


  await fs.promises.writeFile(
    outputPath,
    buffer
  );
}


// ============================================================
// CREATE FINAL FILE NAME
//
// Preserve:
//
// 001__001.jpg
// 001__002.jpg
// 002__001.jpg
//
// If no valid original name exists,
// create:
//
// 001__001.jpg
// 001__002.jpg
// ============================================================

function getFinalPageName(
  page: SuwayomiPage,
  index: number
): string {
  const parsed =
    parseSuwayomiFileName(page.name);

  if (parsed) {
    return sanitizeFileName(page.name);
  }


  let extension = '.jpg';

  const original =
    extractFileName(page.url);

  const originalExtension =
    path.extname(original);

  if (
    originalExtension &&
    originalExtension.length <= 6
  ) {
    extension =
      originalExtension.toLowerCase();
  }


  return createFallbackPageName(
    index,
    extension
  );
}


// ============================================================
// DOWNLOAD CHAPTER TO FOLDER
// ============================================================

async function downloadChapterFiles(
  item: DownloadQueueItem
): Promise<void> {
  const chapter =
    await getChapterById(
      item.chapterId
    );

  if (!chapter) {
    throw new Error(
      `Chapter not found: ${item.chapterId}`
    );
  }


  const manga =
    await getMangaById(
      chapter.mangaId
    );


  const pages =
    Array.isArray(chapter.pages)
      ? chapter.pages
      : [];


  if (pages.length === 0) {
    throw new Error(
      `Chapter has no pages: ${item.chapterId}`
    );
  }


  // ----------------------------------------------------------
  // Sort exactly according to Suwayomi indexes.
  // ----------------------------------------------------------

  const sortedPages =
    sortSuwayomiPages(
      pages,
      (chapter as any).pageMetadata
    );


  console.log(
    `[DownloadManager] ` +
    `${item.mangaTitle} / ${item.chapterName}`
  );

  console.log(
    `[DownloadManager] ` +
    `Sorted ${sortedPages.length} pages`
  );


  // ----------------------------------------------------------
  // Manga folder
  // ----------------------------------------------------------

  const mangaFolder =
    sanitizeFileName(
      manga?.title ||
      item.mangaTitle ||
      `manga-${item.mangaId}`
    );


  // ----------------------------------------------------------
  // Chapter folder
  // ----------------------------------------------------------

  const chapterFolder =
    sanitizeFileName(
      chapter.name ||
      item.chapterName ||
      `Chapter ${item.chapterNumber}`
    );


  const outputDirectory =
    path.join(
      DOWNLOADS_ROOT,
      mangaFolder,
      chapterFolder
    );


  ensureDirectory(
    outputDirectory
  );


  console.log(
    `[DownloadManager] Output: ${outputDirectory}`
  );


  // ----------------------------------------------------------
  // Download each page sequentially.
  // ----------------------------------------------------------

  for (
    let index = 0;
    index < sortedPages.length;
    index++
  ) {
    // --------------------------------------------------------
    // Pause handling
    // --------------------------------------------------------

    while (isPaused) {
      await new Promise<void>(
        resolve =>
          setTimeout(resolve, 300)
      );

      if (!isRunning) {
        return;
      }
    }


    const page =
      sortedPages[index];


    const fileName =
      getFinalPageName(
        page,
        index
      );


    const outputPath =
      path.join(
        outputDirectory,
        fileName
      );


    // --------------------------------------------------------
    // Skip an already downloaded image.
    // --------------------------------------------------------

    if (
      fs.existsSync(outputPath) &&
      fs.statSync(outputPath).size > 0
    ) {
      item.pagesDownloaded =
        index + 1;

      item.progress =
        Math.min(
          100,
          Math.round(
            ((index + 1) /
              sortedPages.length) *
              100
          )
        );

      await persistQueueItem(
        item
      );

      continue;
    }


    console.log(
      `[DownloadManager] ` +
      `[${index + 1}/${sortedPages.length}] ` +
      `${fileName}`
    );


    // --------------------------------------------------------
    // Download
    // --------------------------------------------------------

    await downloadImage(
      page,
      outputPath
    );


    // --------------------------------------------------------
    // Update progress
    // --------------------------------------------------------

    item.pagesDownloaded =
      index + 1;

    item.progress =
      Math.min(
        100,
        Math.round(
          ((index + 1) /
            sortedPages.length) *
            100
        )
      );


    await persistQueueItem(
      item
    );
  }


  // ----------------------------------------------------------
  // Save local download path.
  //
  // updateChapter may ignore unknown fields depending on the
  // Mongo schema, so this is intentionally best-effort.
  // ----------------------------------------------------------

  try {
    await updateChapter(
      item.chapterId,
      {
        fetchedAt:
          new Date().toISOString(),

        downloadPath:
          path.relative(
            process.cwd(),
            outputDirectory
          ),
      } as any
    );
  } catch (e) {
    console.warn(
      '[DownloadManager] ' +
      'Could not save download path:',
      e
    );
  }
}


// ============================================================
// MONGO QUEUE PERSISTENCE
// ============================================================

async function persistQueueItem(
  item: DownloadQueueItem
): Promise<void> {
  if (!isMongoActive()) {
    return;
  }

  try {
    await DownloadQueueModel.updateOne(
      {
        chapterId:
          item.chapterId,
      },
      {
        $set: {
          status:
            item.status,

          progress:
            item.progress,

          pagesDownloaded:
            item.pagesDownloaded,

          totalPages:
            item.totalPages,

          error:
            item.error || undefined,
        },
      }
    );
  } catch (e) {
    console.warn(
      '[DownloadManager] ' +
      'Mongo progress update error:',
      e
    );
  }
}


// ============================================================
// GET QUEUE
// ============================================================

export async function getDownloadQueue(): Promise<
  DownloadQueueItem[]
> {
  if (isMongoActive()) {
    try {
      const docs =
        await DownloadQueueModel
          .find({})
          .lean();

      if (
        docs &&
        docs.length > 0
      ) {
        return docs.map(
          (d: any) => ({
            ...d,

            id:
              d._id
                ? d._id.toString()
                : String(d.chapterId),
          })
        );
      }
    } catch (e) {
      console.warn(
        '[DownloadManager] ' +
        'Mongo queue fetch error:',
        e
      );
    }
  }

  return queue;
}


// ============================================================
// ENQUEUE SINGLE CHAPTER
// ============================================================

export async function enqueueChapter(
  chapterId: number
): Promise<DownloadQueueItem> {
  const existing =
    queue.find(
      item =>
        item.chapterId === chapterId
    );

  if (existing) {
    return existing;
  }


  const chapter =
    await getChapterById(
      chapterId
    );

  if (!chapter) {
    throw new Error(
      `Chapter not found: ${chapterId}`
    );
  }


  const manga =
    await getMangaById(
      chapter.mangaId
    );


  const totalPages =
    Array.isArray(chapter.pages)
      ? chapter.pages.length
      : chapter.pageCount || 0;


  if (totalPages <= 0) {
    throw new Error(
      `Chapter ${chapterId} has no downloadable pages`
    );
  }


  const newItem: DownloadQueueItem = {
    id:
      `dl-${chapterId}-${Date.now()}`,

    chapterId,

    mangaId:
      chapter.mangaId,

    mangaTitle:
      manga?.title ||
      'Unknown Manga',

    mangaThumbnail:
      manga?.thumbnailUrl ||
      '',

    chapterName:
      chapter.name ||
      `Chapter ${chapter.chapterNumber}`,

    chapterNumber:
      chapter.chapterNumber,

    progress: 0,

    status: 'QUEUED',

    pagesDownloaded: 0,

    totalPages,
  };


  queue.push(
    newItem
  );


  // ----------------------------------------------------------
  // Save queue item
  // ----------------------------------------------------------

  if (isMongoActive()) {
    try {
      await DownloadQueueModel.findOneAndUpdate(
        {
          chapterId,
        },
        {
          $set:
            newItem,
        },
        {
          upsert: true,
          new: true,
        }
      );
    } catch (e) {
      console.warn(
        '[DownloadManager] ' +
        'Mongo queue save error:',
        e
      );
    }
  }


  // ----------------------------------------------------------
  // Start automatically
  // ----------------------------------------------------------

  if (
    !isPaused &&
    !isRunning
  ) {
    startDownloader();
  }


  return newItem;
}


// ============================================================
// ENQUEUE BATCH
// ============================================================

export async function enqueueBatch(
  chapterIds: number[]
): Promise<DownloadQueueItem[]> {
  const added: DownloadQueueItem[] = [];

  for (
    const chapterId of chapterIds
  ) {
    try {
      const item =
        await enqueueChapter(
          chapterId
        );

      added.push(item);
    } catch (e) {
      console.warn(
        `[DownloadManager] ` +
        `Could not enqueue ${chapterId}:`,
        e
      );
    }
  }

  return added;
}


// ============================================================
// START DOWNLOADER
// ============================================================

export function startDownloader() {
  isPaused = false;

  if (isRunning) {
    return;
  }

  isRunning = true;

  void processQueueStep();
}


// ============================================================
// PAUSE
// ============================================================

export function pauseDownloader() {
  isPaused = true;

  isRunning = false;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }


  for (
    const item of queue
  ) {
    if (
      item.status ===
      'DOWNLOADING'
    ) {
      item.status = 'PAUSED';

      void persistQueueItem(
        item
      );
    }
  }
}


// ============================================================
// CLEAR QUEUE
// ============================================================

export async function clearQueue(
  onlyCompleted = false
): Promise<void> {
  if (onlyCompleted) {
    queue =
      queue.filter(
        item =>
          item.status !==
          'DOWNLOADED'
      );


    if (isMongoActive()) {
      try {
        await DownloadQueueModel.deleteMany(
          {
            status:
              'DOWNLOADED',
          }
        );
      } catch (e) {}
    }

    return;
  }


  queue = [];


  if (timer) {
    clearTimeout(timer);

    timer = null;
  }


  isRunning = false;


  if (isMongoActive()) {
    try {
      await DownloadQueueModel.deleteMany(
        {}
      );
    } catch (e) {}
  }
}


// ============================================================
// REMOVE QUEUE ITEM
// ============================================================

export async function removeQueueItem(
  chapterId: number
): Promise<void> {
  queue =
    queue.filter(
      item =>
        item.chapterId !==
        chapterId
    );


  if (isMongoActive()) {
    try {
      await DownloadQueueModel.deleteOne(
        {
          chapterId,
        }
      );
    } catch (e) {}
  }
}


// ============================================================
// DOWNLOADER STATUS
// ============================================================

export function getDownloaderStatus() {
  return {
    isRunning,

    isPaused,

    queueLength:
      queue.length,

    activeCount:
      queue.filter(
        item =>
          item.status ===
          'DOWNLOADING'
      ).length,

    completedCount:
      queue.filter(
        item =>
          item.status ===
          'DOWNLOADED'
      ).length,
  };
}


// ============================================================
// PROCESS QUEUE
// ============================================================

async function processQueueStep() {
  if (isPaused) {
    isRunning = false;
    return;
  }


  const nextItem =
    queue.find(
      item =>
        item.status ===
          'QUEUED' ||
        item.status ===
          'DOWNLOADING' ||
        item.status ===
          'PAUSED'
    );


  if (!nextItem) {
    isRunning = false;
    return;
  }


  nextItem.status =
    'DOWNLOADING';


  await persistQueueItem(
    nextItem
  );


  try {
    // --------------------------------------------------------
    // ACTUAL IMAGE DOWNLOAD
    // --------------------------------------------------------

    await downloadChapterFiles(
      nextItem
    );


    // --------------------------------------------------------
    // COMPLETE
    // --------------------------------------------------------

    nextItem.pagesDownloaded =
      nextItem.totalPages;

    nextItem.progress = 100;

    nextItem.status =
      'DOWNLOADED';

    nextItem.error =
      undefined;


    await persistQueueItem(
      nextItem
    );


    // --------------------------------------------------------
    // Mark chapter as downloaded
    // --------------------------------------------------------

    try {
      await updateChapter(
        nextItem.chapterId,
        {
          fetchedAt:
            new Date().toISOString(),
        }
      );
    } catch (e) {
      console.warn(
        '[DownloadManager] ' +
        'Could not update chapter:',
        e
      );
    }


    console.log(
      `[DownloadManager] ` +
      `Completed: ${nextItem.mangaTitle} ` +
      `/ ${nextItem.chapterName}`
    );
  } catch (error: any) {
    console.error(
      '[DownloadManager] ' +
      `Download failed for chapter ${nextItem.chapterId}:`,
      error
    );


    nextItem.status =
      'ERROR';

    nextItem.error =
      error?.message ||
      'Download failed';


    await persistQueueItem(
      nextItem
    );
  }


  // ----------------------------------------------------------
  // Process next chapter.
  // ----------------------------------------------------------

  if (
    !isPaused &&
    isRunning
  ) {
    timer = setTimeout(
      () => {
        void processQueueStep();
      },
      300
    );
  } else {
    isRunning = false;
  }
}
