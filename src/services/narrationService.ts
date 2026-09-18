import { apiRequest } from './apiClient';
import { GeneratedNarration } from '../types';

export const narrationService = {
  async getNarrationsByChapter(chapterId: string) {
    return apiRequest<GeneratedNarration[]>(`/api/narration/chapter/${chapterId}`);
  },
  async generateNarration(chapterId: string) {
    return apiRequest<GeneratedNarration>('/api/narration/generate', {
      method: 'POST',
      body: JSON.stringify({ chapterId })
    });
  },
  async deleteNarration(id: string) {
    return apiRequest<{ message: string }>(`/api/narration/${id}`, {
      method: 'DELETE'
    });
  }
};
