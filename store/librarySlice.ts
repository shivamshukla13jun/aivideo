import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { ILibraryItem } from '@/types';

interface LibraryState {
  libraryItems: ILibraryItem[];
  loading: boolean;
  error: string | null;
}

const initialState: LibraryState = {
  libraryItems: [],
  loading: false,
  error: null,
};

export const fetchLibrary = createAsyncThunk('library/fetchLibrary', async () => {
  const res = await fetch('/api/library');
  const data = await res.json();
  return data.success ? data.data : [];
});

export const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    setLibraryItems: (state, action: PayloadAction<ILibraryItem[]>) => {
      state.libraryItems = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLibrary.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLibrary.fulfilled, (state, action) => {
        state.loading = false;
        state.libraryItems = action.payload;
      })
      .addCase(fetchLibrary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch library';
      });
  },
});

export const { setLibraryItems } = librarySlice.actions;
export default librarySlice.reducer;
