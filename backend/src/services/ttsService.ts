import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
// @ts-ignore
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
// @ts-ignore
import getMP3Duration from 'get-mp3-duration';
import { config } from '../config';

export interface TTSVoiceOption {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  description: string;
  sample?: string;
}

export interface GenerateSpeechOptions {
  text: string;
  voice?: string;
  sampleAudioPath?: string;
  elevenLabsApiKey?: string;
}

export interface GeneratedSpeechResult {
  audioUrl: string;
  duration: number;
  filename: string;
  engine: 'edge-neural' | 'elevenlabs-cloned';
}

export const POPULAR_VOICES: TTSVoiceOption[] = [
  {
    id: 'hi-IN-MadhurNeural',
    name: 'Madhur (मधुर)',
    language: 'hi-IN (हिंदी)',
    gender: 'male',
    description: 'गंभीर, शक्तिशाली और स्पष्ट कथावाचक (एनीमे नरेटर व मुख्य पात्र)',
  },
  {
    id: 'hi-IN-SwaraNeural',
    name: 'Swara (स्वरा)',
    language: 'hi-IN (हिंदी)',
    gender: 'female',
    description: 'मधुर, संवेदनशील और प्रभावशाली महिला आवाज़',
  },
  {
    id: 'en-US-ChristopherNeural',
    name: 'Christopher (Anime Narrator)',
    language: 'en-US (English)',
    gender: 'male',
    description: 'Deep, cinematic anime narrator voice (Dark Fantasy / Epic)',
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy (Shonen Hero)',
    language: 'en-US (English)',
    gender: 'male',
    description: 'Energetic, brave protagonist voice (Action / Adventure)',
  },
  {
    id: 'en-US-JennyNeural',
    name: 'Jenny (Warm Heroine)',
    language: 'en-US (English)',
    gender: 'female',
    description: 'Warm, expressive female voice (Anime / Drama)',
  },
  {
    id: 'en-US-AriaNeural',
    name: 'Aria (Storyteller)',
    language: 'en-US (English)',
    gender: 'female',
    description: 'Polished, dynamic storytelling voice',
  },
  {
    id: 'ja-JP-KeitaNeural',
    name: 'Keita (けいた)',
    language: 'ja-JP (Japanese)',
    gender: 'male',
    description: 'Classic Japanese anime male voice',
  },
  {
    id: 'ja-JP-NanamiNeural',
    name: 'Nanami (ななみ)',
    language: 'ja-JP (Japanese)',
    gender: 'female',
    description: 'Classic Japanese anime female voice',
  },
];

export class TtsService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = config.uploadsDir;
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Get list of high-quality neural voices
   */
  getVoices(): TTSVoiceOption[] {
    return POPULAR_VOICES;
  }

  /**
   * Generates speech for a given text string.
   * If sample audio and ElevenLabs API key are provided, it performs instant voice cloning.
   * Otherwise, it uses Microsoft Edge Neural TTS with zero cost and ultra-realistic delivery.
   */
  async generateSpeech(options: GenerateSpeechOptions): Promise<GeneratedSpeechResult> {
    const { text, voice = 'hi-IN-MadhurNeural', sampleAudioPath, elevenLabsApiKey } = options;

    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('TTS generation requires non-empty text.');
    }

    // 1. Try ElevenLabs Voice Cloning if API key and sample audio are available
    const effectiveElevenLabsKey = elevenLabsApiKey || config.elevenLabsApiKey;
    if (effectiveElevenLabsKey && sampleAudioPath && fs.existsSync(sampleAudioPath)) {
      try {
        return await this.generateElevenLabsClonedSpeech(cleanText, sampleAudioPath, effectiveElevenLabsKey);
      } catch (err: any) {
        console.warn('[TTS] ElevenLabs voice clone failed, falling back to Edge Neural TTS:', err?.message || err);
      }
    }

    // 2. Generate with Microsoft Edge Neural TTS (ultra-high fidelity)
    return await this.generateEdgeNeuralSpeech(cleanText, voice);
  }

  /**
   * Microsoft Edge Neural Speech Generator
   */
  private async generateEdgeNeuralSpeech(text: string, voice: string): Promise<GeneratedSpeechResult> {
    const tempDir = path.join(this.uploadsDir, `tts_tmp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const tts = new MsEdgeTTS();
      // Ensure the voice is supported or fallback to Madhur / Christopher
      const selectedVoice = POPULAR_VOICES.some((v) => v.id === voice) ? voice : 'hi-IN-MadhurNeural';
      await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      const result = await tts.toFile(tempDir, text);

      const finalFilename = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
      const finalPath = path.join(this.uploadsDir, finalFilename);

      fs.copyFileSync(result.audioFilePath, finalPath);

      // Measure duration
      const buffer = fs.readFileSync(finalPath);
      let duration = 3.0;
      try {
        const durationMs = getMP3Duration(buffer);
        duration = parseFloat((durationMs / 1000).toFixed(2));
      } catch {
        duration = parseFloat((buffer.length / 12000).toFixed(2));
      }

      return {
        audioUrl: `/storage/uploads/${finalFilename}`,
        duration: Math.max(1, duration),
        filename: finalFilename,
        engine: 'edge-neural',
      };
    } finally {
      if (fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup error
        }
      }
    }
  }

  /**
   * ElevenLabs Voice Cloning Speech Generator using user's sample audio
   */
  private async generateElevenLabsClonedSpeech(
    text: string,
    sampleAudioPath: string,
    apiKey: string
  ): Promise<GeneratedSpeechResult> {
    // 1. Upload user's sample audio to create an instant voice clone
    const form = new FormData();
    form.append('name', `MangaVoice_${Date.now()}`);
    form.append('description', 'User uploaded anime narrator voice sample');
    form.append('files', fs.createReadStream(sampleAudioPath));

    const addVoiceRes = await axios.post('https://api.elevenlabs.io/v1/voices/add', form, {
      headers: {
        'xi-api-key': apiKey,
        ...form.getHeaders(),
      },
      timeout: 30000,
    });

    const voiceId = addVoiceRes.data?.voice_id;
    if (!voiceId) {
      throw new Error('ElevenLabs failed to create voice clone from sample audio.');
    }

    // 2. Synthesize speech using the newly cloned voice
    const ttsRes = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
      },
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 45000,
      }
    );

    const finalFilename = `voice_cloned_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
    const finalPath = path.join(this.uploadsDir, finalFilename);
    fs.writeFileSync(finalPath, Buffer.from(ttsRes.data));

    const buffer = fs.readFileSync(finalPath);
    let duration = 3.0;
    try {
      const durationMs = getMP3Duration(buffer);
      duration = parseFloat((durationMs / 1000).toFixed(2));
    } catch {
      duration = parseFloat((buffer.length / 16000).toFixed(2));
    }

    return {
      audioUrl: `/storage/uploads/${finalFilename}`,
      duration: Math.max(1, duration),
      filename: finalFilename,
      engine: 'elevenlabs-cloned',
    };
  }

  /**
   * Generates audio for a single scene and attaches it as an AudioClip.
   * Also synchronizes scene duration with audio duration so slide pacing is perfect!
   */
  async generateVoiceForScene(
    scene: any,
    options: { voice?: string; sampleAudioPath?: string; elevenLabsApiKey?: string; text?: string }
  ): Promise<any> {
    const textToSpeak =
      options.text ||
      (scene.subtitles && scene.subtitles.length > 0 ? scene.subtitles.map((s: any) => s.text).join(' ') : '') ||
      scene.narration ||
      scene.title ||
      '';

    if (!textToSpeak.trim()) {
      return scene;
    }

    const speechResult = await this.generateSpeech({
      text: textToSpeak,
      voice: options.voice,
      sampleAudioPath: options.sampleAudioPath,
      elevenLabsApiKey: options.elevenLabsApiKey,
    });

    // Auto adjust scene duration so audio never cuts off (audio duration + 0.4s buffer)
    const newDuration = Math.max(Number(scene.duration) || 3, parseFloat((speechResult.duration + 0.4).toFixed(1)));

    const audioClip = {
      id: `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      url: speechResult.audioUrl,
      name: `वॉइसओवर (${speechResult.engine === 'elevenlabs-cloned' ? 'सैंपल क्लोन' : options.voice || 'न्यूरल'})`,
      duration: speechResult.duration,
      startTime: 0,
      volume: 1,
      type: 'voiceover',
    };

    // Update subtitles timing if present to match the audio
    const updatedSubtitles = (scene.subtitles || []).map((sub: any, i: number, arr: any[]) => {
      const totalSubs = arr.length;
      const subDuration = speechResult.duration / totalSubs;
      return {
        ...sub,
        startTime: parseFloat((i * subDuration).toFixed(2)),
        endTime: parseFloat(((i + 1) * subDuration).toFixed(2)),
      };
    });

    return {
      ...scene,
      duration: newDuration,
      subtitles: updatedSubtitles.length > 0 ? updatedSubtitles : scene.subtitles,
      audioClips: [audioClip],
    };
  }

  /**
   * Generates voiceover for all scenes sequentially, emitting progress
   */
  async generateVoiceForAllScenes(
    scenes: any[],
    options: { voice?: string; sampleAudioPath?: string; elevenLabsApiKey?: string },
    onProgress?: (progress: { current: number; total: number; message: string; sceneIndex: number }) => void
  ): Promise<any[]> {
    const updatedScenes: any[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: scenes.length,
          message: `सीन ${i + 1}/${scenes.length} के लिए ऑडियो व वॉइसओवर तैयार हो रहा है... 🎙️`,
          sceneIndex: i,
        });
      }

      try {
        const updatedScene = await this.generateVoiceForScene(scene, options);
        updatedScenes.push(updatedScene);
      } catch (err: any) {
        console.error(`[TTS] Error generating voice for scene ${i + 1}:`, err?.message || err);
        updatedScenes.push(scene); // fallback without audio
      }
    }

    return updatedScenes;
  }
}

export const ttsService = new TtsService();
