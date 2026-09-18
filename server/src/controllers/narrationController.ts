import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { ttsService } from '../services/ttsService';
import { cloudinaryService } from '../services/cloudinaryService';
import { GeneratedNarration } from '../../src/types/index';

export const getNarrationsByChapter = async (req: AuthRequest, res: Response) => {
  const { chapterId } = req.params;
  const narrations = db.narrations.get(chapterId) || [];
  return res.json(narrations);
};

export const generateNarration = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId || 'usr_demo123';
    const { chapterId } = req.body;

    if (!chapterId) {
      return res.status(400).json({ message: 'chapterId is required' });
    }

    const chapter = db.chapters.get(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    const story = db.stories.get(chapterId);
    if (!story || !story.content) {
      return res.status(400).json({ message: 'Complete chapter story script required before generating narration' });
    }

    const user = db.users.get(userId);
    const refVoice = user?.referenceVoice;

    const voiceId = refVoice ? refVoice.voiceId : 'default_storyteller';
    const provider = refVoice ? refVoice.provider : 'gemini';

    // Generate narration using TTS service abstraction
    const generated = await ttsService.generateNarration(story.content, voiceId, provider);

    // Upload narration audio file to Cloudinary
    const uploadResult = await cloudinaryService.uploadMedia(
      generated.audioUrl,
      `narrations/${chapterId}`,
      'raw'
    );

    const newNarration: GeneratedNarration = {
      id: `nar_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      chapterId,
      audioUrl: uploadResult.url,
      cloudinaryPublicId: uploadResult.publicId,
      duration: generated.duration,
      provider,
      voiceId,
      generatedAt: new Date().toISOString()
    };

    const existing = db.narrations.get(chapterId) || [];
    db.narrations.set(chapterId, [...existing, newNarration]);

    // Update chapter status
    db.chapters.set(chapterId, {
      ...chapter,
      status: 'narration-ready',
      updatedAt: new Date().toISOString()
    });

    return res.status(201).json(newNarration);
  } catch (err: any) {
    console.error('Narration generation error:', err);
    return res.status(500).json({ message: err.message || 'Narration generation failed' });
  }
};

export const deleteNarration = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  for (const [chId, narrList] of db.narrations.entries()) {
    const target = narrList.find((n) => n.id === id);
    if (target) {
      if (target.cloudinaryPublicId) {
        await cloudinaryService.deleteMedia(target.cloudinaryPublicId);
      }
      const filtered = narrList.filter((n) => n.id !== id);
      db.narrations.set(chId, filtered);
      return res.json({ message: 'Narration deleted successfully' });
    }
  }

  return res.status(404).json({ message: 'Narration not found' });
};
