export type ChapterStatus = 
  | 'unread'
  | 'reading'
  | 'read'
  | 'script-draft'
  | 'script-completed'
  | 'narration-ready'
  | 'video-editing'
  | 'rendering'
  | 'completed';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'superadmin' | 'admin' | 'creator' | 'user';
  avatarUrl?: string;
  referenceVoice?: ReferenceVoice | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceVoice {
  id: string;
  userId: string;
  audioUrl: string;
  cloudinaryPublicId?: string;
  provider: 'elevenlabs' | 'gemini' | 'custom' | 'web-speech';
  voiceId: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Series {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  author: string;
  genres: string[];
  status: 'ongoing' | 'completed' | 'hiatus';
  createdBy: string;
  chapterCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  chapterId: string;
  pageNumber: number;
  imageUrl: string;
  cloudinaryPublicId?: string;
  width?: number;
  height?: number;
  createdAt: string;
}

export interface Scene {
  id: string;
  chapterId: string;
  pageId: string;
  sceneNumber: number;
  characters: string[];
  narration: string;
  dialogue: string;
  emotion: string;
  duration: number; // in seconds
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterStoryVersion {
  version: number;
  content: string;
  updatedAt: string;
}

export interface ChapterStory {
  id: string;
  chapterId: string;
  content: string;
  status: 'draft' | 'saved';
  versions: ChapterStoryVersion[];
  updatedAt: string;
}

export interface Chapter {
  id: string;
  seriesId: string;
  chapterNumber: number;
  title: string;
  status: ChapterStatus;
  readingProgress?: number; // page number or %
  pages?: Page[];
  scenes?: Scene[];
  story?: ChapterStory;
  narrations?: GeneratedNarration[];
  videoProjectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedNarration {
  id: string;
  chapterId: string;
  audioUrl: string;
  cloudinaryPublicId?: string;
  duration: number;
  provider: string;
  voiceId: string;
  generatedAt: string;
}

export interface Asset {
  id: string;
  userId: string;
  title: string;
  type: 'image' | 'video' | 'audio' | 'narration' | 'music' | 'sfx' | 'graphics' | 'comic_page' | 'graphic' | 'bgm';
  url: string;
  fileUrl?: string;
  cloudinaryPublicId?: string;
  duration?: number;
  width?: number;
  height?: number;
  createdAt: string;
}

// VIDEO EDITOR TYPES
export type KeyframeInterpolation = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface Keyframe {
  id: string;
  time: number; // seconds from clip start
  value: number;
  property: string;
  interpolation: KeyframeInterpolation;
}

export interface TransformProperties {
  x: number; // px offset
  y: number; // px offset
  scale?: number; // uniform scale
  scaleX: number; // multiplier (e.g. 1.0)
  scaleY: number; // multiplier
  rotation: number; // degrees
  opacity: number; // 0..1
  cropLeft?: number; // %
  cropRight?: number;
  cropTop?: number;
  cropBottom?: number;
}

export interface EffectFilter {
  id: string;
  type: 'brightness' | 'contrast' | 'saturation' | 'exposure' | 'vignette' | 'blur' | 'filmGrain' | 'bloom' | 'glitch' | 'rgbSplit' | 'vhs' | 'colorTint';
  enabled: boolean;
  value: number; // primary parameter 0..100
  secondaryValue?: number;
}

export interface TransitionEffect {
  type: 'cut' | 'fade' | 'crossDissolve' | 'dipToBlack' | 'slide' | 'push' | 'zoom' | 'wipe' | 'glitch' | 'flash';
  duration: number; // seconds
}

export interface Mask {
  id: string;
  type: 'rectangle' | 'ellipse' | 'polygon';
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number;
  expansion: number;
  opacity: number;
  invert: boolean;
}

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'softLight' | 'hardLight' | 'darken' | 'lighten' | 'difference';

export interface ClipTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  backgroundColor?: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  animation?: 'none' | 'fade' | 'slide' | 'typewriter' | 'pop' | 'blur';
}

export interface VideoClip {
  id: string;
  trackId: string;
  assetId?: string;
  title: string;
  mediaType?: 'image' | 'video' | 'audio' | 'text' | 'graphic' | 'narration' | 'sfx' | 'music';
  type?: string;
  url?: string;
  mediaUrl?: string;
  text?: string;
  textStyle?: ClipTextStyle;
  start: number; // position on timeline in seconds
  duration: number; // clip duration in seconds
  sourceOffset?: number; // start offset within media file
  transform: TransformProperties;
  keyframes: Keyframe[];
  effects: EffectFilter[];
  transitionIn?: TransitionEffect | null;
  transitionOut?: TransitionEffect | null;
  masks?: Mask[];
  blendMode?: BlendMode;
  volume?: number; // 0..1
  pan?: number; // -1..1
  fadeInDuration?: number;
  fadeOutDuration?: number;
  groupClipId?: string;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text';
  clips: VideoClip[];
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  solo: boolean;
  height: number;
}

export interface VideoProjectSettings {
  width: number; // e.g. 1920
  height: number; // e.g. 1080
  fps: number; // 24, 30, 60
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  quality: 'draft' | 'standard' | 'high' | 'maximum';
}

export interface VideoProject {
  id: string;
  chapterId?: string;
  title: string;
  settings: VideoProjectSettings;
  tracks: Track[];
  markers?: { id: string; time: number; label: string; color: string }[];
  renderedVideoUrl?: string;
  renderedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadProgressPayload {
  uploadId: string;
  chapterId: string;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  progress: number;
  status: 'idle' | 'extracting' | 'uploading' | 'completed' | 'error';
  completedPages?: Page[];
  failedIndices?: number[];
  errorMessage?: string;
}

export interface RenderProgressPayload {
  projectId: string;
  progress: number;
  currentScene: number;
  totalScenes: number;
  elapsedTime: string;
  estimatedRemaining: string;
  status: 'idle' | 'rendering' | 'complete' | 'error';
  videoUrl?: string;
  errorMessage?: string;
}
