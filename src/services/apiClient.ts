import { store } from '../redux/store';
import { setAuth, logout } from '../redux/slices/authSlice';

let isRefreshing = false;

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const state = store.getState();
  const token = state.auth.token;

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(endpoint, {
    ...options,
    headers
  });

  // If 401 unauthorized, attempt auto-refresh or fallback gracefully
  if (response.status === 401 && !isRefreshing && !endpoint.includes('/api/auth/')) {
    const refreshToken = store.getState().auth.refreshToken;
    if (refreshToken) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (refreshRes.ok) {
          const { token: newToken } = await refreshRes.json();
          const currentUser = store.getState().auth.user;
          if (currentUser) {
            store.dispatch(setAuth({ user: currentUser, token: newToken, refreshToken }));
          }
          // Retry original request with new token
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(endpoint, {
            ...options,
            headers
          });
        }
      } catch (err) {
        console.warn('Silent token refresh failed:', err);
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}
