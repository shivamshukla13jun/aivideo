import { apiRequest } from './apiClient';
import { Scene } from '../types';

export const sceneService = {
  async getScenesByChapter(chapterId: string) {
    return apiRequest<Scene[]>(`/api/scenes/chapter/${chapterId}`);
  },
  async createScene(data: Partial<Scene>) {
    return apiRequest<Scene>('/api/scenes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateScene(id: string, data: Partial<Scene>) {
    return apiRequest<Scene>(`/api/scenes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteScene(id: string) {
    return apiRequest<{ message: string }>(`/api/scenes/${id}`, {
      method: 'DELETE'
    });
  },
  async reorderScenes(chapterId: string, scenes: Scene[]) {
    return apiRequest<{ scenes: Scene[] }>('/api/scenes/reorder', {
      method: 'POST',
      body: JSON.stringify({ chapterId, scenes })
    });
  },
  async aiExtractScene(data: { imageUrl?: string; pageId?: string }) {
    return apiRequest<{ characters: string[]; narration: string; dialogue: string; emotion: string; duration: number }>('/api/scenes/ai-extract', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};
