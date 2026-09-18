import { apiRequest } from './apiClient';
import { ChapterStory } from '../types';

export const scriptService = {
  async getStoryByChapter(chapterId: string) {
    return apiRequest<ChapterStory | null>(`/api/scripts/chapter/${chapterId}`);
  },
  async buildCompleteStory(chapterId: string) {
    return apiRequest<ChapterStory>('/api/scripts/build-complete-story', {
      method: 'POST',
      body: JSON.stringify({ chapterId })
    });
  },
  async saveStory(chapterId: string, content: string, status: 'draft' | 'saved' = 'saved') {
    return apiRequest<ChapterStory>('/api/scripts/save', {
      method: 'POST',
      body: JSON.stringify({ chapterId, content, status })
    });
  },
  async restoreStoryVersion(chapterId: string, version: number) {
    return apiRequest<ChapterStory>('/api/scripts/restore-version', {
      method: 'POST',
      body: JSON.stringify({ chapterId, version })
    });
  }
};
