import { apiRequest } from './apiClient';
import { ReferenceVoice } from '../types';

export const voiceService = {
  async getReferenceVoice() {
    return apiRequest<{ referenceVoice: ReferenceVoice | null }>('/api/reference-voice');
  },
  async setReferenceVoice(data: { file?: File; audioUrl?: string; provider?: string; voiceId?: string; name?: string }) {
    if (data.file) {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.name) formData.append('name', data.name);
      if (data.provider) formData.append('provider', data.provider);
      if (data.voiceId) formData.append('voiceId', data.voiceId);

      return apiRequest<{ referenceVoice: ReferenceVoice }>('/api/reference-voice', {
        method: 'POST',
        body: formData
      });
    }

    return apiRequest<{ referenceVoice: ReferenceVoice }>('/api/reference-voice', {
      method: 'POST',
      body: JSON.stringify({
        audioUrl: data.audioUrl,
        provider: data.provider,
        voiceId: data.voiceId,
        name: data.name
      })
    });
  },
  async deleteReferenceVoice() {
    return apiRequest<{ message: string }>('/api/reference-voice', {
      method: 'DELETE'
    });
  }
};
