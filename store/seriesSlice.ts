import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { ISeries } from '@/types';

interface SeriesState {
  seriesList: ISeries[];
  activeSeries: ISeries | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedGenre: string;
}

const initialState: SeriesState = {
  seriesList: [],
  activeSeries: null,
  loading: false,
  error: null,
  searchQuery: '',
  selectedGenre: 'All',
};

export const fetchSeries = createAsyncThunk('series/fetchSeries', async () => {
  const res = await fetch('/api/series');
  const data = await res.json();
  return data.success ? data.data : [];
});

export const seriesSlice = createSlice({
  name: 'series',
  initialState,
  reducers: {
    setActiveSeries: (state, action: PayloadAction<ISeries | null>) => {
      state.activeSeries = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSelectedGenre: (state, action: PayloadAction<string>) => {
      state.selectedGenre = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSeries.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSeries.fulfilled, (state, action) => {
        state.loading = false;
        state.seriesList = action.payload;
      })
      .addCase(fetchSeries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch series';
      });
  },
});

export const { setActiveSeries, setSearchQuery, setSelectedGenre } = seriesSlice.actions;
export default seriesSlice.reducer;
