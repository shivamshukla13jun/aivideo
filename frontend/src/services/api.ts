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

export const api = {
  async getStatus() {
    try {
      const res = await axios.get(`${API_BASE}/status`, { timeout: 4000 });
      return res.data;
    } catch {
      return { status: 'offline', ffmpegAvailable: false, geminiConfigured: false };
    }
  },

  async generateSlideshow(params: AISlideshowParams) {
    const headers: Record<string, string> = {};
    if (params.apiKey) {
      headers['x-gemini-key'] = params.apiKey;
    }
    const res = await axios.post(`${API_BASE}/ai-generate`, params, { headers });
    return res.data;
  },

  async analyzeImages(formData: FormData, apiKey?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };
    if (apiKey) {
      headers['x-gemini-key'] = apiKey;
    }
    const res = await axios.post(`${API_BASE}/analyze-images`, formData, { headers });
    return res.data;
  },

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async renderVideo(project: Partial<VideoProject>) {
    const res = await axios.post(`${API_BASE}/render`, project);
    return res.data;
  },

  async listVideos() {
    const res = await axios.get(`${API_BASE}/list`);
    return res.data;
  },
};
