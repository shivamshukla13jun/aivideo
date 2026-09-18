import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  activeTab: 'dashboard' | 'series' | 'chapters' | 'reader' | 'story-studio' | 'voice' | 'video-studio' | 'assets' | 'settings';
  activeChapterId: string | null;
  activeSeriesId: string | null;
  activeVideoProjectId: string | null;
  theme: 'dark';
  sidebarOpen: boolean;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  authModalOpen: boolean;
  authModalMode: 'login' | 'register';
}

const initialState: UIState = {
  activeTab: 'dashboard',
  activeChapterId: 'ch_001',
  activeSeriesId: 'srs_shadow_reborn',
  activeVideoProjectId: null,
  theme: 'dark',
  sidebarOpen: true,
  notification: null,
  authModalOpen: false,
  authModalMode: 'login'
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<UIState['activeTab']>) => {
      state.activeTab = action.payload;
    },
    setActiveChapterId: (state, action: PayloadAction<string | null>) => {
      state.activeChapterId = action.payload;
    },
    setActiveSeriesId: (state, action: PayloadAction<string | null>) => {
      state.activeSeriesId = action.payload;
    },
    setActiveVideoProjectId: (state, action: PayloadAction<string | null>) => {
      state.activeVideoProjectId = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    openAuthModal: (state, action: PayloadAction<'login' | 'register' | undefined>) => {
      state.authModalOpen = true;
      if (action.payload) {
        state.authModalMode = action.payload;
      }
    },
    closeAuthModal: (state) => {
      state.authModalOpen = false;
    },
    setAuthModalMode: (state, action: PayloadAction<'login' | 'register'>) => {
      state.authModalMode = action.payload;
    },
    showNotification: (state, action: PayloadAction<{ message: string; type: 'success' | 'error' | 'info' }>) => {
      state.notification = action.payload;
    },
    clearNotification: (state) => {
      state.notification = null;
    }
  }
});

export const {
  setActiveTab,
  setActiveChapterId,
  setActiveSeriesId,
  setActiveVideoProjectId,
  toggleSidebar,
  openAuthModal,
  closeAuthModal,
  setAuthModalMode,
  showNotification,
  clearNotification
} = uiSlice.actions;

export default uiSlice.reducer;
