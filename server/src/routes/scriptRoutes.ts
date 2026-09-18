import { Router } from 'express';
import {
  buildCompleteStory,
  getStoryByChapter,
  saveStory,
  restoreStoryVersion
} from '../controllers/scriptController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/chapter/:chapterId', authenticateToken, getStoryByChapter);
router.post('/build-complete-story', authenticateToken, buildCompleteStory);
router.post('/save', authenticateToken, saveStory);
router.post('/restore-version', authenticateToken, restoreStoryVersion);

export default router;
