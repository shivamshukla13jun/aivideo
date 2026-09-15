import { DownloadQueueModel, ChapterModel, MangaModel } from '../db/models.js';
import { isMongoActive } from '../db/connection.js';
import { getChapterById, getMangaById, updateChapter } from '../db/store.js';

export interface DownloadQueueItem {
  id: string;
  chapterId: number;
  mangaId: number;
  mangaTitle: string;
  mangaThumbnail: string;
  chapterName: string;
  chapterNumber: number;
  progress: number;
  status: 'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'DOWNLOADED' | 'ERROR';
  pagesDownloaded: number;
  totalPages: number;
  error?: string;
}

let queue: DownloadQueueItem[] = [];
let isRunning = false;
let isPaused = false;
let timer: NodeJS.Timeout | null = null;

export async function getDownloadQueue(): Promise<DownloadQueueItem[]> {
  if (isMongoActive()) {
    try {
      const docs = await DownloadQueueModel.find({}).lean();
      if (docs && docs.length > 0) {
        return docs.map((d: any) => ({
          ...d,
          id: d._id ? d._id.toString() : String(d.chapterId),
        }));
      }
    } catch (e) {
      console.warn('[DownloadManager] Mongo queue fetch error:', e);
    }
  }
  return queue;
}

export async function enqueueChapter(chapterId: number): Promise<DownloadQueueItem> {
  const existing = queue.find((item) => item.chapterId === chapterId);
  if (existing) return existing;

  const chapter = await getChapterById(chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const manga = await getMangaById(chapter.mangaId);
  const totalPages = chapter.pages?.length || chapter.pageCount || 10;

  const newItem: DownloadQueueItem = {
    id: `dl-${chapterId}-${Date.now()}`,
    chapterId,
    mangaId: chapter.mangaId,
    mangaTitle: manga?.title || 'Unknown Manga',
    mangaThumbnail: manga?.thumbnailUrl || '',
    chapterName: chapter.name,
    chapterNumber: chapter.chapterNumber,
    progress: 0,
    status: 'QUEUED',
    pagesDownloaded: 0,
    totalPages,
  };

  queue.push(newItem);

  if (isMongoActive()) {
    try {
      await DownloadQueueModel.findOneAndUpdate(
        { chapterId },
        { $set: newItem },
        { upsert: true }
      );
    } catch (e) {}
  }

  // Auto-start worker if not paused
  if (!isPaused && !isRunning) {
    startDownloader();
  }

  return newItem;
}

export async function enqueueBatch(chapterIds: number[]): Promise<DownloadQueueItem[]> {
  const added: DownloadQueueItem[] = [];
  for (const chId of chapterIds) {
    try {
      const item = await enqueueChapter(chId);
      added.push(item);
    } catch (e) {}
  }
  return added;
}

export function startDownloader() {
  isPaused = false;
  if (isRunning) return;
  isRunning = true;
  processQueueStep();
}

export function pauseDownloader() {
  isPaused = true;
  isRunning = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  // Set current downloading items to PAUSED
  for (const item of queue) {
    if (item.status === 'DOWNLOADING') {
      item.status = 'PAUSED';
    }
  }
}

export async function clearQueue(onlyCompleted = false): Promise<void> {
  if (onlyCompleted) {
    queue = queue.filter((item) => item.status !== 'DOWNLOADED');
    if (isMongoActive()) {
      try {
        await DownloadQueueModel.deleteMany({ status: 'DOWNLOADED' });
      } catch (e) {}
    }
  } else {
    queue = [];
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    isRunning = false;
    if (isMongoActive()) {
      try {
        await DownloadQueueModel.deleteMany({});
      } catch (e) {}
    }
  }
}

export async function removeQueueItem(chapterId: number): Promise<void> {
  queue = queue.filter((item) => item.chapterId !== chapterId);
  if (isMongoActive()) {
    try {
      await DownloadQueueModel.deleteOne({ chapterId });
    } catch (e) {}
  }
}

export function getDownloaderStatus() {
  return {
    isRunning,
    isPaused,
    queueLength: queue.length,
    activeCount: queue.filter((item) => item.status === 'DOWNLOADING').length,
    completedCount: queue.filter((item) => item.status === 'DOWNLOADED').length,
  };
}

async function processQueueStep() {
  if (isPaused) {
    isRunning = false;
    return;
  }

  const nextItem = queue.find((item) => item.status === 'QUEUED' || item.status === 'DOWNLOADING');
  if (!nextItem) {
    isRunning = false;
    return;
  }

  nextItem.status = 'DOWNLOADING';
  nextItem.pagesDownloaded += 1;
  nextItem.progress = Math.min(100, Math.round((nextItem.pagesDownloaded / nextItem.totalPages) * 100));

  if (nextItem.pagesDownloaded >= nextItem.totalPages) {
    nextItem.status = 'DOWNLOADED';
    nextItem.progress = 100;

    // Mark chapter as downloaded in store
    try {
      await updateChapter(nextItem.chapterId, { fetchedAt: new Date().toISOString() });
    } catch (e) {}
  }

  if (isMongoActive()) {
    try {
      await DownloadQueueModel.updateOne(
        { chapterId: nextItem.chapterId },
        {
          $set: {
            status: nextItem.status,
            progress: nextItem.progress,
            pagesDownloaded: nextItem.pagesDownloaded,
          },
        }
      );
    } catch (e) {}
  }

  // Pace download steps realistic simulation
  timer = setTimeout(processQueueStep, 600);
}
