import { Router } from 'express';
import { startRender } from '../controllers/renderController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/start', authenticateToken, startRender);

export default router;
