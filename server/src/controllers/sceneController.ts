import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { aiService } from '../services/aiService';
import { Scene } from '../../src/types/index';

export const getScenesByChapter = async (req: AuthRequest, res: Response) => {
  const { chapterId } = req.params;
  const scenes = (db.scenes.get(chapterId) || []).sort((a, b) => a.order - b.order);
  return res.json(scenes);
};

export const createScene = async (req: AuthRequest, res: Response) => {
  const { chapterId, pageId, sceneNumber, characters, narration, dialogue, emotion, duration } = req.body;
  if (!chapterId || !pageId) {
    return res.status(400).json({ message: 'chapterId and pageId are required' });
  }

  const existing = db.scenes.get(chapterId) || [];
  const num = sceneNumber || existing.length + 1;

  const newScene: Scene = {
    id: `scn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    chapterId,
    pageId,
    sceneNumber: num,
    characters: characters || [],
    narration: narration || '',
    dialogue: dialogue || '',
    emotion: emotion || 'Neutral',
    duration: duration || 5,
    order: existing.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.scenes.set(chapterId, [...existing, newScene]);

  // Update chapter status
  const chapter = db.chapters.get(chapterId);
  if (chapter && chapter.status === 'reading') {
    db.chapters.set(chapterId, { ...chapter, status: 'script-draft', updatedAt: new Date().toISOString() });
  }

  return res.status(201).json(newScene);
};

export const updateScene = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { chapterId } = req.body;

  let foundScene: Scene | null = null;
  let targetChapterId = chapterId;

  if (!targetChapterId) {
    // Search across chapters
    for (const [chId, scnList] of db.scenes.entries()) {
      const match = scnList.find((s) => s.id === id);
      if (match) {
        foundScene = match;
        targetChapterId = chId;
        break;
      }
    }
  } else {
    const list = db.scenes.get(targetChapterId) || [];
    foundScene = list.find((s) => s.id === id) || null;
  }

  if (!foundScene || !targetChapterId) {
    return res.status(404).json({ message: 'Scene not found' });
  }

  const updatedScene: Scene = {
    ...foundScene,
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  const list = db.scenes.get(targetChapterId) || [];
  const updatedList = list.map((s) => (s.id === id ? updatedScene : s));
  db.scenes.set(targetChapterId, updatedList);

  return res.json(updatedScene);
};

export const deleteScene = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  for (const [chId, scnList] of db.scenes.entries()) {
    if (scnList.some((s) => s.id === id)) {
      const filtered = scnList.filter((s) => s.id !== id);
      db.scenes.set(chId, filtered);
      return res.json({ message: 'Scene deleted successfully' });
    }
  }

  return res.status(404).json({ message: 'Scene not found' });
};

export const reorderScenes = async (req: AuthRequest, res: Response) => {
  const { chapterId, scenes } = req.body;
  if (!chapterId || !Array.isArray(scenes)) {
    return res.status(400).json({ message: 'chapterId and scenes array required' });
  }

  db.scenes.set(chapterId, scenes);
  return res.json({ message: 'Scenes reordered successfully', scenes });
};

/**
 * AI extraction: OCR a comic page image with Gemini and return a Hindi scene
 * script (characters, narration, dialogue, emotion, duration).
 */
export const aiExtractScene = async (req: AuthRequest, res: Response) => {
  const { imageUrl, pageId } = req.body;

  let resolvedUrl = imageUrl;
  if (!resolvedUrl && pageId) {
    for (const pages of db.pages.values()) {
      const match = pages.find((p) => p.id === pageId);
      if (match) {
        resolvedUrl = match.imageUrl;
        break;
      }
    }
  }

  if (!resolvedUrl) {
    return res.status(400).json({ message: 'imageUrl or pageId is required' });
  }

  try {
    const extracted = await aiService.extractSceneFromImage(resolvedUrl);
    return res.json(extracted);
  } catch (err: any) {
    console.error('AI scene extraction error:', err);
    return res.status(500).json({ message: err.message || 'AI extraction failed' });
  }
};
