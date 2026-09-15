import { WebtoonScript } from '../../src/types.js';
import { ChapterModel } from './models.js';

export function getWebtoonScriptKey(mangaId: number, chapterId: number): string {
  return `${mangaId}_${chapterId}`;
}

/**
 * Get Webtoon Script for chapter directly from Chapter document in MongoDB
 */
export async function getWebtoonScript(
  mangaId: number,
  chapterId: number
): Promise<WebtoonScript | null> {
  try {
    const chapter = await ChapterModel.findOne({ id: chapterId }).lean();
    if (chapter && (chapter as any).script) {
      return (chapter as any).script as WebtoonScript;
    }
  } catch (err) {
    console.warn('[Webtoon Store] Mongo query error in getWebtoonScript:', err);
  }
  return null;
}

/**
 * Save Webtoon Script directly into Chapter document script field in MongoDB
 */
export async function saveWebtoonScript(
  script: WebtoonScript
): Promise<WebtoonScript> {
  try {
    await ChapterModel.findOneAndUpdate(
      { id: script.chapterId },
      { $set: { script: script } },
      { upsert: false }
    );
    console.log(`[Webtoon Store] Saved script for chapter ${script.chapterId} in ChapterModel.`);
  } catch (err) {
    console.warn('[Webtoon Store] Mongo save error in saveWebtoonScript:', err);
  }
  return script;
}

/**
 * Delete Webtoon Script from Chapter document in MongoDB
 */
export async function deleteWebtoonScript(
  mangaId: number,
  chapterId: number
): Promise<boolean> {
  try {
    const res = await ChapterModel.updateOne(
      { id: chapterId },
      { $unset: { script: 1 } }
    );
    return (res.modifiedCount || 0) > 0;
  } catch (err) {
    console.warn('[Webtoon Store] Mongo delete error in deleteWebtoonScript:', err);
    return false;
  }
}

/**
 * Delete all scripts for a given mangaId in MongoDB
 */
export async function deleteMangaWebtoonScripts(mangaId: number): Promise<number> {
  try {
    const res = await ChapterModel.updateMany(
      { mangaId },
      { $unset: { script: 1 } }
    );
    return res.modifiedCount || 0;
  } catch (err) {
    console.warn('[Webtoon Store] Mongo bulk delete error:', err);
    return 0;
  }
}

/**
 * Fetch all saved webtoon scripts across all chapters in MongoDB
 */
export async function getAllSavedWebtoonScripts(): Promise<WebtoonScript[]> {
  try {
    const chaptersWithScript = await ChapterModel.find({
      script: { $exists: true, $ne: null }
    }).lean();

    if (chaptersWithScript && chaptersWithScript.length > 0) {
      return chaptersWithScript
        .map((ch: any) => ch.script as WebtoonScript)
        .filter(Boolean)
        .sort(
          (a, b) => new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime()
        );
    }
  } catch (err) {
    console.warn('[Webtoon Store] Mongo query error in getAllSavedWebtoonScripts:', err);
  }
  return [];
}
