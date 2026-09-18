import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ReaderState {
  currentPage: number;
  totalPages: number;
  zoom: number; // 100% default
  fitWidth: boolean;
  isFullscreen: boolean;
  showSceneDrawer: boolean;
  activePageIdForScene: string | null;
}

const initialState: ReaderState = {
  currentPage: 1,
  totalPages: 1,
  zoom: 100,
  fitWidth: true,
  isFullscreen: false,
  showSceneDrawer: false,
  activePageIdForScene: null
};

export const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setTotalPages: (state, action: PayloadAction<number>) => {
      state.totalPages = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(50, Math.min(300, action.payload));
    },
    setFitWidth: (state, action: PayloadAction<boolean>) => {
      state.fitWidth = action.payload;
    },
    setIsFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isFullscreen = action.payload;
    },
    openSceneDrawerForPage: (state, action: PayloadAction<string>) => {
      state.activePageIdForScene = action.payload;
      state.showSceneDrawer = true;
    },
    closeSceneDrawer: (state) => {
      state.showSceneDrawer = false;
      state.activePageIdForScene = null;
    }
  }
});

export const {
  setCurrentPage,
  setTotalPages,
  setZoom,
  setFitWidth,
  setIsFullscreen,
  openSceneDrawerForPage,
  closeSceneDrawer
} = readerSlice.actions;

export default readerSlice.reducer;
