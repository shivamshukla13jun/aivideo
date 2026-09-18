import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { cloudinaryService } from '../services/cloudinaryService';
import { Asset } from '../../src/types/index';

export const getAssets = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId || 'usr_demo123';
  const assets = db.assets.get(userId) || [];
  return res.json(assets);
};

export const createAsset = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId || 'usr_demo123';
    const { title, type, fileUrl, duration, width, height } = req.body;

    if (!title || !type || !fileUrl) {
      return res.status(400).json({ message: 'title, type, and fileUrl are required' });
    }

    const uploadResult = await cloudinaryService.uploadMedia(
      fileUrl,
      `assets/${userId}`,
      type === 'video' ? 'video' : type === 'audio' || type === 'narration' || type === 'music' || type === 'sfx' ? 'raw' : 'image'
    );

    const newAsset: Asset = {
      id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      userId,
      title,
      type,
      url: uploadResult.url,
      cloudinaryPublicId: uploadResult.publicId,
      duration: duration || 0,
      width,
      height,
      createdAt: new Date().toISOString()
    };

    const existing = db.assets.get(userId) || [];
    db.assets.set(userId, [...existing, newAsset]);

    return res.status(201).json(newAsset);
  } catch (err: any) {
    console.error('Asset creation error:', err);
    return res.status(500).json({ message: err.message || 'Asset upload failed' });
  }
};

export const deleteAsset = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId || 'usr_demo123';
  const { id } = req.params;

  const existing = db.assets.get(userId) || [];
  const target = existing.find((a) => a.id === id);

  if (!target) {
    return res.status(404).json({ message: 'Asset not found' });
  }

  if (target.cloudinaryPublicId) {
    await cloudinaryService.deleteMedia(target.cloudinaryPublicId);
  }

  const filtered = existing.filter((a) => a.id !== id);
  db.assets.set(userId, filtered);

  return res.json({ message: 'Asset deleted successfully' });
};
