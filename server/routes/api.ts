import express from 'express';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import {
  getMangas,
  getMangaById,
  updateManga,
  setInLibrary,
  setMangaCategories,
  getChapters,
  getChapterById,
  getChapterByIndex,
  updateChapter,
  updateChapterProgress,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSources,
  getSourceById,
  getHistory,
  clearHistory,
  getStats,
  exportBackup,
  importBackup,
  getTrackers,
  setTracker,
  deleteTracker,
  addManga,
  addChapter,
  addChapters,
  deleteManga,
  deleteChapter,
  deleteChaptersBatch,
  resetDatabase,
} from '../db/store.js';
import {
  uploadImageToCloudinary,
  uploadBatchImagesToCloudinary,
  deleteImagesFromCloudinary,
  getCloudinaryStatus,
} from '../services/cloudinaryService.js';
import { exportBackupJSON, importBackupJSON } from '../services/jsonFormatterService.js';
import {
  getDownloadQueue,
  enqueueChapter,
  enqueueBatch,
  startDownloader,
  pauseDownloader,
  clearQueue,
  removeQueueItem,
  getDownloaderStatus,
} from '../services/downloadManager.js';
import { getMongoConnectionInfo } from '../db/connection.js';
import {
  getWebtoonScript,
  saveWebtoonScript,
  deleteWebtoonScript,
  getAllSavedWebtoonScripts,
} from '../db/webtoonStore.js';
import {
  generateWebtoonScript,
  generateFallbackWebtoonScript,
  extractPanelSubtitleFromImage,
  extractPanelIncidentsFromImage,
} from '../services/geminiService.js';

export const apiRouter = express.Router();

// ========================
// Source Endpoints (Local-Only)
// ========================
apiRouter.get('/source/list', async (req, res) => {
  try {
    const sources = await getSources();
    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/source/:sourceId', async (req, res) => {
  try {
    const source = await getSourceById(req.params.sourceId);
    if (!source) {
      return res.json({
        id: req.params.sourceId,
        name: 'Local Library',
        lang: 'en',
        version: '1.0.0',
        isNsfw: false,
        supportsLatest: true,
      });
    }
    res.json(source);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/source/:sourceId/popular/:pageNum?', async (req, res) => {
  try {
    const mangas = await getMangas({ inLibrary: true });
    res.json({ mangas, hasNextPage: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/source/:sourceId/latest/:pageNum?', async (req, res) => {
  try {
    const mangas = await getMangas({ inLibrary: true });
    res.json({ mangas, hasNextPage: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/source/:sourceId/search', async (req, res) => {
  try {
    const query = (req.query.query as string) || '';
    const mangas = await getMangas({ query });
    res.json({ mangas, hasNextPage: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Cloudinary Status & Upload Endpoints
// ========================
apiRouter.get('/cloudinary/status', (req, res) => {
  res.json(getCloudinaryStatus());
});

apiRouter.post('/cloudinary/upload', async (req, res) => {
  try {
    const { image, folder } = req.body;
    if (!image) return res.status(400).json({ error: 'image data is required' });
    const result = await uploadImageToCloudinary(image, folder || 'suwayomi_manga');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Manga Endpoints
// ========================
apiRouter.get('/manga', async (req, res) => {
  try {
    const inLibrary = req.query.inLibrary !== undefined ? req.query.inLibrary === 'true' : undefined;
    const sourceId = req.query.sourceId as string | undefined;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string, 10) : undefined;
    const query = req.query.query as string | undefined;

    const list = await getMangas({ inLibrary, sourceId, categoryId, query });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/manga/:mangaId', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const manga = await getMangaById(mangaId);
    if (!manga) return res.status(404).json({ error: 'Manga not found' });
    res.json(manga);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/manga/:mangaId/full', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const manga = await getMangaById(mangaId);
    if (!manga) return res.status(404).json({ error: 'Manga not found' });

    const chapters = await getChapters(mangaId);
    res.json({
      ...manga,
      chapters,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



apiRouter.get('/manga/:mangaId/chapters', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const chapters = await getChapters(mangaId);
    res.json(chapters);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function ensureChapterPages(chapter: any) {
  if (!chapter) return chapter;
  if (!chapter.pages) {
    chapter.pages = [];
  }
  return chapter;
}

apiRouter.get('/manga/:mangaId/chapter/:chapterIndex', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const chapterIndex = parseInt(req.params.chapterIndex, 10);
    let chapter = await getChapterByIndex(mangaId, chapterIndex);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    chapter = await ensureChapterPages(chapter);
    res.json(chapter);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/manga/:mangaId/chapter/:chapterIndex/page/:pageIndex', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const chapterIndex = parseInt(req.params.chapterIndex, 10);
    const pageIndex = parseInt(req.params.pageIndex, 10);

    let chapter = await getChapterByIndex(mangaId, chapterIndex);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    chapter = await ensureChapterPages(chapter);

    if (!chapter || !chapter.pages || !chapter.pages[pageIndex]) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ pageUrl: chapter.pages[pageIndex], pageIndex, totalPages: chapter.pages.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add to Library (Suwayomi accepts GET or POST)
apiRouter.get('/manga/:mangaId/library', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const updated = await setInLibrary(mangaId, true);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/manga/:mangaId/library', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    let manga = await getMangaById(mangaId);

    if (!manga && req.body && req.body.title) {
      // Manga is being added from extension browse or search
      manga = await addManga({
        ...req.body,
        id: mangaId,
        inLibrary: true,
        inLibraryAt: new Date().toISOString(),
        categories: req.body.categories || [],
      });
    } else if (manga) {
      manga = await setInLibrary(mangaId, true);
    } else {
      return res.status(404).json({ error: 'Manga not found to add to library' });
    }

    res.json(manga);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remove from Library
apiRouter.delete('/manga/:mangaId/library', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const updated = await setInLibrary(mangaId, false);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Completely Delete Manga & its Chapters & Lore
apiRouter.delete('/manga/:mangaId', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);

    // Delete all Cloudinary-hosted page/cover images before removing DB records
    try {
      const manga = await getMangaById(mangaId);
      const chapters = await getChapters(mangaId);
      const urls: (string | undefined)[] = [manga?.thumbnailUrl];
      for (const ch of chapters) {
        urls.push(...(ch.pages || []), ...((ch as any).originalPages || []));
      }
      const deleted = await deleteImagesFromCloudinary(urls);
      if (deleted > 0) console.log(`[Cloudinary] Deleted ${deleted} images for manga ${mangaId}`);
    } catch (cErr: any) {
      console.warn('[API Delete Manga] Cloudinary cleanup warning:', cErr.message || cErr);
    }

    const result = await deleteManga(mangaId);
    res.json(result);
  } catch (err: any) {
    console.error('[API Delete Manga] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update Manga Categories
apiRouter.put('/manga/:mangaId/categories', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const { categories } = req.body;
    const updated = await setMangaCategories(mangaId, categories || []);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// CBZ / Local Manga File & Chapter Upload Endpoint
// ========================
const handleUploadCbzOrChapters = async (req: any, res: any) => {
  try {
    const rawMangaId = req.params.mangaId ? parseInt(req.params.mangaId, 10) : req.body.mangaId;
    const {
      author,
      artist,
      description,
      genre,
      status,
      thumbnailUrl,
      chapters,
    } = req.body;
    let { title } = req.body;

    let targetManga: any = null;
    if (rawMangaId) {
      targetManga = await getMangaById(Number(rawMangaId));
    }

    if (!title || !title.trim()) {
      if (targetManga) {
        title = targetManga.title;
      } else {
        return res.status(400).json({ error: 'Manga title is required for new manga upload.' });
      }
    }

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({ error: 'At least one chapter with pages is required.' });
    }

    if (!targetManga) {
      // Look for existing manga by title
      const allLibrary = await getMangas({ inLibrary: true });
      targetManga = allLibrary.find((m:any) => m.title.toLowerCase().trim() === title.toLowerCase().trim());
    }

    let finalThumb = thumbnailUrl;
    if (finalThumb && (finalThumb.startsWith('data:') || finalThumb.startsWith('file:'))) {
      const uploadRes = await uploadImageToCloudinary(finalThumb, 'suwayomi_manga/covers');
      finalThumb = uploadRes.url;
    }

    if (!targetManga) {
      const allMangas = await getMangas();
      const maxId = Math.max(1000, ...allMangas.map((m:any) => m.id || 0));
      const nextId = maxId + 1;

      targetManga = await addManga({
        id: nextId,
        title: title.trim(),
        author: author || 'Local Creator',
        artist: artist || author || 'Local Creator',
        description: description || 'Uploaded local CBZ manga archive.',
        genre: Array.isArray(genre) && genre.length > 0 ? genre : ['Local CBZ', 'Manga'],
        status: status || 'Ongoing',
        thumbnailUrl: finalThumb || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600',
        inLibrary: true,
        inLibraryAt: new Date().toISOString(),
        sourceId: 'local_cbz',
        url: `/local_cbz/${nextId}`,
        categories: [1], // Default "Reading" category
        chaptersCount: 0,
        unreadCount: 0,
      });
    } else {
      // Update metadata if provided
      const updates: any = {};
      if (author) updates.author = author;
      if (artist) updates.artist = artist;
      if (description) updates.description = description;
      if (genre && genre.length > 0) updates.genre = genre;
      if (finalThumb) updates.thumbnailUrl = finalThumb;
      updates.inLibrary = true;
      updates.inLibraryAt = new Date().toISOString();
      targetManga = await updateManga(targetManga.id, updates);
    }

    // Process and add chapters with Cloudinary page upload
    const existingChapters = await getChapters(targetManga.id);
    const addedChaptersList: any[] = [];

    for (const chData of chapters) {
      const chNum = chData.chapterNumber || (existingChapters.length + addedChaptersList.length + 1);
      const chName = chData.name || `Chapter ${chNum}`;
      let rawPages: string[] = chData.pages || [];

      // Upload chapter pages to Cloudinary if they are base64 data URIs
      let hostedPages = rawPages;
      if (rawPages.length > 0 && rawPages.some((p) => p.startsWith('data:'))) {
        console.log(`[Cloudinary] Uploading ${rawPages.length} pages for ${targetManga.title} Ch.${chNum}...`);
        hostedPages = await uploadBatchImagesToCloudinary(
          rawPages,
          `suwayomi_manga/${targetManga.id}/ch_${chNum}`,
          5
        );
      }

      const chId = Math.floor(Date.now() + Math.random() * 1000000);

      // Build the panel script for every uploaded page. AI subtitles are only
      // generated when explicitly requested — otherwise a no-AI basic script is
      // created so every image becomes an editable panel.
      let generatedScript = null;
      if (hostedPages.length > 0) {
        try {
          if (req.body.autoGenerateSubtitles === true) {
            generatedScript = await generateWebtoonScript({
              mangaId: targetManga.id,
              chapterId: chId,
              mangaTitle: targetManga.title,
              chapterName: chName,
              pages: hostedPages,
            });
          } else {
            generatedScript = generateFallbackWebtoonScript({
              mangaId: targetManga.id,
              chapterId: chId,
              mangaTitle: targetManga.title,
              chapterName: chName,
              pages: hostedPages,
            });
          }
        } catch (subErr) {
          console.warn('[API Chapter Upload] Subtitle generation notice:', subErr);
        }
      }

      const newChapter = {
        id: chId,
        mangaId: targetManga.id,
        chapterNumber: chNum,
        name: chName,
        uploadDate: chData.uploadDate || new Date().toISOString(),
        read: false,
        bookmark: false,
        lastPageRead: 0,
        pageCount: hostedPages.length,
        pages: hostedPages,
        url: `/local_cbz/${targetManga.id}/chapter/${chNum}`,
        script: generatedScript,
      };

      await addChapter(newChapter);
      if (generatedScript) {
        await saveWebtoonScript(generatedScript);
      }
      addedChaptersList.push(newChapter);
    }

    // Update chapter counts on manga
    const updatedChapters = await getChapters(targetManga.id);
    const unreadCount = updatedChapters.filter((c:any) => !c.read).length;

    targetManga = await updateManga(targetManga.id, {
      chaptersCount: updatedChapters.length,
      unreadCount: unreadCount,
      thumbnailUrl: targetManga.thumbnailUrl || addedChaptersList[0]?.pages?.[0],
    });

    res.json({
      success: true,
      manga: targetManga,
      addedChapters: addedChaptersList,
    });
  } catch (err: any) {
    console.error('[API CBZ / Chapter Upload] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

apiRouter.post('/manga/upload-cbz', handleUploadCbzOrChapters);
apiRouter.post('/manga/:mangaId/chapter/upload', handleUploadCbzOrChapters);
apiRouter.post('/manga/:mangaId/chapters/upload', handleUploadCbzOrChapters);

// ========================
// Category Endpoints
// ========================
apiRouter.get('/category', async (req, res) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/category', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const created = await createCategory(name);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/category/:categoryId', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    const mangas = await getMangas({ categoryId, inLibrary: true });
    res.json(mangas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/category/:categoryId', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    const updated = await updateCategory(categoryId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/category/:categoryId', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    await deleteCategory(categoryId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Chapter Endpoints
// ========================
apiRouter.get('/chapter/:chapterId', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.chapterId, 10);
    let chapter = await getChapterById(chapterId);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    chapter = await ensureChapterPages(chapter);
    res.json(chapter);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/chapter/:chapterId/pages', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.chapterId, 10);
    let chapter = await getChapterById(chapterId);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    chapter = await ensureChapterPages(chapter);
    res.json(chapter.pages || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/chapter/:chapterId', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.chapterId, 10);
    const updated = await updateChapter(chapterId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Replace chapter pages with cropped panels and auto-sync video studio script
apiRouter.post('/chapter/:chapterId/replace-pages', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.chapterId, 10);
    const { pages, chapterName } = req.body;
    if (!Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'pages must be a non-empty array of image URLs or base64 strings' });
    }

    const chapter = await getChapterById(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const updateData: any = {
      pages,
      pageCount: pages.length,
    };
    if (chapterName) {
      updateData.name = chapterName;
    }
    // Archive original uncropped strips if not already saved
    if (!chapter.originalPages && chapter.pages && chapter.pages.length > 0) {
      updateData.originalPages = chapter.pages;
    }

    const updated = await updateChapter(chapterId, updateData);

    // Also update manga thumbnail if thumbnail is missing
    const manga = await getMangaById(chapter.mangaId);
    if (manga && (!manga.thumbnailUrl || manga.thumbnailUrl.includes('unsplash'))) {
      await updateManga(manga.id, { thumbnailUrl: pages[0] });
    }

    // Auto-generate Narrator Point-of-View video script for the new panel sequence
    if (req.body.regenerateScript !== false) {
      try {
        const generatedScript = await generateWebtoonScript({
          mangaId: chapter.mangaId,
          chapterId: chapter.id,
          mangaTitle: manga?.title || 'Webtoon',
          chapterName: chapter.name || `Chapter ${chapter.chapterNumber}`,
          pages: pages,
        });
        await saveWebtoonScript(generatedScript);
      } catch (subErr) {
        console.warn('[Replace Pages] Subtitle generation notice:', subErr);
      }
    } else {
      // No AI regen requested — preserve the user's existing script edits and just
      // remap panel images to the new pages; create a basic no-AI script if none exists.
      try {
        const existing = await getWebtoonScript(chapter.mangaId, chapter.id);
        if (existing && Array.isArray(existing.panels) && existing.panels.length > 0) {
          existing.panels = existing.panels.map((p: any, i: number) => ({
            ...p,
            pageUrl: pages[i] || pages[pages.length - 1] || p.pageUrl,
          }));
          // New pages beyond the existing panel list get their own basic panels
          for (let i = existing.panels.length; i < pages.length; i++) {
            existing.panels.push({
              panelIndex: i + 1,
              pageUrl: pages[i],
              dialogueHindi: `पृष्ठ ${i + 1} का दृश्य...`,
              dialogueEnglish: `Page ${i + 1} scene...`,
              speaker: 'सूत्रधार',
              actionDescription: 'Vertical webtoon camera scroll',
              bgmSuggestion: 'Cinematic BGM',
              sfx: 'सरसराहट',
              estimatedDurationSec: 4,
            });
          }
          existing.generatedAt = new Date().toISOString();
          await saveWebtoonScript(existing);
        } else {
          const basic = generateFallbackWebtoonScript({
            mangaId: chapter.mangaId,
            chapterId: chapter.id,
            mangaTitle: manga?.title || 'Webtoon',
            chapterName: chapter.name || `Chapter ${chapter.chapterNumber}`,
            pages,
          });
          await saveWebtoonScript(basic);
        }
      } catch (subErr) {
        console.warn('[Replace Pages] Script remap notice:', subErr);
      }
    }

    res.json({ success: true, chapter: updated });
  } catch (err: any) {
    console.error('[API Replace Pages] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/chapter/:chapterId/progress', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.chapterId, 10);
    const { lastPageRead, read } = req.body;
    const updated = await updateChapterProgress(chapterId, lastPageRead, read);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/chapter/batch', async (req, res) => {
  try {
    const { chapterIds, read, bookmark } = req.body;
    if (!Array.isArray(chapterIds)) {
      return res.status(400).json({ error: 'chapterIds must be an array' });
    }

    const updates = await Promise.all(
      chapterIds.map((id: number) => {
        const patch: any = {};
        if (read !== undefined) patch.read = read;
        if (bookmark !== undefined) patch.bookmark = bookmark;
        return updateChapter(id, patch);
      })
    );

    res.json({ updated: updates.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Single Chapter
apiRouter.delete('/chapter/:chapterId', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.chapterId, 10);

    // Delete Cloudinary-hosted page images before removing the DB record
    try {
      const chapter = await getChapterById(chapterId);
      if (chapter) {
        const urls = [...(chapter.pages || []), ...((chapter as any).originalPages || [])];
        const deleted = await deleteImagesFromCloudinary(urls);
        if (deleted > 0) console.log(`[Cloudinary] Deleted ${deleted} images for chapter ${chapterId}`);
      }
    } catch (cErr: any) {
      console.warn('[API Delete Chapter] Cloudinary cleanup warning:', cErr.message || cErr);
    }

    const result = await deleteChapter(chapterId);
    res.json(result);
  } catch (err: any) {
    console.error('[API Delete Chapter] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Chapters Batch
apiRouter.post('/chapter/delete-batch', async (req, res) => {
  try {
    const { chapterIds } = req.body;
    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      return res.status(400).json({ error: 'chapterIds array is required' });
    }

    // Delete Cloudinary-hosted page images for all chapters
    try {
      const chapters = await Promise.all(chapterIds.map((id: number) => getChapterById(Number(id))));
      const urls = chapters.flatMap((ch) =>
        ch ? [...(ch.pages || []), ...((ch as any).originalPages || [])] : []
      );
      const deleted = await deleteImagesFromCloudinary(urls);
      if (deleted > 0) console.log(`[Cloudinary] Deleted ${deleted} images for ${chapterIds.length} chapters`);
    } catch (cErr: any) {
      console.warn('[API Batch Delete Chapters] Cloudinary cleanup warning:', cErr.message || cErr);
    }

    const result = await deleteChaptersBatch(chapterIds);
    res.json(result);
  } catch (err: any) {
    console.error('[API Batch Delete Chapters] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/chapter/batch', async (req, res) => {
  try {
    const { chapterIds } = req.body;
    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      return res.status(400).json({ error: 'chapterIds array is required' });
    }

    // Delete Cloudinary-hosted page images for all chapters
    try {
      const chapters = await Promise.all(chapterIds.map((id: number) => getChapterById(Number(id))));
      const urls = chapters.flatMap((ch) =>
        ch ? [...(ch.pages || []), ...((ch as any).originalPages || [])] : []
      );
      const deleted = await deleteImagesFromCloudinary(urls);
      if (deleted > 0) console.log(`[Cloudinary] Deleted ${deleted} images for ${chapterIds.length} chapters`);
    } catch (cErr: any) {
      console.warn('[API Batch Delete Chapters] Cloudinary cleanup warning:', cErr.message || cErr);
    }

    const result = await deleteChaptersBatch(chapterIds);
    res.json(result);
  } catch (err: any) {
    console.error('[API Batch Delete Chapters] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Update / History Endpoints
// ========================
apiRouter.get('/update/recentChapters/:pageNum', async (req, res) => {
  try {
    const mangas = await getMangas({ inLibrary: true });
    const chaptersList: any[] = [];

    for (const m of mangas) {
      const chapters = await getChapters(m.id);
      for (const ch of chapters.slice(0, 2)) {
        chaptersList.push({
          chapter: ch,
          manga: m,
        });
      }
    }

    // Sort by upload date
    chaptersList.sort((a, b) => new Date(b.chapter.uploadDate).getTime() - new Date(a.chapter.uploadDate).getTime());

    res.json({
      page: parseInt(req.params.pageNum, 10) || 1,
      items: chaptersList.slice(0, 20),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/history', async (req, res) => {
  try {
    const history = await getHistory();
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/history', async (req, res) => {
  try {
    await clearHistory();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Settings & Database Endpoints
// ========================
apiRouter.get('/settings/about', async (req, res) => {
  try {
    const stats = await getStats();
    const connInfo = getMongoConnectionInfo();
    res.json({
      name: 'Suwayomi-Server',
      version: '1.0.0-ts',
      flavor: 'TypeScript / Express / React / MongoDB',
      port: 3000,
      database: { connected: connInfo.state === 'connected', status: connInfo.state },
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/database/status', async (req, res) => {
  try {
    const connInfo = getMongoConnectionInfo();
    const stats = await getStats();
    res.json({
      connected: connInfo.state === 'connected',
      status: connInfo.state,
      error: connInfo.error,
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manga Patch / Metadata edit
apiRouter.patch('/manga/:mangaId', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const updated = await updateManga(mangaId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global Search across local library
apiRouter.get('/source/globalSearch', async (req, res) => {
  try {
    const query = (req.query.query as string) || '';
    const sources = await getSources();
    const mangas = await getMangas({ query });
    const results = sources.map((src) => ({
      source: src,
      mangas: mangas || [],
    }));
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Download Manager Endpoints
// ========================
apiRouter.get('/download/queue', async (req, res) => {
  try {
    const queue = await getDownloadQueue();
    res.json(queue);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/download/status', (req, res) => {
  res.json(getDownloaderStatus());
});

apiRouter.post('/download/start', (req, res) => {
  startDownloader();
  res.json({ success: true, status: getDownloaderStatus() });
});

apiRouter.post('/download/pause', (req, res) => {
  pauseDownloader();
  res.json({ success: true, status: getDownloaderStatus() });
});

apiRouter.delete('/download/clear', async (req, res) => {
  try {
    const onlyCompleted = req.query.completed === 'true';
    await clearQueue(onlyCompleted);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/download/batch', async (req, res) => {
  try {
    const { chapterIds } = req.body;
    if (!Array.isArray(chapterIds)) {
      return res.status(400).json({ error: 'chapterIds array is required' });
    }
    const enqueued = await enqueueBatch(chapterIds);
    res.json(enqueued);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/download/:chapterId', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.chapterId, 10);
    const item = await enqueueChapter(chapterId);
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/download/:chapterId', async (req, res) => {
  try {
    const chapterId = parseInt(req.params.chapterId, 10);
    await removeQueueItem(chapterId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Trackers (AniList / MAL)
// ========================
const getTrackersHandler = async (req: any, res: any) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    if (isNaN(mangaId)) {
      return res.json([]);
    }
    const tracks = await getTrackers(mangaId);
    res.json(tracks || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

apiRouter.get('/track/:mangaId', getTrackersHandler);
apiRouter.get('/tracker/:mangaId', getTrackersHandler);
apiRouter.get('/trackers/:mangaId', getTrackersHandler);

const saveTrackerHandler = async (req: any, res: any) => {
  try {
    const mangaId = req.params?.mangaId ? parseInt(req.params.mangaId, 10) : req.body?.mangaId;
    const trackerPayload = {
      ...req.body,
      mangaId: isNaN(mangaId) ? req.body?.mangaId : mangaId,
    };
    const saved = await setTracker(trackerPayload);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

apiRouter.post('/track', saveTrackerHandler);
apiRouter.post('/tracker', saveTrackerHandler);
apiRouter.post('/trackers', saveTrackerHandler);
apiRouter.post('/track/:mangaId', saveTrackerHandler);
apiRouter.post('/tracker/:mangaId', saveTrackerHandler);

const deleteTrackerHandler = async (req: any, res: any) => {
  try {
    await deleteTracker(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

apiRouter.delete('/track/:id', deleteTrackerHandler);
apiRouter.delete('/tracker/:id', deleteTrackerHandler);
apiRouter.delete('/trackers/:id', deleteTrackerHandler);

// Backup & Export (Unified JSON Structure)
apiRouter.get('/backup/export', async (req, res) => {
  try {
    const backup = await exportBackupJSON();
    res.setHeader('Content-Disposition', 'attachment; filename=suwayomi-backup.json');
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/backup/import', async (req, res) => {
  try {
    const result = await importBackupJSON(req.body);
    res.json({ message: 'Backup successfully imported', ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Project ZIP download
apiRouter.get('/download/project-zip', (req, res) => {
  const zipPath = path.join(process.cwd(), 'public', 'suwayomi-server-typescript.zip');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'suwayomi-server-typescript.zip');
  } else {
    res.status(404).json({ error: 'Project zip file is currently being generated. Please retry shortly.' });
  }
});

// Reset / Wipe All Data
apiRouter.post('/admin/reset', async (req, res) => {
  try {
    await resetDatabase();
    res.json({ success: true, message: 'All MongoDB stored data has been removed and database reset to fresh state.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reset', async (req, res) => {
  try {
    await resetDatabase();
    res.json({ success: true, message: 'All MongoDB stored data has been removed and database reset to fresh state.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AI Webtoon Video & Story Script API
// ==========================================

// Get existing Webtoon Script for mangaId and chapterId
apiRouter.get('/ai/webtoon-script/:mangaId/:chapterId', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const chapterId = parseInt(req.params.chapterId, 10);
    const existing = await getWebtoonScript(mangaId, chapterId);
    if (!existing) {
      return res.status(404).json({ error: 'No webtoon script generated yet for this chapter.' });
    }
    res.json(existing);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Available AI Models for Subtitle & Dialogue Generation
apiRouter.get('/ai/models', (req, res) => {
  res.json({
    defaultModel: 'gemini-3.1-pro-preview',
    models: [
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro (Best AI Model)',
        description: 'Highest reasoning, cinematic Hindi & English subtitles, nuanced emotional dialogues',
        isBest: true,
        recommended: true,
      },
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        description: 'High-speed multimodal AI generation with deep thinking enabled',
        isBest: false,
        recommended: false,
      },
    ],
  });
});

// Generate or Refresh Webtoon Script for chapter using Gemini API
apiRouter.post('/ai/webtoon-script', async (req, res) => {
  try {
    const { mangaId, chapterId, mangaTitle, chapterName, pages, forceRefresh, model } = req.body;

    if (!mangaId || !chapterId) {
      return res.status(400).json({ error: 'mangaId and chapterId are required.' });
    }

    if (!forceRefresh) {
      const existing = await getWebtoonScript(mangaId, chapterId);
      if (existing) {
        return res.json(existing);
      }
    }

    let chapterPages = pages || [];
    if (chapterPages.length === 0) {
      const chapterObj = await getChapterById(chapterId);
      if (chapterObj && chapterObj.pages && chapterObj.pages.length > 0) {
        chapterPages = chapterObj.pages;
      }
    }

    const script = await generateWebtoonScript({
      mangaId,
      chapterId,
      mangaTitle: mangaTitle || 'Manga Series',
      chapterName: chapterName || `Chapter ${chapterId}`,
      pages: chapterPages,
      model,
    });

    await saveWebtoonScript(script);
    res.json(script);
  } catch (err: any) {
    console.error('[API Webtoon Script] Error generating script:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get All Saved AI Projects & Works
apiRouter.get('/ai/saved-projects', async (req, res) => {
  try {
    const projects = await getAllSavedWebtoonScripts();
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a Saved AI Project
apiRouter.delete('/ai/saved-projects/:mangaId/:chapterId', async (req, res) => {
  try {
    const mangaId = parseInt(req.params.mangaId, 10);
    const chapterId = parseInt(req.params.chapterId, 10);
    const deleted = await deleteWebtoonScript(mangaId, chapterId);
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Extract dialogue / subtitles from single panel image using Gemini Vision
apiRouter.post('/ai/extract-panel', async (req, res) => {
  try {
    const { imageUrl, mangaTitle, panelIndex, model } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required.' });
    }
    const extracted = await extractPanelSubtitleFromImage({
      imageUrl,
      mangaTitle: mangaTitle || 'Manga',
      panelIndex: panelIndex || 1,
      model,
    });
    res.json(extracted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Extract multi-scene visual incidents and subtitles from single panel image using Gemini Vision
apiRouter.post('/ai/extract-incidents', async (req, res) => {
  try {
    const { imageUrl, mangaTitle, panelIndex, model } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required.' });
    }
    const result = await extractPanelIncidentsFromImage({
      imageUrl,
      mangaTitle: mangaTitle || 'Manga',
      panelIndex: panelIndex || 1,
      model,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update custom panel dialogues or characters in Webtoon Script
apiRouter.put('/ai/webtoon-script/:mangaId/:chapterId', async (req, res) => {
  try {
    const script = req.body.script;
    if (!script) {
      return res.status(400).json({ error: 'Updated script object is required.' });
    }
    const saved = await saveWebtoonScript(script);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Free Default Audio Generator / TTS Proxy & Custom Narrator Voice Sample
apiRouter.get('/ai/voice-sample', (req, res) => {
  try {
    const audioSampleDir = path.join(process.cwd(), 'server', 'audiosample');
    const mp3Path = path.join(audioSampleDir, 'sample_narrator.mp3');

    if (!fs.existsSync(audioSampleDir)) {
      fs.mkdirSync(audioSampleDir, { recursive: true });
    }

    if (fs.existsSync(mp3Path)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.sendFile(mp3Path);
    }

    // Return 404 or a clear json if no sample file yet
    res.status(404).json({
      error: 'No sample narrator audio file uploaded yet.',
      samplePath: 'server/audiosample/sample_narrator.mp3'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Custom Narrator Voice Sample (Enforces single sample file management)
apiRouter.delete('/ai/voice-sample', (req, res) => {
  try {
    const audioSampleDir = path.join(process.cwd(), 'server', 'audiosample');
    const mp3Path = path.join(audioSampleDir, 'sample_narrator.mp3');

    if (fs.existsSync(mp3Path)) {
      fs.unlinkSync(mp3Path);
      return res.json({ status: 'ok', message: 'Custom voice sample deleted successfully.' });
    }

    res.json({ status: 'ok', message: 'No custom voice sample to delete.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload/Store Custom Narrator Sample Voice
apiRouter.post('/ai/upload-voice-sample', express.json({ limit: '15mb' }), (req, res) => {
  try {
    const { base64Audio, fileName } = req.body;
    if (!base64Audio) {
      return res.status(400).json({ error: 'base64Audio string is required.' });
    }

    const audioSampleDir = path.join(process.cwd(), 'server', 'audiosample');
    if (!fs.existsSync(audioSampleDir)) {
      fs.mkdirSync(audioSampleDir, { recursive: true });
    }

    const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const targetFile = path.join(audioSampleDir, fileName || 'sample_narrator.mp3');

    fs.writeFileSync(targetFile, buffer);
    console.log(`[Voice Sample] Custom narrator voice stored in ${targetFile}`);

    res.json({
      status: 'ok',
      message: 'Custom narrator voice sample saved successfully.',
      file: targetFile,
      url: '/api/v1/ai/voice-sample'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/ai/tts', async (req, res) => {
  try {
    const text = String(req.query.text || '').trim();
    const lang = String(req.query.lang || 'hi').trim();
    const voiceMode = String(req.query.voiceMode || 'human');

    if (voiceMode === 'sample_narrator') {
      const audioSampleDir = path.join(process.cwd(), 'server', 'audiosample');
      if (fs.existsSync(audioSampleDir)) {
        const files = fs.readdirSync(audioSampleDir);
        const sampleFile = files.find(f => f.startsWith('sample_narrator'));
        if (sampleFile) {
          const samplePath = path.join(audioSampleDir, sampleFile);
          const ext = path.extname(sampleFile).toLowerCase();
          const mimeType = ext === '.webm' ? 'audio/webm' : ext === '.wav' ? 'audio/wav' : ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg';
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return res.sendFile(samplePath);
        }
      }
    }

    if (!text) {
      return res.status(400).json({ error: 'Text query parameter is required.' });
    }

    const encodedText = encodeURIComponent(text.slice(0, 250));
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob`;

    const response = await axios.get(ttsUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(response.data));
  } catch (err: any) {
    console.warn('[API TTS] Audio proxy error:', err.message);
    res.status(500).json({ error: 'Audio synthesis error.' });
  }
});

// Purge scraped manga / reset database to start completely fresh for local uploaded CBZ manga
apiRouter.post('/admin/reset-db', async (req, res) => {
  try {
    await resetDatabase();
    res.json({ success: true, message: 'Database reset to clean state. Ready for CBZ local manga uploads.' });
  } catch (err: any) {
    console.error('[Admin Reset DB Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

