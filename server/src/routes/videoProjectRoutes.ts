import { Router } from 'express';
import {
  getVideoProjects,
  getVideoProjectById,
  createVideoProject,
  updateVideoProject,
  deleteVideoProject,
  syncVideoProject
} from '../controllers/videoProjectController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getVideoProjects);
router.get('/:id', authenticateToken, getVideoProjectById);
router.post('/', authenticateToken, createVideoProject);
router.post('/:id/sync', authenticateToken, syncVideoProject);
router.put('/:id', authenticateToken, updateVideoProject);
router.delete('/:id', authenticateToken, deleteVideoProject);

export default router;
