import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Scene } from '../../types';

interface SceneState {
  items: Scene[];
  loading: boolean;
  error: string | null;
}

const initialState: SceneState = {
  items: [],
  loading: false,
  error: null
};

export const sceneSlice = createSlice({
  name: 'scene',
  initialState,
  reducers: {
    setScenes: (state, action: PayloadAction<Scene[]>) => {
      state.items = action.payload;
    },
    addSceneItem: (state, action: PayloadAction<Scene>) => {
      state.items.push(action.payload);
    },
    updateSceneItem: (state, action: PayloadAction<Scene>) => {
      const idx = state.items.findIndex((s) => s.id === action.payload.id);
      if (idx !== -1) {
        state.items[idx] = action.payload;
      }
    },
    removeSceneItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((s) => s.id !== action.payload);
    }
  }
});

export const { setScenes, addSceneItem, updateSceneItem, removeSceneItem } = sceneSlice.actions;
export default sceneSlice.reducer;
