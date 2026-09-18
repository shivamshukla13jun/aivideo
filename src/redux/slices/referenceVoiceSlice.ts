import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ReferenceVoice } from '../../types';

interface ReferenceVoiceState {
  voice: ReferenceVoice | null;
  loading: boolean;
  error: string | null;
}

const initialState: ReferenceVoiceState = {
  voice: null,
  loading: false,
  error: null
};

export const referenceVoiceSlice = createSlice({
  name: 'referenceVoice',
  initialState,
  reducers: {
    setReferenceVoice: (state, action: PayloadAction<ReferenceVoice | null>) => {
      state.voice = action.payload;
    },
    removeReferenceVoice: (state) => {
      state.voice = null;
    }
  }
});

export const { setReferenceVoice, removeReferenceVoice } = referenceVoiceSlice.actions;
export default referenceVoiceSlice.reducer;
