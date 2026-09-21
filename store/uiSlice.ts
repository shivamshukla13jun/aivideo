import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  activeModal: string | null;
  modalData: any | null;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
}

const initialState: UIState = {
  theme: 'light',
  sidebarOpen: false,
  activeModal: null,
  modalData: null,
  notification: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    openModal: (state, action: PayloadAction<{ modal: string; data?: any }>) => {
      state.activeModal = action.payload.modal;
      state.modalData = action.payload.data || null;
    },
    closeModal: (state) => {
      state.activeModal = null;
      state.modalData = null;
    },
    showNotification: (state, action: PayloadAction<{ message: string; type?: 'success' | 'error' | 'info' }>) => {
      state.notification = {
        message: action.payload.message,
        type: action.payload.type || 'success',
      };
    },
    clearNotification: (state) => {
      state.notification = null;
    },
  },
});

export const { setTheme, toggleSidebar, openModal, closeModal, showNotification, clearNotification } = uiSlice.actions;
export default uiSlice.reducer;
