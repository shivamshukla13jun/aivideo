import axios from 'axios';
import { VideoProject } from '../types/video';

const API_BASE = '/api/video';

export interface AISlideshowParams {
  topic: string;
  slideCount?: number;
  style?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  model?: string;
  apiKey?: string;
}

// Configure unlimited timeout globally for Gemini AI and heavy video processing
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
      };
    }
  },

  async generateSlideshow(params: AISlideshowParams) {
    const headers: Record<string, string> = {};
    if (params.apiKey) {
      headers['x-gemini-key'] = params.apiKey;
    }
    const res = await axios.post(`${API_BASE}/ai-generate`, params, { headers, timeout: 0 });
    return res.data;
  },

  async analyzeImages(formData: FormData, apiKey?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };
    if (apiKey) {
      headers['x-gemini-key'] = apiKey;
    }
    const res = await axios.post(`${API_BASE}/analyze-images`, formData, { headers, timeout: 0 });
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
    apiKey?: string;
  }) {
    const headers: Record<string, string> = {};
    if (params.apiKey) {
      headers['x-gemini-key'] = params.apiKey;
    }
    const res = await axios.post(`${API_BASE}/generate-from-library`, params, { headers, timeout: 0 });
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
      apiKey?: string;
    },
    onProgress: (progress: { step: string; message: string; percent: number }) => void
  ) {

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (params.apiKey) {
      headers['x-gemini-key'] = params.apiKey;
    }

    const response = await fetch(`${API_BASE}/generate-from-library-stream`, {
      method: 'POST',
      headers,
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
};



