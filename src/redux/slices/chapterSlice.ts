import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Chapter } from '../../types';

interface ChapterState {
  items: Chapter[];
  currentChapter: Chapter | null;
  loading: boolean;
  error: string | null;
}

const initialState: ChapterState = {
  items: [],
  currentChapter: null,
  loading: false,
  error: null
};

export const chapterSlice = createSlice({
  name: 'chapter',
  initialState,
  reducers: {
    setChapters: (state, action: PayloadAction<Chapter[]>) => {
      state.items = action.payload;
    },
    setCurrentChapter: (state, action: PayloadAction<Chapter | null>) => {
      state.currentChapter = action.payload;
    },
    addChapterItem: (state, action: PayloadAction<Chapter>) => {
      state.items.push(action.payload);
    },
    updateChapterItem: (state, action: PayloadAction<Chapter>) => {
      const idx = state.items.findIndex((c) => c.id === action.payload.id);
      if (idx !== -1) {
        state.items[idx] = action.payload;
      }
      if (state.currentChapter?.id === action.payload.id) {
        state.currentChapter = action.payload;
      }
    },
    removeChapterItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((c) => c.id !== action.payload);
      if (state.currentChapter?.id === action.payload) {
        state.currentChapter = null;
      }
    }
  }
});

export const { setChapters, setCurrentChapter, addChapterItem, updateChapterItem, removeChapterItem } = chapterSlice.actions;
export default chapterSlice.reducer;
