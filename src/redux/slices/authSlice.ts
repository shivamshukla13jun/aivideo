import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../../types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const loadPersistedAuth = (): Partial<AuthState> => {
  try {
    const token = localStorage.getItem('webtoon_token');
    const refreshToken = localStorage.getItem('webtoon_refresh_token');
    const userJson = localStorage.getItem('webtoon_user');
    if (token && userJson) {
      return {
        token,
        refreshToken: refreshToken || 'demo-refresh-token',
        user: JSON.parse(userJson),
        isAuthenticated: true
      };
    }
  } catch {}
  return {};
};

const defaultUser: User = {
  id: 'usr_demo123',
  email: 'creator@webtoonstudio.com',
  name: 'Comic Creator',
  role: 'creator',
  referenceVoice: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const initialState: AuthState = {
  user: defaultUser,
  token: 'demo-jwt-token',
  refreshToken: 'demo-refresh-token',
  isAuthenticated: true,
  loading: false,
  error: null,
  ...loadPersistedAuth()
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ user: User; token: string; refreshToken?: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
      state.isAuthenticated = true;
      state.error = null;

      try {
        localStorage.setItem('webtoon_token', action.payload.token);
        if (action.payload.refreshToken) {
          localStorage.setItem('webtoon_refresh_token', action.payload.refreshToken);
        }
        localStorage.setItem('webtoon_user', JSON.stringify(action.payload.user));
      } catch {}
    },
    updateUserReferenceVoice: (state, action: PayloadAction<any>) => {
      if (state.user) {
        state.user.referenceVoice = action.payload;
        try {
          localStorage.setItem('webtoon_user', JSON.stringify(state.user));
        } catch {}
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;

      try {
        localStorage.removeItem('webtoon_token');
        localStorage.removeItem('webtoon_refresh_token');
        localStorage.removeItem('webtoon_user');
      } catch {}
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    }
  }
});

export const { setAuth, updateUserReferenceVoice, logout, setAuthError } = authSlice.actions;
export default authSlice.reducer;
