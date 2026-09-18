import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VideoProject, Track, VideoClip, RenderProgressPayload } from '../../types';

export type EditorTool = 'select' | 'razor' | 'hand' | 'text' | 'pen' | 'zoom';

interface VideoEditorState {
  currentProject: VideoProject | null;
  activeTool: EditorTool;
  playheadTime: number; // in seconds
  isPlaying: boolean;
  timelineZoom: number; // px per second (e.g. 20..200)
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedKeyframeId: string | null;
  isSnappingEnabled: boolean;
  history: VideoProject[];
  historyIndex: number;
  renderProgress: RenderProgressPayload | null;
  isRendering: boolean;
  autosavedAt: string | null;
}

const initialState: VideoEditorState = {
  currentProject: null,
  activeTool: 'select',
  playheadTime: 0,
  isPlaying: false,
  timelineZoom: 40,
  selectedClipId: null,
  selectedTrackId: null,
  selectedKeyframeId: null,
  isSnappingEnabled: true,
  history: [],
  historyIndex: -1,
  renderProgress: null,
  isRendering: false,
  autosavedAt: null
};

export const videoEditorSlice = createSlice({
  name: 'videoEditor',
  initialState,
  reducers: {
    setProject: (state, action: PayloadAction<VideoProject | null>) => {
      state.currentProject = action.payload;
      if (action.payload) {
        state.history = [action.payload];
        state.historyIndex = 0;
      }
    },
    setActiveTool: (state, action: PayloadAction<EditorTool>) => {
      state.activeTool = action.payload;
    },
    setPlayheadTime: (state, action: PayloadAction<number>) => {
      state.playheadTime = Math.max(0, action.payload);
    },
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    setTimelineZoom: (state, action: PayloadAction<number>) => {
      state.timelineZoom = Math.max(10, Math.min(300, action.payload));
    },
    setSelectedClipId: (state, action: PayloadAction<string | null>) => {
      state.selectedClipId = action.payload;
    },
    setSelectedTrackId: (state, action: PayloadAction<string | null>) => {
      state.selectedTrackId = action.payload;
    },
    setSelectedKeyframeId: (state, action: PayloadAction<string | null>) => {
      state.selectedKeyframeId = action.payload;
    },
    toggleSnapping: (state) => {
      state.isSnappingEnabled = !state.isSnappingEnabled;
    },
    updateProjectTracks: (state, action: PayloadAction<Track[]>) => {
      if (state.currentProject) {
        state.currentProject.tracks = action.payload;
        state.autosavedAt = new Date().toISOString();

        // Push to history
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push(JSON.parse(JSON.stringify(state.currentProject)));
        state.historyIndex = state.history.length - 1;
      }
    },
    updateSelectedClipTransform: (state, action: PayloadAction<Partial<VideoClip['transform']>>) => {
      if (!state.currentProject || !state.selectedClipId) return;

      for (const track of state.currentProject.tracks) {
        const clip = track.clips.find((c) => c.id === state.selectedClipId);
        if (clip) {
          clip.transform = { ...clip.transform, ...action.payload };
          state.autosavedAt = new Date().toISOString();
          break;
        }
      }
    },
    addClipToTrack: (state, action: PayloadAction<{ trackId: string; clip: VideoClip }>) => {
      if (!state.currentProject) return;
      const track = state.currentProject.tracks.find((t) => t.id === action.payload.trackId);
      if (track) {
        track.clips.push(action.payload.clip);
        state.autosavedAt = new Date().toISOString();
      }
    },
    splitClipAtPlayhead: (state, action: PayloadAction<string>) => {
      if (!state.currentProject) return;
      const clipId = action.payload;
      for (const track of state.currentProject.tracks) {
        const clipIndex = track.clips.findIndex((c) => c.id === clipId);
        if (clipIndex !== -1) {
          const clip = track.clips[clipIndex];
          const splitPoint = state.playheadTime - clip.start;
          if (splitPoint > 0.2 && splitPoint < clip.duration - 0.2) {
            const firstDuration = splitPoint;
            const secondDuration = clip.duration - splitPoint;

            clip.duration = firstDuration;

            const newClip: VideoClip = {
              ...JSON.parse(JSON.stringify(clip)),
              id: `clp_split_${Date.now()}`,
              start: state.playheadTime,
              duration: secondDuration,
              sourceOffset: (clip.sourceOffset || 0) + splitPoint
            };

            track.clips.splice(clipIndex + 1, 0, newClip);
            state.autosavedAt = new Date().toISOString();
          }
          break;
        }
      }
    },
    deleteSelectedClip: (state) => {
      if (!state.currentProject || !state.selectedClipId) return;
      for (const track of state.currentProject.tracks) {
        track.clips = track.clips.filter((c) => c.id !== state.selectedClipId);
      }
      state.selectedClipId = null;
      state.autosavedAt = new Date().toISOString();
    },
    undoEditorState: (state) => {
      if (state.historyIndex > 0) {
        state.historyIndex -= 1;
        state.currentProject = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
      }
    },
    redoEditorState: (state) => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex += 1;
        state.currentProject = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
      }
    },
    setRenderProgress: (state, action: PayloadAction<RenderProgressPayload | null>) => {
      state.renderProgress = action.payload;
      if (action.payload?.status === 'rendering') {
        state.isRendering = true;
      } else if (action.payload?.status === 'complete' || action.payload?.status === 'error') {
        state.isRendering = false;
        if (action.payload?.videoUrl && state.currentProject) {
          state.currentProject.renderedVideoUrl = action.payload.videoUrl;
        }
      }
    }
  }
});

export const {
  setProject,
  setActiveTool,
  setPlayheadTime,
  setIsPlaying,
  setTimelineZoom,
  setSelectedClipId,
  setSelectedTrackId,
  setSelectedKeyframeId,
  toggleSnapping,
  updateProjectTracks,
  updateSelectedClipTransform,
  addClipToTrack,
  splitClipAtPlayhead,
  deleteSelectedClip,
  undoEditorState,
  redoEditorState,
  setRenderProgress
} = videoEditorSlice.actions;

export default videoEditorSlice.reducer;
