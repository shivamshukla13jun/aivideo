import { Response } from 'express';
import { db } from '../models/Database';
import { AuthRequest } from '../middleware/auth';
import { renderService } from '../services/renderService';
import { getIO } from '../sockets/socketHandler';

export const startRender = async (req: AuthRequest, res: Response) => {
  const { projectId, socketId } = req.body;
  if (!projectId) {
    return res.status(400).json({ message: 'projectId is required' });
  }

  const project = db.videoProjects.get(projectId);
  if (!project) {
    return res.status(404).json({ message: 'Video project not found' });
  }

  // Asynchronously trigger rendering pipeline so socket emissions broadcast progress
  renderService.renderProject(projectId, project, socketId).then((renderedUrl) => {
    project.renderedVideoUrl = renderedUrl;
    project.renderedAt = new Date().toISOString();
    db.videoProjects.set(projectId, project);

    if (project.chapterId) {
      const chapter = db.chapters.get(project.chapterId);
      if (chapter) {
        db.chapters.set(project.chapterId, { ...chapter, status: 'completed', updatedAt: new Date().toISOString() });
      }
    }
  }).catch((err) => {
    console.error('Render pipeline error:', err);
    const payload = {
      projectId,
      progress: 0,
      currentScene: 0,
      totalScenes: 0,
      elapsedTime: '00:00:00',
      estimatedRemaining: '00:00:00',
      status: 'error',
      errorMessage: err?.message || 'Render failed'
    };
    if (socketId) {
      getIO().to(socketId).emit('render:progress', payload);
    } else {
      getIO().emit('render:progress', payload);
    }
  });

  return res.json({ message: 'Render process started', projectId });
};
