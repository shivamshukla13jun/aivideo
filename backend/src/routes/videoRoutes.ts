import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { geminiService } from '../services/geminiService';
import { videoService } from '../services/videoService';

const router = Router();

// Multer setup for image and audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.uploadsDir)) {
      fs.mkdirSync(config.uploadsDir, { recursive: true });
    }
    cb(null, config.uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * Health & Capabilities Check
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const ffmpegAvailable = await videoService.checkFFmpeg();
    const hasEnvKey = Boolean(config.geminiApiKey);

    res.json({
      status: 'ok',
      ffmpegAvailable,
      geminiConfigured: hasEnvKey,
      clientUrl: config.clientUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate Slideshow Storyboard using Gemini Pro AI
 */
router.post('/ai-generate', async (req: Request, res: Response) => {
  try {
    const { topic, slideCount, style, aspectRatio, model, apiKey } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Please provide a topic or concept for the video.' });
    }

    // Support client passing key or fallback to env
    const activeKey = apiKey || (req.headers['x-gemini-key'] as string) || config.geminiApiKey;

    const result = await geminiService.generateSlideshow({
      topic,
      slideCount: Number(slideCount) || 5,
      style: style || 'Cinematic Documentary',
      aspectRatio: aspectRatio || '16:9',
      model: model || 'gemini-2.5-flash',
      apiKey: activeKey,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Gemini AI Generate Error]', error);
    res.status(500).json({ error: error.message || 'Gemini AI generation failed.' });
  }
});

/**
 * Multimodal: Analyze uploaded images/panels and auto-generate narration + effects
 */
router.post('/analyze-images', upload.array('images', 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded for analysis.' });
    }

    const { storyContext, model, apiKey } = req.body;
    const activeKey = apiKey || (req.headers['x-gemini-key'] as string) || config.geminiApiKey;

    const imagePayload = files.map((file) => {
      const fileBuffer = fs.readFileSync(file.path);
      return {
        mimeType: file.mimetype,
        base64Data: fileBuffer.toString('base64'),
        filename: file.originalname,
      };
    });

    const result = await geminiService.analyzeImagesForSlideshow({
      images: imagePayload,
      storyContext,
      model: model || 'gemini-2.5-flash',
      apiKey: activeKey,
    });

    // Attach local uploaded file URLs
    result.scenes = result.scenes.map((scene, i) => ({
      ...scene,
      imageUrl: `/storage/uploads/${files[i].filename}`,
    }));

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Gemini Vision Analysis Error]', error);
    res.status(500).json({ error: error.message || 'Image analysis failed.' });
  }
});

/**
 * Upload general media (slides, images, music, voice clips)
 */
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const fileUrl = `/storage/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Render Video via FFmpeg (Server-Side)
 */
router.post('/render', async (req: Request, res: Response) => {
  try {
    const result = await videoService.renderSlideshow(req.body);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * List Generated Videos
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const videos = await videoService.listVideos();
    res.json({ success: true, videos });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
