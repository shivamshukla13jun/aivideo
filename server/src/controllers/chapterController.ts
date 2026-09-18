import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { Chapter } from '../../src/types/index';

export const getChaptersBySeries = async (req: AuthRequest, res: Response) => {
  const { seriesId } = req.params;
  const chapters = Array.from(db.chapters.values())
    .filter((ch) => ch.seriesId === seriesId)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  return res.json(chapters);
};

export const getChapterById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const chapter = db.chapters.get(id);
  if (!chapter) {
    return res.status(404).json({ message: 'Chapter not found' });
  }

  const pages = (db.pages.get(id) || []).sort((a, b) => a.pageNumber - b.pageNumber);
  const scenes = (db.scenes.get(id) || []).sort((a, b) => a.order - b.order);
  const story = db.stories.get(id) || null;
  const narrations = db.narrations.get(id) || [];

  return res.json({
    ...chapter,
    pages,
    scenes,
    story,
    narrations
  });
};

export const createChapter = async (req: AuthRequest, res: Response) => {
  const { seriesId, title, chapterNumber } = req.body;
  if (!seriesId || !title) {
    return res.status(400).json({ message: 'seriesId and title are required' });
  }

  const existingChapters = Array.from(db.chapters.values()).filter((ch) => ch.seriesId === seriesId);
  const num = chapterNumber || existingChapters.length + 1;

  const newChapter: Chapter = {
    id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    seriesId,
    chapterNumber: num,
    title,
    status: 'unread',
    readingProgress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.chapters.set(newChapter.id, newChapter);
  return res.status(201).json(newChapter);
};

export const updateChapter = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const chapter = db.chapters.get(id);
  if (!chapter) {
    return res.status(404).json({ message: 'Chapter not found' });
  }

  const updated: Chapter = {
    ...chapter,
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  db.chapters.set(id, updated);
  return res.json(updated);
};

export const deleteChapter = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!db.chapters.has(id)) {
    return res.status(404).json({ message: 'Chapter not found' });
  }

  db.chapters.delete(id);
  db.pages.delete(id);
  db.scenes.delete(id);
  db.stories.delete(id);
  db.narrations.delete(id);

  return res.json({ message: 'Chapter deleted successfully' });
};
