import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Asset } from '../../types';

interface AssetState {
  items: Asset[];
  loading: boolean;
  error: string | null;
}

const initialState: AssetState = {
  items: [],
  loading: false,
  error: null
};

export const assetSlice = createSlice({
  name: 'asset',
  initialState,
  reducers: {
    setAssets: (state, action: PayloadAction<Asset[]>) => {
      state.items = action.payload;
    },
    addAssetItem: (state, action: PayloadAction<Asset>) => {
      state.items.unshift(action.payload);
    },
    removeAssetItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((a) => a.id !== action.payload);
    }
  }
});

export const { setAssets, addAssetItem, removeAssetItem } = assetSlice.actions;
export default assetSlice.reducer;
