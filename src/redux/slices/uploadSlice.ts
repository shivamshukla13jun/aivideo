import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UploadProgressPayload } from '../../types';

interface UploadState {
  activeUpload: UploadProgressPayload | null;
  extractedFiles: { name: string; url: string; file?: File; pageNumber: number }[];
  isExtracting: boolean;
  isUploading: boolean;
  error: string | null;
}

const initialState: UploadState = {
  activeUpload: null,
  extractedFiles: [],
  isExtracting: false,
  isUploading: false,
  error: null
};

export const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    setExtractedFiles: (state, action: PayloadAction<{ name: string; url: string; file?: File; pageNumber: number }[]>) => {
      state.extractedFiles = action.payload;
    },
    setIsExtracting: (state, action: PayloadAction<boolean>) => {
      state.isExtracting = action.payload;
    },
    setUploadProgress: (state, action: PayloadAction<UploadProgressPayload | null>) => {
      state.activeUpload = action.payload;
      if (action.payload?.status === 'uploading') {
        state.isUploading = true;
      } else if (action.payload?.status === 'completed' || action.payload?.status === 'error') {
        state.isUploading = false;
      }
    },
    clearUploadState: (state) => {
      state.activeUpload = null;
      state.extractedFiles = [];
      state.isExtracting = false;
      state.isUploading = false;
      state.error = null;
    }
  }
});

export const { setExtractedFiles, setIsExtracting, setUploadProgress, clearUploadState } = uploadSlice.actions;
export default uploadSlice.reducer;
