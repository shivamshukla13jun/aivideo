import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IChapter, IPage } from '@/types';

interface ChapterState {
  activeChapter: IChapter | null;
  pages: IPage[];
  uploadProgress: {
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
    progress: number;
    message: string;
  };
  loading: boolean;
}

const initialState: ChapterState = {
  activeChapter: null,
  pages: [],
  uploadProgress: {
    status: 'idle',
    progress: 0,
    message: '',
  },
  loading: false,
};

export const chapterSlice = createSlice({
  name: 'chapter',
  initialState,
  reducers: {
    setActiveChapter: (state, action: PayloadAction<IChapter | null>) => {
      state.activeChapter = action.payload;
    },
    setPages: (state, action: PayloadAction<IPage[]>) => {
      state.pages = action.payload;
    },
    setUploadProgress: (state, action: PayloadAction<{ status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'; progress: number; message: string }>) => {
      state.uploadProgress = action.payload;
    },
    updatePageOrder: (state, action: PayloadAction<IPage[]>) => {
      state.pages = action.payload;
    },
  },
});

export const { setActiveChapter, setPages, setUploadProgress, updatePageOrder } = chapterSlice.actions;
export default chapterSlice.reducer;
