import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import seriesReducer from './slices/seriesSlice';
import chapterReducer from './slices/chapterSlice';
import readerReducer from './slices/readerSlice';
import sceneReducer from './slices/sceneSlice';
import scriptReducer from './slices/scriptSlice';
import referenceVoiceReducer from './slices/referenceVoiceSlice';
import narrationReducer from './slices/narrationSlice';
import assetReducer from './slices/assetSlice';
import videoEditorReducer from './slices/videoEditorSlice';
import uploadReducer from './slices/uploadSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    series: seriesReducer,
    chapter: chapterReducer,
    reader: readerReducer,
    scene: sceneReducer,
    script: scriptReducer,
    referenceVoice: referenceVoiceReducer,
    narration: narrationReducer,
    asset: assetReducer,
    videoEditor: videoEditorReducer,
    upload: uploadReducer,
    ui: uiReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
