import { Router } from 'express';
import {
  getChaptersBySeries,
  getChapterById,
  createChapter,
  updateChapter,
  deleteChapter
} from '../controllers/chapterController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/series/:seriesId', authenticateToken, getChaptersBySeries);
router.get('/:id', authenticateToken, getChapterById);
router.post('/', authenticateToken, createChapter);
router.put('/:id', authenticateToken, updateChapter);
router.delete('/:id', authenticateToken, deleteChapter);

export default router;
