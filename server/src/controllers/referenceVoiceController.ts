import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { cloudinaryService } from '../services/cloudinaryService';
import { ReferenceVoice } from '../../src/types/index';

export const getReferenceVoice = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId || 'usr_demo123';
  const user = db.users.get(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({ referenceVoice: user.referenceVoice || null });
};

export const setReferenceVoice = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId || 'usr_demo123';
    const { audioUrl, provider, voiceId, name } = req.body;
    const file = req.file;

    if (!audioUrl && !file) {
      return res.status(400).json({ message: 'An uploaded audio file or audioUrl is required' });
    }

    const user = db.users.get(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // STRICT RULE: If user already has a reference voice, delete previous Cloudinary asset first!
    if (user.referenceVoice && user.referenceVoice.cloudinaryPublicId) {
      await cloudinaryService.deleteMedia(user.referenceVoice.cloudinaryPublicId);
    }

    // Upload new reference to Cloudinary (uploaded file buffer takes priority over URL)
    const uploadResult = file
      ? await cloudinaryService.uploadMedia(file.buffer, `voices/${userId}`, 'raw', file.originalname)
      : await cloudinaryService.uploadMedia(audioUrl, `voices/${userId}`, 'raw');

    const newVoice: ReferenceVoice = {
      id: `vce_${Date.now()}`,
      userId,
      audioUrl: uploadResult.url,
      cloudinaryPublicId: uploadResult.publicId,
      provider: provider || 'custom',
      voiceId: voiceId || `voice_${Date.now()}`,
      name: name || 'Primary Reference Voice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Enforce ONE and ONLY ONE reference voice on user
    user.referenceVoice = newVoice;
    user.updatedAt = new Date().toISOString();
    db.users.set(userId, user);
    db.saveToDisk();

    return res.status(200).json({ referenceVoice: newVoice });
  } catch (err: any) {
    console.error('Reference voice upload error:', err);
    return res.status(500).json({ message: err.message || 'Voice upload failed' });
  }
};

export const deleteReferenceVoice = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId || 'usr_demo123';
  const user = db.users.get(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.referenceVoice) {
    if (user.referenceVoice.cloudinaryPublicId) {
      await cloudinaryService.deleteMedia(user.referenceVoice.cloudinaryPublicId);
    }
    user.referenceVoice = null;
    user.updatedAt = new Date().toISOString();
    db.users.set(userId, user);
  }

  return res.json({ message: 'Reference voice deleted successfully' });
};
