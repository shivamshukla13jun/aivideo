import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface VideoStudioState {
  isPlaying: boolean;
  currentTime: number;
  timelineZoom: number;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSaved: string | null;
}

const initialState: VideoStudioState = {
  isPlaying: false,
  currentTime: 0,
  timelineZoom: 1,
  saveStatus: 'saved',
  lastSaved: 'Just now',
};

export const videoStudioSlice = createSlice({
  name: 'videoStudio',
  initialState,
  reducers: {
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    setCurrentTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload;
    },
    setTimelineZoom: (state, action: PayloadAction<number>) => {
      state.timelineZoom = action.payload;
    },
    setSaveStatus: (state, action: PayloadAction<'saved' | 'saving' | 'unsaved'>) => {
      state.saveStatus = action.payload;
      if (action.payload === 'saved') {
        state.lastSaved = new Date().toLocaleTimeString();
      }
    },
  },
});

export const { setIsPlaying, setCurrentTime, setTimelineZoom, setSaveStatus } = videoStudioSlice.actions;
export default videoStudioSlice.reducer;
