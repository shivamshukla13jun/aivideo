import { apiRequest } from './apiClient';
import { Series, Chapter } from '../types';

export const seriesService = {
  async getSeriesList() {
    return apiRequest<Series[]>('/api/series');
  },
  async getSeriesById(id: string) {
    return apiRequest<{ series: Series; chapters: Chapter[] }>(`/api/series/${id}`);
  },
  async createSeries(data: Partial<Series>) {
    return apiRequest<Series>('/api/series', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateSeries(id: string, data: Partial<Series>) {
    return apiRequest<Series>(`/api/series/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteSeries(id: string) {
    return apiRequest<{ message: string }>(`/api/series/${id}`, {
      method: 'DELETE'
    });
  }
};
