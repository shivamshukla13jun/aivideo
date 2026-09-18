import { apiRequest } from './apiClient';
import { Page } from '../types';

export const uploadService = {
  async uploadChapterImages(data: {
    chapterId: string;
    images: { filename: string; dataUrl: string; pageNumber: number }[];
    socketId?: string;
    replaceExisting?: boolean;
    pageOffset?: number;
  }) {
    return apiRequest<{ message: string; completedCount: number; failedIndices: number[]; pages: Page[] }>(
      '/api/uploads/chapter-images',
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    );
  },

  async uploadCBZFile(chapterId: string, file: File, socketId?: string) {
    const formData = new FormData();
    formData.append('chapterId', chapterId);
    formData.append('file', file);
    if (socketId) {
      formData.append('socketId', socketId);
    }
    return apiRequest<{ message: string; completedCount: number; pages: Page[] }>(
      '/api/uploads/cbz',
      {
        method: 'POST',
        body: formData
      }
    );
  }
};

