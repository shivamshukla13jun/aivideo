import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Series } from '../../types';

interface SeriesState {
  items: Series[];
  selectedSeries: Series | null;
  loading: boolean;
  error: string | null;
}

const initialState: SeriesState = {
  items: [],
  selectedSeries: null,
  loading: false,
  error: null
};

export const seriesSlice = createSlice({
  name: 'series',
  initialState,
  reducers: {
    setSeriesList: (state, action: PayloadAction<Series[]>) => {
      state.items = action.payload;
    },
    setSelectedSeries: (state, action: PayloadAction<Series | null>) => {
      state.selectedSeries = action.payload;
    },
    addSeriesItem: (state, action: PayloadAction<Series>) => {
      state.items.unshift(action.payload);
    },
    updateSeriesItem: (state, action: PayloadAction<Series>) => {
      const idx = state.items.findIndex((s) => s.id === action.payload.id);
      if (idx !== -1) {
        state.items[idx] = action.payload;
      }
      if (state.selectedSeries?.id === action.payload.id) {
        state.selectedSeries = action.payload;
      }
    },
    removeSeriesItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((s) => s.id !== action.payload);
      if (state.selectedSeries?.id === action.payload) {
        state.selectedSeries = null;
      }
    }
  }
});

export const { setSeriesList, setSelectedSeries, addSeriesItem, updateSeriesItem, removeSeriesItem } = seriesSlice.actions;
export default seriesSlice.reducer;
