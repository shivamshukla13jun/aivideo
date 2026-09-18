import { Router } from 'express';
import {
  getScenesByChapter,
  createScene,
  updateScene,
  deleteScene,
  reorderScenes,
  aiExtractScene
} from '../controllers/sceneController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/chapter/:chapterId', authenticateToken, getScenesByChapter);
router.post('/', authenticateToken, createScene);
router.put('/:id', authenticateToken, updateScene);
router.delete('/:id', authenticateToken, deleteScene);
router.post('/reorder', authenticateToken, reorderScenes);
router.post('/ai-extract', authenticateToken, aiExtractScene);

export default router;
