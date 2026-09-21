export interface ISeries {
  _id: string;
  title: string;
  alternativeTitle?: string;
  description: string;
  author: string;
  artist: string;
  genres: string[];
  status: string;
  coverImage: string;
  bannerImage?: string;
  language: string;
  releaseYear: number;
  chapters: string[]; // Chapter IDs or counts
  totalChapters?: number;
  source?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface ICloudinaryAsset {
  cloudinaryUrl: string;
  publicId: string;
  fileName: string;
  fileSize: number;
  format: string;
  dimensions?: { width: number; height: number };
  duration?: number;
}

export interface IChapter {
  _id: string;
  seriesId: string;
  chapterNumber: number;
  title: string;
  originalCbz?: ICloudinaryAsset;
  editedCbz?: ICloudinaryAsset;
  pages?: string[]; // Page IDs
  scenes?: string[]; // Scene IDs
  videoProject?: string; // VideoProject ID
  editorState?: any;
  status: string;
  isRead?: boolean;
  isDownloaded?: boolean;
  isBookmarked?: boolean;
  uploadDate?: string | null;
  lastPageRead?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IPage {
  _id: string;
  chapterId: string;
  order: number;
  originalUrl: string;
  editedUrl?: string;
  publicId?: string;
  extractedText?: string;
  panels: IPanel[];
  status: 'active' | 'deleted' | 'split';
  createdAt?: string;
  updatedAt?: string;
}

export interface IPanel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageUrl?: string;
}

export interface IScene {
  _id: string;
  chapterId: string;
  pageId?: string;
  order: number;
  title: string;
  narration?: string;
  dialogue?: string;
  description?: string;
  duration: number; // seconds
  image: string;
  audio?: {
    cloudinaryUrl: string;
    publicId: string;
    duration: number;
    format: string;
    fileSize: number;
  };
  effects?: string;
  visualEffect?: string;
  transition?: string;
  zoom: number;
  pan: { x: number; y: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface IVideoProject {
  _id: string;
  chapterId: string;
  scenes: string[]; // Scene IDs
  timelineZoom: number;
  audioTrack?: {
    url: string;
    volume: number;
  };
  versionHistory: {
    version: number;
    timestamp: string;
    snapshot: any;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface ILibraryItem {
  _id: string;
  seriesId: string;
  isFavorite: boolean;
  lastReadChapterId?: string;
  lastReadPageOrder?: number;
  readingProgressPercent: number;
  isCompleted: boolean;
  updatedAt: string;
}
