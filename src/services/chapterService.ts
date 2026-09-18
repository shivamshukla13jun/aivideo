import { apiRequest } from './apiClient';
import { Chapter, Page, Scene, ChapterStory, GeneratedNarration } from '../types';

export const chapterService = {
  async getChaptersBySeries(seriesId: string) {
    return apiRequest<Chapter[]>(`/api/chapters/series/${seriesId}`);
  },
  async getChapterById(id: string) {
    return apiRequest<Chapter & { pages: Page[]; scenes: Scene[]; story: ChapterStory | null; narrations: GeneratedNarration[] }>(`/api/chapters/${id}`);
  },
  async createChapter(data: Partial<Chapter>) {
    return apiRequest<Chapter>('/api/chapters', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateChapter(id: string, data: Partial<Chapter>) {
    return apiRequest<Chapter>(`/api/chapters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteChapter(id: string) {
    return apiRequest<{ message: string }>(`/api/chapters/${id}`, {
      method: 'DELETE'
    });
  }
};
