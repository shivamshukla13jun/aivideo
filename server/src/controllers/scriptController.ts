import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { ChapterStory } from '../../src/types/index';

export const buildCompleteStory = async (req: AuthRequest, res: Response) => {
  const { chapterId } = req.body;
  if (!chapterId) {
    return res.status(400).json({ message: 'chapterId is required' });
  }

  const chapter = db.chapters.get(chapterId);
  if (!chapter) {
    return res.status(404).json({ message: 'Chapter not found' });
  }

  const scenes = (db.scenes.get(chapterId) || []).sort((a, b) => a.order - b.order);

  if (scenes.length === 0) {
    return res.status(400).json({ message: 'No scenes found for this chapter to build a story' });
  }

  let storyText = `[Chapter ${chapter.chapterNumber}: ${chapter.title}]\n\n`;

  scenes.forEach((scn) => {
    storyText += `--- Scene ${scn.sceneNumber} ---\n`;
    if (scn.characters.length > 0) {
      storyText += `Characters: ${scn.characters.join(', ')}\n`;
    }
    if (scn.narration) {
      storyText += `Narration: ${scn.narration}\n`;
    }
    if (scn.dialogue) {
      storyText += `Dialogue: ${scn.dialogue}\n`;
    }
    storyText += `[Emotion: ${scn.emotion || 'Standard'}]\n\n`;
  });

  const existingStory = db.stories.get(chapterId);
  const nextVersion = existingStory ? (existingStory.versions.length + 1) : 1;

  const newStory: ChapterStory = {
    id: existingStory ? existingStory.id : `st_${Date.now()}`,
    chapterId,
    content: storyText,
    status: 'draft',
    versions: existingStory ? [
      ...existingStory.versions,
      { version: nextVersion, content: storyText, updatedAt: new Date().toISOString() }
    ] : [
      { version: 1, content: storyText, updatedAt: new Date().toISOString() }
    ],
    updatedAt: new Date().toISOString()
  };

  db.stories.set(chapterId, newStory);

  // Update chapter status
  db.chapters.set(chapterId, {
    ...chapter,
    status: 'script-completed',
    updatedAt: new Date().toISOString()
  });

  return res.json(newStory);
};

export const getStoryByChapter = async (req: AuthRequest, res: Response) => {
  const { chapterId } = req.params;
  const story = db.stories.get(chapterId) || null;
  return res.json(story);
};

export const saveStory = async (req: AuthRequest, res: Response) => {
  const { chapterId, content, status } = req.body;
  if (!chapterId || content === undefined) {
    return res.status(400).json({ message: 'chapterId and content required' });
  }

  const existing = db.stories.get(chapterId);
  const nextVersion = existing ? existing.versions.length + 1 : 1;

  const updatedStory: ChapterStory = {
    id: existing ? existing.id : `st_${Date.now()}`,
    chapterId,
    content,
    status: status || 'saved',
    versions: existing ? [
      ...existing.versions,
      { version: nextVersion, content, updatedAt: new Date().toISOString() }
    ] : [
      { version: 1, content, updatedAt: new Date().toISOString() }
    ],
    updatedAt: new Date().toISOString()
  };

  db.stories.set(chapterId, updatedStory);

  // Update chapter status if saved
  const chapter = db.chapters.get(chapterId);
  if (chapter && status === 'saved') {
    db.chapters.set(chapterId, { ...chapter, status: 'script-completed', updatedAt: new Date().toISOString() });
  }

  return res.json(updatedStory);
};

export const restoreStoryVersion = async (req: AuthRequest, res: Response) => {
  const { chapterId, version } = req.body;
  const story = db.stories.get(chapterId);
  if (!story) {
    return res.status(404).json({ message: 'Story not found' });
  }

  const ver = story.versions.find((v: any) => v.version === version);
  if (!ver) {
    return res.status(404).json({ message: 'Version not found' });
  }

  story.content = ver.content;
  story.updatedAt = new Date().toISOString();
  db.stories.set(chapterId, story);

  return res.json(story);
};
