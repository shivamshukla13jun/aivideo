import {
  MangaModel,
  ChapterModel,
  CategoryModel,
  TrackerModel,
  HistoryModel,
} from './models.js';
import { deleteWebtoonScript, deleteMangaWebtoonScripts, getWebtoonScript } from './webtoonStore.js';

export const initialCategories = [
  { id: 1, name: 'Reading', order: 1, isDefault: true },
  { id: 2, name: 'Completed', order: 2, isDefault: false },
  { id: 3, name: 'Plan to Read', order: 3, isDefault: false },
];

export const initialSources = [
  {
    id: 'local_cbz',
    name: 'Local Library',
    lang: 'en',
    iconUrl: '',
    baseUrl: '',
    version: '1.0.0',
    isNsfw: false,
    supportsLatest: true,
  },
];

let isInitialized = false;

export async function initStore(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  try {
    // Ensure default library categories exist in MongoDB
    const count = await CategoryModel.countDocuments();
    if (count === 0) {
      await CategoryModel.insertMany(initialCategories);
      console.log('[Suwayomi MongoDB] Initialized default categories in database.');
    }
  } catch (err: any) {
    console.warn('[Suwayomi MongoDB] initStore notice:', err.message || err);
  }
}

// =======================
// Manga Methods (Pure MongoDB)
// =======================
export async function getMangas(filter?: {
  inLibrary?: boolean;
  categoryId?: number;
  sourceId?: string;
  query?: string;
}) {
  try {
    const q: any = {};
    if (filter?.inLibrary !== undefined) q.inLibrary = filter.inLibrary;
    if (filter?.sourceId) q.sourceId = filter.sourceId;
    if (filter?.categoryId !== undefined) q.categories = filter.categoryId;
    if (filter?.query) {
      q.$or = [
        { title: { $regex: filter.query, $options: 'i' } },
        { author: { $regex: filter.query, $options: 'i' } },
        { genre: { $regex: filter.query, $options: 'i' } },
      ];
    }
    return await MangaModel.find(q).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] getMangas error:', err.message || err);
    return [];
  }
}

export async function getMangaById(id: number) {
  try {
    return await MangaModel.findOne({ id }).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] getMangaById error:', err.message || err);
    return null;
  }
}

export async function addManga(manga: any) {
  try {
    const normalized = {
      ...manga,
      sourceId: manga.sourceId || 'local_cbz',
      categories: manga.categories || [1],
      initialized: true,
    };
    return await MangaModel.findOneAndUpdate(
      { id: normalized.id },
      { $set: normalized },
      { upsert: true, new: true }
    ).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] addManga error:', err.message || err);
    throw err;
  }
}

export async function updateManga(id: number, update: Partial<any>) {
  try {
    return await MangaModel.findOneAndUpdate(
      { id },
      { $set: update },
      { new: true }
    ).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] updateManga error:', err.message || err);
    throw err;
  }
}

export async function setInLibrary(id: number, inLibrary: boolean) {
  try {
    const patch: any = {
      inLibrary,
      inLibraryAt: inLibrary ? new Date().toISOString() : undefined,
    };
    return await MangaModel.findOneAndUpdate({ id }, { $set: patch }, { new: true }).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] setInLibrary error:', err.message || err);
    throw err;
  }
}

export async function deleteManga(id: number) {
  try {
    await Promise.all([
      MangaModel.deleteOne({ id }),
      ChapterModel.deleteMany({ mangaId: id }),
      HistoryModel.deleteMany({ mangaId: id }),
      TrackerModel.deleteMany({ mangaId: id }),
      deleteMangaWebtoonScripts(id),
    ]);
    return { success: true, mangaId: id };
  } catch (err: any) {
    console.error('[Suwayomi Store] deleteManga error:', err.message || err);
    throw err;
  }
}

export async function setMangaCategories(id: number, categories: number[]) {
  return updateManga(id, { categories });
}

// =======================
// Chapter Methods (Pure MongoDB)
// =======================
export async function getChapters(mangaId: number) {
  try {
    const chapters = await ChapterModel.find({ mangaId }).sort({ chapterNumber: -1 }).lean();
    for (const ch of chapters) {
      if (!ch.script) {
        const s = await getWebtoonScript(ch.mangaId, ch.id);
        if (s) ch.script = s;
      }
    }
    return chapters;
  } catch (err: any) {
    console.error('[Suwayomi Store] getChapters error:', err.message || err);
    return [];
  }
}

export async function getChapterById(id: number) {
  try {
    const doc = await ChapterModel.findOne({ id }).lean();
    if (doc && !doc.script) {
      const s = await getWebtoonScript(doc.mangaId, doc.id);
      if (s) doc.script = s;
    }
    return doc;
  } catch (err: any) {
    console.error('[Suwayomi Store] getChapterById error:', err.message || err);
    return null;
  }
}

export async function getChapterByIndex(mangaId: number, index: number) {
  const chapters = await getChapters(mangaId);
  return chapters[index] || null;
}

export async function addChapter(chapter: any) {
  try {
    return await ChapterModel.findOneAndUpdate(
      { id: chapter.id },
      { $set: chapter },
      { upsert: true, new: true }
    ).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] addChapter error:', err.message || err);
    throw err;
  }
}

export async function addChapters(chapters: any[]) {
  try {
    const ops = chapters.map((c) => ({
      updateOne: {
        filter: { id: c.id },
        update: { $set: c },
        upsert: true,
      },
    }));
    await ChapterModel.bulkWrite(ops);
    return chapters;
  } catch (err: any) {
    console.error('[Suwayomi Store] addChapters error:', err.message || err);
    throw err;
  }
}

export async function updateChapter(id: number, update: Partial<any>) {
  try {
    const updated = await ChapterModel.findOneAndUpdate(
      { id },
      { $set: update },
      { new: true }
    ).lean();

    if (updated) {
      // Recompute unread count on manga
      const chapters = await ChapterModel.find({ mangaId: updated.mangaId }).lean();
      const unreadCount = chapters.filter((c: any) => !c.read).length;
      await MangaModel.updateOne({ id: updated.mangaId }, { unreadCount });
    }
    return updated;
  } catch (err: any) {
    console.error('[Suwayomi Store] updateChapter error:', err.message || err);
    throw err;
  }
}

export async function updateChapterProgress(chapterId: number, lastPageRead: number, read?: boolean) {
  try {
    const chapter = await getChapterById(chapterId);
    if (!chapter) return null;

    const totalPages = chapter.pageCount || (chapter.pages?.length || 1);
    const isNowRead = read !== undefined ? read : lastPageRead >= totalPages - 1;

    const patch: any = {
      lastPageRead,
      read: isNowRead,
    };

    const updated = await updateChapter(chapterId, patch);

    // Record reading history in MongoDB
    await recordHistory(chapter.mangaId, chapterId, lastPageRead);

    // Update manga lastReadAt
    await MangaModel.updateOne({ id: chapter.mangaId }, { lastReadAt: new Date() });

    return updated;
  } catch (err: any) {
    console.error('[Suwayomi Store] updateChapterProgress error:', err.message || err);
    throw err;
  }
}

export async function deleteChapter(id: number) {
  try {
    await ChapterModel.deleteOne({ id });
    await deleteWebtoonScript(0, id);
    return true;
  } catch (err: any) {
    console.error('[Suwayomi Store] deleteChapter error:', err.message || err);
    return false;
  }
}

export async function deleteChaptersBatch(chapterIds: number[]) {
  try {
    await ChapterModel.deleteMany({ id: { $in: chapterIds } });
    return true;
  } catch (err: any) {
    console.error('[Suwayomi Store] deleteChaptersBatch error:', err.message || err);
    return false;
  }
}

// =======================
// Category Methods (Pure MongoDB)
// =======================
export async function getCategories() {
  try {
    const docs = await CategoryModel.find().sort({ order: 1 }).lean();
    if (docs.length === 0) {
      await CategoryModel.insertMany(initialCategories);
      return initialCategories;
    }
    return docs;
  } catch (err: any) {
    console.error('[Suwayomi Store] getCategories error:', err.message || err);
    return initialCategories;
  }
}

export async function createCategory(name: string) {
  try {
    const categories = await CategoryModel.find().lean();
    const nextId = categories.length > 0 ? Math.max(...categories.map((c: any) => c.id)) + 1 : 1;
    const nextOrder = categories.length > 0 ? Math.max(...categories.map((c: any) => c.order)) + 1 : 1;

    const newCat = {
      id: nextId,
      name,
      order: nextOrder,
      isDefault: false,
    };

    return await CategoryModel.create(newCat);
  } catch (err: any) {
    console.error('[Suwayomi Store] createCategory error:', err.message || err);
    throw err;
  }
}

export async function updateCategory(id: number, update: Partial<any>) {
  try {
    return await CategoryModel.findOneAndUpdate({ id }, { $set: update }, { new: true }).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] updateCategory error:', err.message || err);
    throw err;
  }
}

export async function deleteCategory(id: number) {
  try {
    await CategoryModel.deleteOne({ id });
    // Remove category from manga categories arrays
    await MangaModel.updateMany({ categories: id }, { $pull: { categories: id } });
    return true;
  } catch (err: any) {
    console.error('[Suwayomi Store] deleteCategory error:', err.message || err);
    return false;
  }
}

// =======================
// Source Helper (Local Only)
// =======================
export async function getSources() {
  return initialSources;
}

export async function getSourceById(id: string) {
  return initialSources.find((s) => s.id === id) || initialSources[0];
}

// =======================
// History Methods (Pure MongoDB)
// =======================
export async function getHistory() {
  try {
    const items = await HistoryModel.find().sort({ readAt: -1 }).limit(50).lean();

    // Enrich with manga & chapter metadata
    return await Promise.all(
      items.map(async (h: any) => {
        const manga = await getMangaById(h.mangaId);
        const chapter = await getChapterById(h.chapterId);
        return {
          id: `${h.mangaId}-${h.chapterId}`,
          mangaId: h.mangaId,
          chapterId: h.chapterId,
          mangaTitle: manga?.title || 'Unknown Manga',
          mangaThumbnail: manga?.thumbnailUrl || '',
          chapterName: chapter?.name || `Chapter ${chapter?.chapterNumber || ''}`,
          chapterNumber: chapter?.chapterNumber || 0,
          readAt: h.readAt,
          lastPageRead: h.lastPageRead || 0,
          pageCount: chapter?.pageCount || 1,
        };
      })
    );
  } catch (err: any) {
    console.error('[Suwayomi Store] getHistory error:', err.message || err);
    return [];
  }
}

export async function recordHistory(mangaId: number, chapterId: number, lastPageRead: number) {
  try {
    await HistoryModel.findOneAndUpdate(
      { mangaId, chapterId },
      { $set: { readAt: new Date(), lastPageRead } },
      { upsert: true }
    );
  } catch (err: any) {
    console.warn('[Suwayomi Store] recordHistory error:', err.message || err);
  }
}

export async function clearHistory() {
  try {
    await HistoryModel.deleteMany({});
    return true;
  } catch (err: any) {
    console.error('[Suwayomi Store] clearHistory error:', err.message || err);
    return false;
  }
}

// =======================
// Trackers (Pure MongoDB)
// =======================
export async function getTrackers(mangaId: number) {
  try {
    return await TrackerModel.find({ mangaId: Number(mangaId) }).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] getTrackers error:', err.message || err);
    return [];
  }
}

export async function setTracker(trackerData: any) {
  try {
    const mangaId = Number(trackerData.mangaId);
    const service = trackerData.trackerService || trackerData.service || 'AniList';
    const id = trackerData.id || `track-${mangaId}-${service.toLowerCase()}`;

    const normalized = {
      ...trackerData,
      id,
      mangaId,
      trackerService: service,
      remoteId: trackerData.remoteId || `remote-${Date.now()}`,
      title: trackerData.title || '',
      status: trackerData.status || 'reading',
      score: Number(trackerData.score) || 0,
      lastChapterRead: Number(trackerData.lastChapterRead) || 0,
      totalChapters: Number(trackerData.totalChapters) || 0,
    };

    return await TrackerModel.findOneAndUpdate(
      { mangaId, trackerService: service },
      { $set: normalized },
      { upsert: true, new: true }
    ).lean();
  } catch (err: any) {
    console.error('[Suwayomi Store] setTracker error:', err.message || err);
    throw err;
  }
}

export async function deleteTracker(id: string) {
  try {
    await TrackerModel.deleteOne({ id });
    return true;
  } catch (err: any) {
    console.error('[Suwayomi Store] deleteTracker error:', err.message || err);
    return false;
  }
}

// =======================
// Stats, Backup & Reset (Pure MongoDB)
// =======================
export async function getStats() {
  try {
    const [mangaCount, chapterCount, categoryCount, historyCount] = await Promise.all([
      MangaModel.countDocuments(),
      ChapterModel.countDocuments(),
      CategoryModel.countDocuments(),
      HistoryModel.countDocuments(),
    ]);
    return { mangaCount, chapterCount, categoryCount, historyCount };
  } catch {
    return { mangaCount: 0, chapterCount: 0, categoryCount: 0, historyCount: 0 };
  }
}

export async function exportBackup() {
  const [mangas, chapters, categories, history, trackers] = await Promise.all([
    MangaModel.find().lean(),
    ChapterModel.find().lean(),
    CategoryModel.find().lean(),
    HistoryModel.find().lean(),
    TrackerModel.find().lean(),
  ]);

  return {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    mangas,
    chapters,
    categories,
    history,
    trackers,
  };
}

export async function importBackup(data: any) {
  try {
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      await CategoryModel.deleteMany({});
      await CategoryModel.insertMany(data.categories);
    }
    if (Array.isArray(data.mangas) && data.mangas.length > 0) {
      for (const m of data.mangas) {
        await MangaModel.findOneAndUpdate({ id: m.id }, { $set: m }, { upsert: true });
      }
    }
    if (Array.isArray(data.chapters) && data.chapters.length > 0) {
      for (const c of data.chapters) {
        await ChapterModel.findOneAndUpdate({ id: c.id }, { $set: c }, { upsert: true });
      }
    }
    if (Array.isArray(data.history) && data.history.length > 0) {
      await HistoryModel.deleteMany({});
      await HistoryModel.insertMany(data.history);
    }
    return true;
  } catch (err: any) {
    console.error('[Suwayomi Store] importBackup error:', err.message || err);
    return false;
  }
}

export async function resetDatabase() {
  try {
    await Promise.all([
      MangaModel.deleteMany({}),
      ChapterModel.deleteMany({}),
      CategoryModel.deleteMany({}),
      TrackerModel.deleteMany({}),
      HistoryModel.deleteMany({}),
    ]);
    await CategoryModel.insertMany(initialCategories);
    return true;
  } catch (err: any) {
    console.error('[Suwayomi Store] resetDatabase error:', err.message || err);
    throw err;
  }
}
