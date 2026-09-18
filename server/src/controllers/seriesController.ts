import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { Series } from '../../src/types/index';

export const getSeriesList = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId || 'usr_demo123';
  const allSeries = Array.from(db.series.values()).filter((s) => s.createdBy === userId || true); // return user or demo series

  // Attach chapter count
  const seriesWithCount = allSeries.map((s) => {
    const chapters = Array.from(db.chapters.values()).filter((ch) => ch.seriesId === s.id);
    return { ...s, chapterCount: chapters.length };
  });

  return res.json(seriesWithCount);
};

export const getSeriesById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const series = db.series.get(id);
  if (!series) {
    return res.status(404).json({ message: 'Series not found' });
  }

  const chapters = Array.from(db.chapters.values())
    .filter((ch) => ch.seriesId === id)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  return res.json({ series, chapters });
};

export const createSeries = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId || 'usr_demo123';
  const { title, description, coverImage, author, genres, status } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const newSeries: Series = {
    id: `srs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title,
    description: description || '',
    coverImage: coverImage || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&q=80',
    author: author || 'Unknown Author',
    genres: genres || ['Action', 'Webtoon'],
    status: status || 'ongoing',
    createdBy: userId,
    chapterCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.series.set(newSeries.id, newSeries);
  return res.status(201).json(newSeries);
};

export const updateSeries = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const series = db.series.get(id);
  if (!series) {
    return res.status(404).json({ message: 'Series not found' });
  }

  const updated: Series = {
    ...series,
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  db.series.set(id, updated);
  return res.json(updated);
};

export const deleteSeries = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!db.series.has(id)) {
    return res.status(404).json({ message: 'Series not found' });
  }

  db.series.delete(id);
  return res.json({ message: 'Series deleted successfully' });
};
