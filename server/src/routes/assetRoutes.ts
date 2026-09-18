import { Router } from 'express';
import { getAssets, createAsset, deleteAsset } from '../controllers/assetController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getAssets);
router.post('/', authenticateToken, createAsset);
router.delete('/:id', authenticateToken, deleteAsset);

export default router;
