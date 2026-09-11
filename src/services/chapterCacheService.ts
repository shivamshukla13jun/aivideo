import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { ChapterGeneratedModel, IChapterGeneratedDoc } from '../db/models/ChapterGeneratedData';
import { connectDB, isDBConnected } from '../db/connection';

export interface ChapterCachePayload {
  chapterId: string | number;
  mangaId: string | number;
  mangaTitle: string;
  chapterName: string;
  title: string;
  description: string;
  chapterSummary: string;
  totalPanels: number;
  scenes: any[];
  panelCaptions?: Record<string, string>;
  characters?: any[];
  unresolvedMysteries?: string[];
}

export class ChapterCacheService {
  private chapterDir: string;

  constructor() {
    this.chapterDir = path.join(config.storageDir, 'memory', 'chapters');
    if (!fs.existsSync(this.chapterDir)) {
      fs.mkdirSync(this.chapterDir, { recursive: true });
    }
  }

  private getDiskFilePath(chapterId: string | number): string {
    const cleanId = String(chapterId).replace(/[^a-z0-9_-]/gi, '_');
    return path.join(this.chapterDir, `${cleanId}_cache.json`);
  }

  /**
   * Save or update complete generated chapter scenes and subtitles in MongoDB + disk backup
   */
  async saveChapterData(payload: ChapterCachePayload): Promise<any> {
    const chapterId = String(payload.chapterId);
    const mangaId = String(payload.mangaId);

    const docData = {
      chapterId,
      mangaId,
      mangaTitle: payload.mangaTitle,
      chapterName: payload.chapterName,
      title: payload.title,
      description: payload.description,
      chapterSummary: payload.chapterSummary,
      totalPanels: payload.totalPanels,
      scenes: payload.scenes,
      panelCaptions: payload.panelCaptions || {},
      characters: payload.characters || [],
      unresolvedMysteries: payload.unresolvedMysteries || [],
    };

    // 1. Save to MongoDB
    try {
      if (!isDBConnected()) {
        await connectDB();
      }

      await ChapterGeneratedModel.findOneAndUpdate(
        { chapterId },
        { $set: docData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`[ChapterCache] Successfully saved chapter ${chapterId} (${payload.chapterName}) in MongoDB.`);
    } catch (dbErr) {
      console.warn(`[ChapterCache] MongoDB save warning for chapter ${chapterId}:`, dbErr);
    }

    // 2. Save disk backup for resilience
    try {
      const diskPath = this.getDiskFilePath(chapterId);
      fs.writeFileSync(diskPath, JSON.stringify({ ...docData, savedAt: new Date().toISOString() }, null, 2), 'utf8');
      console.log(`[ChapterCache] Saved disk backup at: ${diskPath}`);
    } catch (diskErr) {
      console.warn(`[ChapterCache] Disk backup write error:`, diskErr);
    }

    return docData;
  }

  /**
   * Retrieve cached chapter generation data to prevent redundant Gemini API calls
   */
  async getChapterData(chapterId: string | number, mangaId?: string | number): Promise<any | null> {
    const strChapterId = String(chapterId).trim();
    if (!strChapterId) return null;

    // 1. Try MongoDB
    try {
      if (!isDBConnected()) {
        await connectDB();
      }

      const query: any = { chapterId: strChapterId };
      if (mangaId) {
        query.mangaId = String(mangaId);
      }

      const doc = await ChapterGeneratedModel.findOne(query).lean();
      if (doc && doc.scenes && doc.scenes.length > 0) {
        console.log(`[ChapterCache] Found cached data for chapter ${strChapterId} in MongoDB.`);
        return {
          chapterId: doc.chapterId,
          mangaId: doc.mangaId,
          mangaTitle: doc.mangaTitle,
          chapterName: doc.chapterName,
          title: doc.title,
          description: doc.description,
          chapterSummary: doc.chapterSummary,
          totalPanels: doc.totalPanels || doc.scenes.length,
          scenes: doc.scenes,
          panelCaptions: doc.panelCaptions || {},
          characters: doc.characters || [],
          unresolvedMysteries: doc.unresolvedMysteries || [],
          updatedAt: (doc.updatedAt ? new Date(doc.updatedAt) : new Date()).toISOString(),
          source: 'mongodb',
        };
      }
    } catch (dbErr) {
      console.warn(`[ChapterCache] MongoDB fetch warning for chapter ${strChapterId}:`, dbErr);
    }

    // 2. Try disk backup
    try {
      const diskPath = this.getDiskFilePath(strChapterId);
      if (fs.existsSync(diskPath)) {
        const raw = fs.readFileSync(diskPath, 'utf8');
        const data = JSON.parse(raw);
        if (data && data.scenes && data.scenes.length > 0) {
          console.log(`[ChapterCache] Found cached data for chapter ${strChapterId} in disk backup.`);
          return { ...data, source: 'disk' };
        }
      }
    } catch (diskErr) {
      console.warn(`[ChapterCache] Disk backup read error:`, diskErr);
    }

    return null;
  }

  /**
   * Delete cached chapter generation data
   */
  async deleteChapterData(chapterId: string | number): Promise<boolean> {
    const strChapterId = String(chapterId).trim();
    try {
      if (!isDBConnected()) {
        await connectDB();
      }
      await ChapterGeneratedModel.deleteOne({ chapterId: strChapterId });
    } catch (dbErr) {
      console.warn('[ChapterCache] Error deleting from MongoDB:', dbErr);
    }

    try {
      const diskPath = this.getDiskFilePath(strChapterId);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch (diskErr) {
      console.warn('[ChapterCache] Error deleting disk cache:', diskErr);
    }

    return true;
  }
}

export const chapterCacheService = new ChapterCacheService();
