import { apiRequest } from './apiClient';
import { User } from '../types';

export const authService = {
  async register(data: { email: string; password: string; name?: string }) {
    return apiRequest<{ user: User; token: string; refreshToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async login(data: { email: string; password: string }) {
    return apiRequest<{ user: User; token: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async me() {
    return apiRequest<{ user: User }>('/api/auth/me');
  },
  async refreshToken(refreshToken: string) {
    return apiRequest<{ token: string }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }
};
