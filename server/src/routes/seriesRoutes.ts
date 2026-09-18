import { Router } from 'express';
import {
  getSeriesList,
  getSeriesById,
  createSeries,
  updateSeries,
  deleteSeries
} from '../controllers/seriesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getSeriesList);
router.get('/:id', authenticateToken, getSeriesById);
router.post('/', authenticateToken, createSeries);
router.put('/:id', authenticateToken, updateSeries);
router.delete('/:id', authenticateToken, deleteSeries);

export default router;
