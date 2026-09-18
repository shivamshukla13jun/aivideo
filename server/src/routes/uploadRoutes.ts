import { Router } from 'express';
import multer from 'multer';
import { uploadChapterImages, uploadCBZArchive } from '../controllers/uploadController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const upload = multer({
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max archive size
});

router.post('/chapter-images', authenticateToken, uploadChapterImages);
router.post('/cbz', authenticateToken, upload.single('file'), uploadCBZArchive);

export default router;
