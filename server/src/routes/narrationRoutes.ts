import { Router } from 'express';
import {
  getNarrationsByChapter,
  generateNarration,
  deleteNarration
} from '../controllers/narrationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/chapter/:chapterId', authenticateToken, getNarrationsByChapter);
router.post('/generate', authenticateToken, generateNarration);
router.delete('/:id', authenticateToken, deleteNarration);

export default router;
