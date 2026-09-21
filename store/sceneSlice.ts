import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IScene } from '@/types';

interface SceneState {
  scenes: IScene[];
  activeSceneId: string | null;
  loading: boolean;
}

const initialState: SceneState = {
  scenes: [],
  activeSceneId: null,
  loading: false,
};

export const sceneSlice = createSlice({
  name: 'scene',
  initialState,
  reducers: {
    setScenes: (state, action: PayloadAction<IScene[]>) => {
      state.scenes = action.payload;
    },
    setActiveSceneId: (state, action: PayloadAction<string | null>) => {
      state.activeSceneId = action.payload;
    },
    updateScene: (state, action: PayloadAction<IScene>) => {
      const idx = state.scenes.findIndex(s => s._id === action.payload._id);
      if (idx !== -1) {
        state.scenes[idx] = action.payload;
      }
    },
  },
});

export const { setScenes, setActiveSceneId, updateScene } = sceneSlice.actions;
export default sceneSlice.reducer;
