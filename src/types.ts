/**
 * Suwayomi Server TypeScript Data Types
 */

export type MangaStatus = 'ONGOING' | 'COMPLETED' | 'LICENSED' | 'UNKNOWN';

export interface Manga {
  id: number;
  sourceId: string;
  url: string;
  title: string;
  thumbnailUrl: string;
  artist?: string;
  author?: string;
  description?: string;
  genre: string[];
  status: MangaStatus;
  inLibrary: boolean;
  inLibraryAt?: string;
  categories: number[];
  initialized: boolean;
  chaptersCount?: number;
  unreadCount?: number;
  lastReadAt?: string;
}

export interface Chapter {
  id: number;
  mangaId: number;
  url: string;
  name: string;
  chapterNumber: number;
  uploadDate: string;
  scanlator?: string;
  read: boolean;
  bookmark: boolean;
  lastPageRead: number;
  pageCount: number;
  fetchedAt?: string;
  pages?: string[]; // Image URLs
  originalPages?: string[]; // Archive of pristine original uncropped pages
  script?: WebtoonScript;
}

export interface Category {
  id: number;
  name: string;
  order: number;
  isDefault?: boolean;
}

export interface Source {
  id: string;
  name: string;
  lang: string;
  iconUrl: string;
  baseUrl: string;
  version: string;
  isNsfw: boolean;
  supportsLatest: boolean;
}

export interface HistoryItem {
  id?: string;
  mangaId: number;
  chapterId: number;
  mangaTitle: string;
  mangaThumbnail: string;
  chapterName: string;
  chapterNumber: number;
  readAt: string;
  lastPageRead: number;
  pageCount: number;
}

export interface MongoStatus {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'in-memory-fallback' | 'connecting';
  uri?: string;
  error?: string;
  stats?: {
    mangaCount: number;
    chapterCount: number;
    categoryCount: number;
    historyCount: number;
  };
}

export interface Extension {
  pkgName: string;
  name: string;
  lang: string;
  versionName: string;
  versionCode: number;
  iconUrl: string;
  apkUrl?: string;
  isInstalled: boolean;
  hasUpdate: boolean;
  isNsfw: boolean;
  isBuiltin?: boolean;
  repoId?: string;
  sources: Source[];
}

export interface DownloadQueueItem {
  id: string;
  chapterId: number;
  mangaId: number;
  mangaTitle: string;
  mangaThumbnail: string;
  chapterName: string;
  chapterNumber: number;
  progress: number;
  status: 'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'DOWNLOADED' | 'ERROR';
  pagesDownloaded: number;
  totalPages: number;
  error?: string;
}

export interface TrackerItem {
  id: string;
  mangaId: number;
  trackerService: 'anilist' | 'myanimelist' | 'kitsu';
  remoteId: string;
  title: string;
  status: 'reading' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_read';
  score: number;
  lastChapterRead: number;
  totalChapters: number;
}

export type ReaderMode = 'webtoon' | 'single' | 'double' | 'ltr' | 'rtl';
export type NavigationTab =
  | 'library'
  | 'mangafire'
  | 'asura'
  | 'browse'
  | 'updates'
  | 'history'
  | 'downloads'
  | 'extensions'
  | 'settings'
  | 'ai_projects'
  | 'ai_generator';

export interface WebtoonCharacter {
  id: string;
  mangaId: number;
  chapterId: number;
  name: string;
  role: string;
  description: string;
  keyLines: string[];
}

export interface WebtoonCropRect {
  topPct: number;
  heightPct: number;
  leftPct?: number;
  widthPct?: number;
}

export type WebtoonPanDirection =
  | 'auto'
  | 'none'
  | 'top-bottom'
  | 'bottom-top'
  | 'left-right'
  | 'right-left'
  | 'zoom-in'
  | 'zoom-out';

export interface WebtoonIncident {
  incidentIndex: number;
  incidentTitle: string;
  cropRect: WebtoonCropRect;
  speaker: string;
  dialogueHindi: string;
  dialogueEnglish?: string;
  characterAction?: string;
  characterSays?: string;
  sfx: string;
  actionDescription: string;
  audioUrl?: string;
  userAudioUrl?: string;
  userAudioDuration?: number;
  estimatedDurationSec?: number;
  panDirection?: WebtoonPanDirection;
}

export interface WebtoonPanel {
  panelIndex: number;
  pageUrl: string;
  dialogueHindi: string;
  dialogueEnglish?: string;
  speaker: string;
  characterAction?: string;
  characterSays?: string;
  actionDescription: string;
  bgmSuggestion: string;
  sfx: string;
  estimatedDurationSec: number;
  audioUrl?: string;
  userAudioUrl?: string;
  userAudioDuration?: number;
  skipped?: boolean;
  cropRect?: WebtoonCropRect;
  panDirection?: WebtoonPanDirection;
  incidents?: WebtoonIncident[];
}

export interface WebtoonScript {
  id: string;
  mangaId: number;
  chapterId: number;
  mangaTitle: string;
  chapterName: string;
  overallStory: string;
  mangaDetailsSummary?: string;
  subtitleMode?: 'narrator_recap' | 'character_dialogue' | 'dramatic_cinematic';
  characters: WebtoonCharacter[];
  panels: WebtoonPanel[];
  generatedAt: string;
  language: string;
  modelUsed?: string;
}

