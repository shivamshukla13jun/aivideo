import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CbzEditorState {
  selectedPageId: string | null;
  cropBoxes: { id: string; x: number; y: number; width: number; height: number }[];
  isCropping: boolean;
  activeTool: 'select' | 'crop' | 'split' | 'delete';
}

const initialState: CbzEditorState = {
  selectedPageId: null,
  cropBoxes: [],
  isCropping: false,
  activeTool: 'select',
};

export const cbzEditorSlice = createSlice({
  name: 'cbzEditor',
  initialState,
  reducers: {
    setSelectedPageId: (state, action: PayloadAction<string | null>) => {
      state.selectedPageId = action.payload;
      state.cropBoxes = [];
    },
    setCropBoxes: (state, action: PayloadAction<{ id: string; x: number; y: number; width: number; height: number }[]>) => {
      state.cropBoxes = action.payload;
    },
    addCropBox: (state, action: PayloadAction<{ id: string; x: number; y: number; width: number; height: number }>) => {
      state.cropBoxes.push(action.payload);
    },
    removeCropBox: (state, action: PayloadAction<string>) => {
      state.cropBoxes = state.cropBoxes.filter(b => b.id !== action.payload);
    },
    setIsCropping: (state, action: PayloadAction<boolean>) => {
      state.isCropping = action.payload;
    },
    setActiveTool: (state, action: PayloadAction<'select' | 'crop' | 'split' | 'delete'>) => {
      state.activeTool = action.payload;
    },
  },
});

export const { setSelectedPageId, setCropBoxes, addCropBox, removeCropBox, setIsCropping, setActiveTool } = cbzEditorSlice.actions;
export default cbzEditorSlice.reducer;
