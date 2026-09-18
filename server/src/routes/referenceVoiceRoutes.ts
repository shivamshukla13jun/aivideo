import { Router } from 'express';
import multer from 'multer';
import {
  getReferenceVoice,
  setReferenceVoice,
  deleteReferenceVoice
} from '../controllers/referenceVoiceController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max voice sample
});

router.get('/', authenticateToken, getReferenceVoice);
router.post('/', authenticateToken, upload.single('file'), setReferenceVoice);
router.delete('/', authenticateToken, deleteReferenceVoice);

export default router;
