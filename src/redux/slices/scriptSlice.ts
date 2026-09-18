import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChapterStory } from '../../types';

interface ScriptState {
  currentStory: ChapterStory | null;
  loading: boolean;
  error: string | null;
}

const initialState: ScriptState = {
  currentStory: null,
  loading: false,
  error: null
};

export const scriptSlice = createSlice({
  name: 'script',
  initialState,
  reducers: {
    setStory: (state, action: PayloadAction<ChapterStory | null>) => {
      state.currentStory = action.payload;
    },
    updateStoryContent: (state, action: PayloadAction<string>) => {
      if (state.currentStory) {
        state.currentStory.content = action.payload;
      }
    }
  }
});

export const { setStory, updateStoryContent } = scriptSlice.actions;
export default scriptSlice.reducer;
