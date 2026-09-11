import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { geminiService } from '../services/geminiService';
import { ollamaService } from '../services/ollamaService';
import { aiProviderService } from '../services/aiProviderService';
import { videoService } from '../services/videoService';
import { characterMemoryService } from '../services/characterMemoryService';
import { chapterCacheService } from '../services/chapterCacheService';
import { ProjectModel } from '../db/models/ProjectModel';
import { emitProgress } from '../socket';
import { ttsService } from '../services/ttsService';

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
 * Health & Capabilities Check with Service Status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const ffmpegAvailable = await videoService.checkFFmpeg();
    const hasEnvKey = Boolean(config.geminiApiKey);

    // Live connectivity check to Suwayomi server
    let suwayomiConnected = false;
    try {
      const suwRes = await axios.post(
        `${config.suwayomiUrl}/api/graphql`,
        { query: '{ mangas(first: 1) { totalCount } }' },
        { timeout: 2000 }
      );
      suwayomiConnected = !suwRes.data.errors;
    } catch {
      suwayomiConnected = false;
    }

    // Live MongoDB connection check
    const mongoConnected = mongoose.connection.readyState === 1;

    // Live AI Provider Status (Gemini + Ollama)
    const providerStatus = await aiProviderService.getStatus();

    res.json({
      status: 'ok',
      backendApiUrl: '/api/video',
      suwayomiApiUrl: '/suwayomi',
      suwayomiConnected,
      mongoConnected,
      ffmpegAvailable,
      geminiConfigured: providerStatus.gemini.configured,
      aiProvider: providerStatus.activeProvider,
      configuredInEnv: providerStatus.configuredInEnv,
      ollamaConnected: providerStatus.ollama.connected,
      ollamaBaseUrl: providerStatus.ollama.baseUrl,
      ollamaModels: providerStatus.ollama.models,
      ollamaDefaultModel: providerStatus.ollama.defaultModel,
      ollamaVisionModel: providerStatus.ollama.visionModel,
      clientUrl: config.clientUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * AI Provider Status & Runtime Switching
 */
router.get('/ai-provider', async (req: Request, res: Response) => {
  try {
    const status = await aiProviderService.getStatus();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai-provider/switch', (req: Request, res: Response) => {
  // Provider is strictly managed via server .env (AI_PROVIDER=gemini or AI_PROVIDER=ollama)
  res.json({
    success: false,
    activeProvider: aiProviderService.getActiveProvider(),
    configuredInEnv: config.aiProvider,
    message: 'AI प्रोवाइडर केवल सर्वर की .env फ़ाइल (AI_PROVIDER=gemini या AI_PROVIDER=ollama) द्वारा प्रबंधित होता है।'
  });
});

router.get('/ollama/models', async (req: Request, res: Response) => {
  try {
    const status = await ollamaService.checkConnection();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Generate Slideshow Storyboard using active AI provider from .env
 */
router.post('/ai-generate', async (req: Request, res: Response) => {
  try {
    const { topic, slideCount, style, aspectRatio, model } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Please provide a topic or concept for the video.' });
    }

    const result = await aiProviderService.generateSlideshow({
      topic,
      slideCount: Number(slideCount) || 5,
      style: style || 'Cinematic Documentary',
      aspectRatio: aspectRatio || '16:9',
      model,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[AI Generate Error]', error);
    res.status(500).json({ error: error.message || 'AI generation failed.' });
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

    const { storyContext, model } = req.body;

    const imagePayload = files.map((file) => {
      const fileBuffer = fs.readFileSync(file.path);
      return {
        mimeType: file.mimetype,
        base64Data: fileBuffer.toString('base64'),
        filename: file.originalname,
      };
    });

    const result = await aiProviderService.analyzeImagesForSlideshow({
      images: imagePayload,
      storyContext,
      model,
    });

    // Attach local uploaded file URLs
    result.scenes = result.scenes.map((scene, i) => ({
      ...scene,
      imageUrl: `/storage/uploads/${files[i].filename}`,
    }));

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Vision Analysis Error]', error);
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

/**
 * Calculates situation-aware scene duration based on subtitle content, situation, and word count.
 * Ensures scenes are neither arbitrarily too long (dragging) nor too short (rushed).
 */
function calculateSituationAwareDuration(
  narrationText: string,
  rawSubtitles: Array<{ text?: string; startTime?: number; endTime?: number; style?: any }> = [],
  geminiDuration?: number
): { duration: number; subtitles: Array<any> } {
  // Combine all subtitle texts and narration to assess total words
  const allSubText = rawSubtitles.map((s) => s.text || '').filter(Boolean).join(' ');
  const fullText = (allSubText.trim() || narrationText.trim()).trim();
  const words = fullText.split(/\s+/).filter(Boolean).length;

  // Reading pacing in Hindi aloud: ~2.5 words/second + 0.8s reaction/breath padding
  // 1-3 words (quick reaction/punch/SFX) -> 2.0s to 2.8s
  // 4-8 words (short dialogue) -> 3.0s to 4.2s
  // 9-15 words (standard dialogue) -> 4.5s to 6.2s
  // 16+ words (deep explanation / lore) -> 6.5s to 9.5s
  let calculatedDuration = Math.round(((words / 2.5) + 0.8) * 10) / 10;
  calculatedDuration = Math.min(9.5, Math.max(2.0, calculatedDuration));

  // If Gemini provided a duration, respect it if reasonable and reading time is satisfied
  let finalDuration = calculatedDuration;
  if (typeof geminiDuration === 'number' && geminiDuration >= 2.0 && geminiDuration <= 10.0) {
    finalDuration = Math.min(9.5, Math.max(calculatedDuration, geminiDuration));
  }

  // Adjust subtitles within the calculated duration
  let processedSubs: any[] = [];
  if (!rawSubtitles || rawSubtitles.length === 0) {
    processedSubs = [
      {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: fullText || 'रोमांचक दृश्य',
        startTime: 0.2,
        endTime: Math.max(1.2, Math.round((finalDuration - 0.2) * 10) / 10),
        style: {
          fontSize: 34,
          fontFamily: 'Outfit, Inter, sans-serif',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          position: 'bottom',
          bold: true,
          italic: false,
          outline: true,
        },
      },
    ];
  } else {
    // Proportional distribution across the scene
    const totalSubWords = rawSubtitles.reduce((acc, sub) => {
      const subWordCount = (sub.text || '').split(/\s+/).filter(Boolean).length;
      return acc + Math.max(1, subWordCount);
    }, 0);

    const usableDuration = Math.max(1.5, finalDuration - 0.4);
    let currentStart = 0.2;

    processedSubs = rawSubtitles.map((sub, sIdx) => {
      const subWordCount = Math.max(1, (sub.text || '').split(/\s+/).filter(Boolean).length);
      const subShare = subWordCount / totalSubWords;
      const subDuration = Math.max(1.0, Math.round(usableDuration * subShare * 10) / 10);
      const startTime = Math.round(currentStart * 10) / 10;
      const endTime = Math.min(
        Math.round((finalDuration - 0.2) * 10) / 10,
        Math.round((startTime + subDuration) * 10) / 10
      );

      currentStart = endTime + 0.1;

      return {
        id: (sub as any).id || `sub_${Date.now()}_${sIdx}_${Math.random().toString(36).slice(2, 6)}`,
        text: sub.text || '',
        startTime,
        endTime: Math.max(startTime + 0.8, endTime),
        style: (sub as any).style || {
          fontSize: 34,
          fontFamily: 'Outfit, Inter, sans-serif',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          position: 'bottom',
          bold: true,
          italic: false,
          outline: true,
        },
      };
    });
  }

  return {
    duration: Math.round(finalDuration * 10) / 10,
    subtitles: processedSubs,
  };
}

/**
 * Helper to process manga panel vision analysis, character memory, and scene creation
 */
async function processLibraryVideoGeneration(

  params: {
    socketId?: string;
    mangaId?: string | number;
    mangaTitle?: string;
    chapterId?: string | number;
    chapterName?: string;
    panels: Array<{ imageUrl: string; pageIndex?: number }>;
    apiKey?: string;
    model?: string;
    aiProvider?: string;
    autoGenerateAudio?: boolean;
    voice?: string;
    sampleAudioUrl?: string;
    elevenLabsApiKey?: string;
  },
  onProgress?: (step: string, message: string, percent: number) => void
) {
  const {
    socketId,
    mangaId,
    mangaTitle = 'Anime Manga',
    chapterId,
    chapterName = 'Chapter',
    panels = [],
    apiKey,
    model,
    aiProvider,
    autoGenerateAudio = false,
    voice = 'hi-IN-MadhurNeural',
    sampleAudioUrl,
    elevenLabsApiKey,
  } = params;

  const notify = (
    step: string,
    message: string,
    percent: number,
    extra: Record<string, any> = {}
  ) => {
    onProgress?.(step, message, percent);
    emitProgress(socketId, { step, message, percent, mangaId, chapterId, ...extra });
  };

  notify('init', '1/5: तैयारी शुरू हो रही है...', 10);

  // 1. Fetch panel images and prepare multimodal payload (unlimited timeout)
  const imagePayload: Array<{ mimeType: string; base64Data: string; filename: string }> = [];

  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    notify(
      'downloading',
      `2/5: पैनल ${i + 1}/${panels.length} लोड हो रहा है...`,
      Math.round(15 + (i / panels.length) * 20)
    );

    let imgUrl = panel.imageUrl;

    if (imgUrl.startsWith('/suwayomi/')) {
      imgUrl = `${config.suwayomiUrl}${imgUrl.replace(/^\/suwayomi/, '')}`;
    }

    let buffer: Buffer;
    if (imgUrl.startsWith('http')) {
      const response = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 0 });
      buffer = Buffer.from(response.data);
    } else if (imgUrl.startsWith('/storage/uploads/')) {
      const localPath = path.join(config.uploadsDir, imgUrl.replace(/^\/storage\/uploads\//, ''));
      buffer = fs.readFileSync(localPath);
    } else {
      buffer = fs.readFileSync(imgUrl);
    }

    imagePayload.push({
      mimeType: 'image/jpeg',
      base64Data: buffer.toString('base64'),
      filename: `Panel_${panel.pageIndex !== undefined ? panel.pageIndex + 1 : i + 1}`,
    });
  }

  // 2. Retrieve persistent character memory using mangaId and mangaTitle
  notify('memory', '3/5: MongoDB से पूर्व कहानी और किरदारों की याददाश्त लोड हो रही है...', 40);
  const memoryIdentifier = { mangaId, mangaTitle };
  const memoryPrompt = await characterMemoryService.formatMemoryForPrompt(memoryIdentifier);

  const storyContext = `Manga: "${mangaTitle}" (ID: ${mangaId || 'N/A'}). Chapter: "${chapterName}" (ID: ${chapterId || 'N/A'}).
Analyze each panel sequentially. Understand speech bubbles, actions, facial expressions, and battle choreography.
Create engaging, situation-aware Hindi narration and dialogue subtitles tailored for a creator to read aloud while voice recording.
Always remember past characters and generate exciting audience reminder hooks for any mysterious or returning characters!`;

  // 3. Multimodal Vision analysis with Real-Time Response Streaming (Gemini or Ollama strictly from .env)
  const activeProvider = aiProviderService.getActiveProvider();
  const providerLabel = activeProvider === 'ollama' ? 'Ollama AI (Local Vision)' : 'Gemini 3.6 Vision AI';

  notify('analyzing', `4/5: ${providerLabel} द्वारा हिंदी कहानी और सबटाइटल तैयार किए जा रहे हैं...`, 60);

  let lastEmitTime = 0;
  let accumulatedStreamText = '';

  const geminiResult = await aiProviderService.analyzeImagesForSlideshow({
    images: imagePayload,
    storyContext,
    characterMemoryPrompt: memoryPrompt,
    model,
    onChunk: (chunkText, totalLength) => {
      accumulatedStreamText += chunkText;
      const now = Date.now();
      // Throttle socket emissions to ~90ms to give ultra smooth real-time response
      if (now - lastEmitTime > 90 || totalLength < 250) {
        lastEmitTime = now;
        const dynamicPercent = Math.min(84, 60 + Math.floor((totalLength / 2200) * 24));
        const recentSnippet = accumulatedStreamText.slice(-100).replace(/\r?\n/g, ' ');

        notify(
          'gemini_streaming',
          `4/5: ${activeProvider === 'ollama' ? 'Ollama AI' : 'Gemini AI'} लाइव लिख रहा है (${totalLength} अक्षर)...`,
          dynamicPercent,
          {
            streamSnippet: recentSnippet,
            accumulatedLength: totalLength,
            provider: activeProvider,
          }
        );
      }
    },
  });


  // 4. Update persistent character memory in MongoDB with chapterId, summary, full transcripts, and new characters
  notify('saving', '5/5: नए किरदार और अनसुलझे रहस्य MongoDB में सुरक्षित किए जा रहे हैं...', 85);

  const fullTranscript = (geminiResult.scenes || [])
    .map((s: any, idx: number) => {
      const subs = (s.subtitles || []).map((sub: any) => sub.text).join(' ');
      return `[दृश्य ${idx + 1}: ${s.title || ''}] ${s.narration || ''} ${subs}`;
    })
    .join('\n');

  const updatedMemory = await characterMemoryService.updateMemoryFromAnalysis(
    memoryIdentifier,
    { chapterId, chapterName },
    {
      chapterSummary: geminiResult.chapterSummary,
      fullTranscript,
      newCharacters: geminiResult.characters,
      discoveredMysteries: geminiResult.unresolvedMysteries,
    }
  );

  try {
    // 5. Build scenes with situation-aware subtitles and human reading pacing (NO AUDIO GENERATED)
    const processedScenes = [];
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const matchedScene = geminiResult.scenes[i] || {
        title: `पैनल ${i + 1}`,
        narration: `${mangaTitle} के ${chapterName} में रोमांचक मोड़।`,
        duration: 3.5,
        effect: 'kenburns',
        subtitles: [],
      };

      const narrationText = matchedScene.narration || matchedScene.title;
      const { duration: sceneDuration, subtitles } = calculateSituationAwareDuration(
        narrationText,
        matchedScene.subtitles || [],
        matchedScene.duration
      );

      // No audio attached by default: the user will record audio while reading the subtitles
      processedScenes.push({
        id: `anime_scene_${Date.now()}_${i}`,
        slideNumber: i + 1,
        title: matchedScene.title || `पैनल ${i + 1}`,
        imageUrl: panel.imageUrl,
        duration: sceneDuration,
        effect: matchedScene.effect || 'kenburns',
        narration: narrationText,
        subtitles,
        audioClips: [],
      });
    }

    // 5.5 Optional: If autoGenerateAudio is requested, generate voice scene by scene
    if (autoGenerateAudio) {
      notify('audio_generating', '6/6: न्यूरल टेक्स्ट-टू-स्पीच से वॉइसओवर तैयार हो रहा है... 🎙️', 88);
      let sampleAudioPath: string | undefined = undefined;
      if (sampleAudioUrl && sampleAudioUrl.startsWith('/storage/uploads/')) {
        sampleAudioPath = path.join(config.uploadsDir, sampleAudioUrl.replace(/^\/storage\/uploads\//, ''));
      }

      for (let i = 0; i < processedScenes.length; i++) {
        const percent = Math.min(99, 88 + Math.floor(((i + 1) / processedScenes.length) * 11));
        notify(
          'audio_generating',
          `वॉइसओवर तैयार हो रहा है: सीन ${i + 1}/${processedScenes.length}... 🎙️`,
          percent,
          { currentScene: i + 1, totalScenes: processedScenes.length }
        );

        try {
          processedScenes[i] = await ttsService.generateVoiceForScene(processedScenes[i], {
            voice: voice || 'hi-IN-MadhurNeural',
            sampleAudioPath,
            elevenLabsApiKey: config.elevenLabsApiKey,
          });
        } catch (audioErr: any) {
          console.warn(`[TTS Warning] Failed generating voice for scene ${i + 1}:`, audioErr?.message || audioErr);
        }
      }
    }

    notify('complete', 'सफलतापूर्वक सबटाइटल व कहानी तैयार!', 100);

    const title = geminiResult.title || `${mangaTitle} - ${chapterName}`;
    const description =
      geminiResult.description ||
      `Anime Story generated from ${processedScenes.length} panels with situation-aware subtitles.`;

    // Save full generated chapter scenes, subtitles, and panel captions in MongoDB & Disk Backup
    const panelCaptionsMap: Record<string, string> = {};
    processedScenes.forEach((s, idx) => {
      panelCaptionsMap[String(idx)] = s.narration || s.title || '';
    });

    try {
      await chapterCacheService.saveChapterData({
        chapterId: String(chapterId || 'unknown'),
        mangaId: String(mangaId || 'unknown'),
        mangaTitle,
        chapterName,
        title,
        description,
        chapterSummary: geminiResult.chapterSummary || '',
        totalPanels: panels.length,

        scenes: processedScenes,
        panelCaptions: panelCaptionsMap,
        characters: geminiResult.characters || [],
        unresolvedMysteries: geminiResult.unresolvedMysteries || [],
      });
    } catch (cacheErr) {
      console.warn('[Chapter Cache Save Warning]', cacheErr);
    }

    return {
      title,
      description,
      chapterSummary: geminiResult.chapterSummary,
      characters: geminiResult.characters || [],
      unresolvedMysteries: geminiResult.unresolvedMysteries || [],
      storyMemory: updatedMemory,
      totalPanels: panels.length,
      scenes: processedScenes,
    };
  } catch (procErr: any) {
    notify('error', procErr.message || 'कहानी विश्लेषण में त्रुटि हुई', 0);
    throw procErr;
  }

}

/**
 * Real-Time Stream Endpoint: Auto-Generate Video Subtitles & Story from Anime Library with Gemini AI
 */
router.post('/generate-from-library-stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const {
      mangaId,
      mangaTitle,
      chapterId,
      chapterName,
      panels,
      apiKey,
      model,
      aiProvider,
      socketId,
      autoGenerateAudio,
      voice,
      sampleAudioUrl,
      elevenLabsApiKey,
    } = req.body;

    if (!panels || panels.length === 0) {
      sendEvent('error', { message: 'No anime panels provided for video generation.' });
      return res.end();
    }

    const activeKey = apiKey || (req.headers['x-gemini-key'] as string) || config.geminiApiKey;

    const data = await processLibraryVideoGeneration(
      {
        socketId,
        mangaId,
        mangaTitle,
        chapterId,
        chapterName,
        panels,
        apiKey: activeKey,
        model,
        aiProvider,
        autoGenerateAudio: Boolean(autoGenerateAudio),
        voice,
        sampleAudioUrl,
        elevenLabsApiKey,
      },
      (step, message, percent) => {
        sendEvent('progress', { step, message, percent });
      }
    );

    sendEvent('complete', { success: true, data });
    res.end();
  } catch (error: any) {
    console.error('[Generate Anime Video Stream Error]', error);
    sendEvent('error', { message: error.message || 'Failed to auto-generate anime subtitles & story.' });
    res.end();
  }
});

/**
 * Standard Endpoint: Auto-Generate Video Subtitles & Story from Anime Library with Gemini AI
 */
router.post('/generate-from-library', async (req: Request, res: Response) => {
  try {
    const {
      mangaId,
      mangaTitle,
      chapterId,
      chapterName,
      panels,
      apiKey,
      model,
      aiProvider,
      socketId,
      autoGenerateAudio,
      voice,
      sampleAudioUrl,
      elevenLabsApiKey,
    } = req.body;

    if (!panels || panels.length === 0) {
      return res.status(400).json({ error: 'No anime panels provided for video generation.' });
    }

    const activeKey = apiKey || (req.headers['x-gemini-key'] as string) || config.geminiApiKey;

    const data = await processLibraryVideoGeneration({
      socketId,
      mangaId,
      mangaTitle,
      chapterId,
      chapterName,
      panels,
      apiKey: activeKey,
      model,
      aiProvider,
      autoGenerateAudio: Boolean(autoGenerateAudio),
      voice,
      sampleAudioUrl,
      elevenLabsApiKey,
    });

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('[Generate Anime Video Error]', error);
    res.status(500).json({ error: error.message || 'Failed to auto-generate anime subtitles & story.' });
  }
});


/**
 * Retrieve All Stored Anime/Manga Themes & Story Memories from MongoDB
 */
router.get('/story-memories', async (req: Request, res: Response) => {
  try {
    const memories = await characterMemoryService.getAllMemories();
    res.json({ success: true, memories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Retrieve Persistent Story Memory & Characters for a Manga from MongoDB
 */
router.get('/story-memory/:identifier', async (req: Request, res: Response) => {
  try {
    const mangaId = (req.query.mangaId as string) || (req.params.identifier.match(/^\d+$/) ? req.params.identifier : undefined);
    const memory = await characterMemoryService.getMemory({
      mangaId,
      mangaTitle: req.params.identifier,
    });
    res.json({ success: true, memory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update or Add Story Lore, Theme / Characters in MongoDB
 */
router.post('/story-memory/:mangaTitle', async (req: Request, res: Response) => {
  try {
    const memory = req.body;
    memory.mangaTitle = req.params.mangaTitle;
    const saved = await characterMemoryService.saveMemory(memory);
    res.json({ success: true, memory: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a Story Memory & Character record from MongoDB
 */
router.delete('/story-memory/:mangaTitle', async (req: Request, res: Response) => {
  try {
    await characterMemoryService.deleteMemory(req.params.mangaTitle);
    res.json({ success: true, message: `Deleted memory for ${req.params.mangaTitle}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Retrieve Cached Chapter Generation Data from MongoDB / Disk
 * Prevents re-calling Gemini AI API to save money and time!
 */
router.get('/chapter-cache/:chapterId', async (req: Request, res: Response) => {
  try {
    const { chapterId } = req.params;
    const { mangaId } = req.query;
    const cachedData = await chapterCacheService.getChapterData(chapterId, mangaId as string);

    if (cachedData) {
      return res.json({
        success: true,
        cached: true,
        data: cachedData,
      });
    }

    return res.json({
      success: true,
      cached: false,
      data: null,
    });
  } catch (error: any) {
    console.error('[Get Chapter Cache Error]', error);
    res.status(500).json({ error: error.message || 'Failed to check chapter cache' });
  }
});

/**
 * Invalidate / Delete Cached Chapter Data if User Requests Re-generation
 */
router.delete('/chapter-cache/:chapterId', async (req: Request, res: Response) => {
  try {
    const { chapterId } = req.params;
    await chapterCacheService.deleteChapterData(chapterId);
    res.json({ success: true, message: `Chapter cache cleared for ${chapterId}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Auto-Save Project: Continuously & silently save studio project state into MongoDB
 */
router.post('/project/current', async (req: Request, res: Response) => {
  try {
    const { title, description, aspectRatio, fps, scenes, bgMusicUrl, totalDuration } = req.body;
    const project = await ProjectModel.findOneAndUpdate(
      { projectId: 'current' },
      {
        projectId: 'current',
        title: title || 'My Anime Video',
        description: description || '',
        aspectRatio: aspectRatio || '16:9',
        fps: fps || 30,
        scenes: scenes || [],
        bgMusicUrl: bgMusicUrl || '',
        totalDuration: totalDuration || 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, project });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Retrieve Auto-Saved Studio Project from MongoDB
 */
router.get('/project/current', async (req: Request, res: Response) => {
  try {
    const project = await ProjectModel.findOne({ projectId: 'current' });
    res.json({ success: true, project });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Available Neural Voices
 */
router.get('/tts/voices', (req: Request, res: Response) => {
  res.json({ success: true, voices: ttsService.getVoices() });
});

/**
 * Upload User Sample Audio for Voice Cloning or Reference
 */
router.post('/tts/upload-sample', upload.single('sampleAudio'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No sample audio file uploaded.' });
    }
    const sampleAudioUrl = `/storage/uploads/${req.file.filename}`;
    res.json({
      success: true,
      sampleAudioUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate Voice for a Single Scene
 */
router.post('/tts/generate-scene', async (req: Request, res: Response) => {
  try {
    const { scene, voice, sampleAudioUrl, elevenLabsApiKey, text } = req.body;
    if (!scene) {
      return res.status(400).json({ error: 'Scene is required.' });
    }

    let sampleAudioPath: string | undefined = undefined;
    if (sampleAudioUrl && sampleAudioUrl.startsWith('/storage/uploads/')) {
      sampleAudioPath = path.join(config.uploadsDir, sampleAudioUrl.replace(/^\/storage\/uploads\//, ''));
    }

    const updatedScene = await ttsService.generateVoiceForScene(scene, {
      voice,
      sampleAudioPath,
      elevenLabsApiKey: config.elevenLabsApiKey,
      text,
    });

    res.json({ success: true, scene: updatedScene });
  } catch (error: any) {
    console.error('[TTS Generate Scene Error]', error);
    res.status(500).json({ error: error.message || 'Failed to generate voice for scene.' });
  }
});

/**
 * Generate Voice for All Scenes (Batch) with Real-Time Progress & Auto-Save
 */
router.post('/tts/generate-all', async (req: Request, res: Response) => {
  try {
    const { scenes, voice, sampleAudioUrl, elevenLabsApiKey, socketId } = req.body;
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: 'Scenes array is required.' });
    }

    let sampleAudioPath: string | undefined = undefined;
    if (sampleAudioUrl && sampleAudioUrl.startsWith('/storage/uploads/')) {
      sampleAudioPath = path.join(config.uploadsDir, sampleAudioUrl.replace(/^\/storage\/uploads\//, ''));
    }

    const updatedScenes = await ttsService.generateVoiceForAllScenes(
      scenes,
      { voice, sampleAudioPath, elevenLabsApiKey: config.elevenLabsApiKey },
      (progress) => {
        emitProgress(socketId, {
          step: 'tts_progress',
          message: progress.message,
          percent: Math.round((progress.current / progress.total) * 100),
          current: progress.current,
          total: progress.total,
        });
      }
    );

    // Calculate updated total duration
    const totalDuration = updatedScenes.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0);

    // Auto-save updated scenes into MongoDB ProjectModel
    try {
      await ProjectModel.findOneAndUpdate(
        { projectId: 'current' },
        { scenes: updatedScenes, totalDuration },
        { upsert: true, new: true }
      );
    } catch (saveErr) {
      console.warn('[TTS Auto-Save Warning]', saveErr);
    }

    res.json({ success: true, scenes: updatedScenes, totalDuration });
  } catch (error: any) {
    console.error('[TTS Generate All Error]', error);
    res.status(500).json({ error: error.message || 'Failed to generate voices for scenes.' });
  }
});

export default router;


