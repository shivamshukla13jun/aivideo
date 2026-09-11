import axios from 'axios';
import { VideoProject } from '../types/video';

const API_BASE = '/api/video';

export interface AISlideshowParams {
  topic: string;
  slideCount?: number;
  style?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  model?: string;
}

// Configure unlimited timeout globally for AI operations and heavy video processing
axios.defaults.timeout = 0;

export const api = {
  async getStatus() {
    try {
      const res = await axios.get(`${API_BASE}/status`, { timeout: 4000 });
      return res.data;
    } catch {
      return {
        status: 'offline',
        backendApiUrl: '/api/video',
        suwayomiApiUrl: '/suwayomi',
        suwayomiConnected: false,
        mongoConnected: false,
        ffmpegAvailable: false,
        geminiConfigured: false,
        aiProvider: 'gemini',
        configuredInEnv: 'gemini',
        ollamaConnected: false,
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        ollamaModels: [],
      };
    }
  },

  async getAiProviderStatus() {
    try {
      const res = await axios.get(`${API_BASE}/ai-provider`, { timeout: 4000 });
      return res.data;
    } catch (err: any) {
      return {
        success: false,
        activeProvider: 'gemini',
        configuredInEnv: 'gemini',
        gemini: { configured: false },
        ollama: { connected: false, models: [] },
      };
    }
  },

  async getOllamaModels() {
    try {
      const res = await axios.get(`${API_BASE}/ollama/models`, { timeout: 4000 });
      return res.data;
    } catch (err: any) {
      return {
        success: false,
        connected: false,
        models: [],
        error: err.message,
      };
    }
  },

  async generateSlideshow(params: AISlideshowParams) {
    const res = await axios.post(`${API_BASE}/ai-generate`, params, { timeout: 0 });
    return res.data;
  },

  async analyzeImages(formData: FormData) {
    const res = await axios.post(`${API_BASE}/analyze-images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    });
    return res.data;
  },

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    });
    return res.data;
  },

  async uploadMedia(file: File) {
    return this.uploadFile(file);
  },

  async generateStory(params: AISlideshowParams) {
    const data = await this.generateSlideshow(params);
    return data?.data || data;
  },

  async renderVideo(project: Partial<VideoProject>) {
    const res = await axios.post(`${API_BASE}/render`, project, { timeout: 0 });
    return res.data;
  },

  async listVideos() {
    const res = await axios.get(`${API_BASE}/list`);
    return res.data;
  },

  async generateAnimeVideo(params: {
    socketId?: string;
    mangaId?: string | number;
    mangaTitle: string;
    chapterId?: string | number;
    chapterName: string;
    panels: Array<{ pageIndex: number; imageUrl: string }>;
    autoGenerateAudio?: boolean;
    voice?: string;
    sampleAudioUrl?: string;
  }) {
    const res = await axios.post(`${API_BASE}/generate-from-library`, params, { timeout: 0 });
    return res.data;
  },

  /**
   * Real-Time Stream: Generate anime video subtitles with live progress updates
   */
  async generateAnimeVideoWithProgress(
    params: {
      socketId?: string;
      mangaId?: string | number;
      mangaTitle: string;
      chapterId?: string | number;
      chapterName: string;
      panels: Array<{ pageIndex: number; imageUrl: string }>;
      autoGenerateAudio?: boolean;
      voice?: string;
      sampleAudioUrl?: string;
    },
    onProgress: (progress: { step: string; message: string; percent: number }) => void
  ) {
    const response = await fetch(`${API_BASE}/generate-from-library-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response streaming not supported by browser.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/^event:\s*(.+)$/m);
        const dataMatch = block.match(/^data:\s*(.+)$/m);
        const eventName = eventMatch ? eventMatch[1].trim() : 'message';
        const rawData = dataMatch ? dataMatch[1].trim() : '';

        if (!rawData) continue;
        try {
          const parsed = JSON.parse(rawData);
          if (eventName === 'progress') {
            onProgress(parsed);
          } else if (eventName === 'complete') {
            finalResult = parsed;
          } else if (eventName === 'error') {
            throw new Error(parsed.message || 'Stream processing failed.');
          }
        } catch (parseErr: any) {
          if (eventName === 'error') throw parseErr;
        }
      }
    }

    if (finalResult) {
      return finalResult;
    }
    throw new Error('Stream finished without complete payload.');
  },

  async getStoryMemory(mangaTitle: string, mangaId?: string | number) {
    const query = mangaId ? `?mangaId=${encodeURIComponent(String(mangaId))}` : '';
    const res = await axios.get(`${API_BASE}/story-memory/${encodeURIComponent(mangaTitle)}${query}`);
    return res.data?.memory;
  },

  async getStoryMemories() {
    const res = await axios.get(`${API_BASE}/story-memories`);
    return res.data?.memories || [];
  },

  async saveStoryMemory(mangaTitle: string, memory: any) {
    const res = await axios.post(`${API_BASE}/story-memory/${encodeURIComponent(mangaTitle)}`, memory);
    return res.data?.memory;
  },

  async deleteStoryMemory(mangaTitle: string) {
    const res = await axios.delete(`${API_BASE}/story-memory/${encodeURIComponent(mangaTitle)}`);
    return res.data;
  },

  async getChapterCache(chapterId: string | number, mangaId?: string | number) {
    const query = mangaId ? `?mangaId=${encodeURIComponent(String(mangaId))}` : '';
    const res = await axios.get(`${API_BASE}/chapter-cache/${encodeURIComponent(String(chapterId))}${query}`);
    return res.data;
  },

  async clearChapterCache(chapterId: string | number) {
    const res = await axios.delete(`${API_BASE}/chapter-cache/${encodeURIComponent(String(chapterId))}`);
    return res.data;
  },

  /**
   * Continuous silent auto-save of studio project into MongoDB
   */
  async saveCurrentProject(projectData: any) {
    try {
      const res = await axios.post(`${API_BASE}/project/current`, projectData);
      return res.data?.project;
    } catch (err) {
      console.warn('[Auto-Save Project Silent Error]', err);
      return null;
    }
  },

  /**
   * Retrieve auto-saved studio project from MongoDB
   */
  async getCurrentProject() {
    try {
      const res = await axios.get(`${API_BASE}/project/current`);
      return res.data?.project;
    } catch {
      return null;
    }
  },

  /**
   * Get list of supported Neural Voices
   */
  async getTtsVoices() {
    try {
      const res = await axios.get(`${API_BASE}/tts/voices`);
      return res.data?.voices || [];
    } catch {
      return [];
    }
  },

  /**
   * Upload User Voice Sample for Cloning
   */
  async uploadSampleAudio(file: File) {
    const formData = new FormData();
    formData.append('sampleAudio', file);
    const res = await axios.post(`${API_BASE}/tts/upload-sample`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    });
    return res.data;
  },

  /**
   * Generate Audio for a Single Scene
   */
  async generateSceneVoice(params: {
    scene: any;
    voice?: string;
    sampleAudioUrl?: string;
    text?: string;
  }) {
    const res = await axios.post(`${API_BASE}/tts/generate-scene`, params, { timeout: 0 });
    return res.data?.scene;
  },

  /**
   * Generate Audio for All Scenes (Batch)
   */
  async generateAllScenesVoice(params: {
    scenes: any[];
    voice?: string;
    sampleAudioUrl?: string;
    socketId?: string;
  }) {
    const res = await axios.post(`${API_BASE}/tts/generate-all`, params, { timeout: 0 });
    return res.data;
  },
};
