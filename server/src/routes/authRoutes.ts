import { Router } from 'express';
import { register, login, me, refresh } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticateToken, me);

export default router;
