import { apiRequest } from './apiClient';
import { Asset } from '../types';

export const assetService = {
  async getAssets() {
    return apiRequest<Asset[]>('/api/assets');
  },
  async createAsset(data: { title: string; type: Asset['type']; fileUrl: string; duration?: number; width?: number; height?: number }) {
    return apiRequest<Asset>('/api/assets', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async deleteAsset(id: string) {
    return apiRequest<{ message: string }>(`/api/assets/${id}`, {
      method: 'DELETE'
    });
  }
};
