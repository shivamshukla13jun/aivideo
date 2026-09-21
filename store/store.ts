import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import seriesReducer from './seriesSlice';
import libraryReducer from './librarySlice';
import chapterReducer from './chapterSlice';
import cbzEditorReducer from './cbzEditorSlice';
import sceneReducer from './sceneSlice';
import videoStudioReducer from './videoStudioSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    series: seriesReducer,
    library: libraryReducer,
    chapter: chapterReducer,
    cbzEditor: cbzEditorReducer,
    scene: sceneReducer,
    videoStudio: videoStudioReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
