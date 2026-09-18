import { apiRequest } from './apiClient';
import { VideoProject } from '../types';

export const videoProjectService = {
  async getVideoProjects() {
    return apiRequest<VideoProject[]>('/api/video-projects');
  },
  async getVideoProjectById(id: string) {
    return apiRequest<VideoProject>(`/api/video-projects/${id}`);
  },
  async createVideoProject(data: { chapterId?: string; title?: string; settings?: VideoProject['settings']; autoGenerateFromChapter?: boolean }) {
    return apiRequest<VideoProject>('/api/video-projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateVideoProject(id: string, project: Partial<VideoProject>) {
    return apiRequest<VideoProject>(`/api/video-projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project)
    });
  },
  async deleteVideoProject(id: string) {
    return apiRequest<{ message: string }>(`/api/video-projects/${id}`, {
      method: 'DELETE'
    });
  },
  async syncVideoProject(id: string) {
    return apiRequest<VideoProject>(`/api/video-projects/${id}/sync`, {
      method: 'POST'
    });
  },
  async startRender(projectId: string, socketId?: string) {
    return apiRequest<{ message: string; projectId: string }>('/api/render/start', {
      method: 'POST',
      body: JSON.stringify({ projectId, socketId })
    });
  }
};
