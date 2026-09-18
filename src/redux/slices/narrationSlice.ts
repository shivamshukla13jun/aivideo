import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GeneratedNarration } from '../../types';

interface NarrationState {
  items: GeneratedNarration[];
  loading: boolean;
  error: string | null;
}

const initialState: NarrationState = {
  items: [],
  loading: false,
  error: null
};

export const narrationSlice = createSlice({
  name: 'narration',
  initialState,
  reducers: {
    setNarrations: (state, action: PayloadAction<GeneratedNarration[]>) => {
      state.items = action.payload;
    },
    addNarration: (state, action: PayloadAction<GeneratedNarration>) => {
      state.items.push(action.payload);
    },
    removeNarration: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((n) => n.id !== action.payload);
    }
  }
});

export const { setNarrations, addNarration, removeNarration } = narrationSlice.actions;
export default narrationSlice.reducer;
