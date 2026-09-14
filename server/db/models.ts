import mongoose, { Schema, Document } from 'mongoose';

export interface IMangaDoc extends Document {
  id: number;
  sourceId: string;
  url: string;
  title: string;
  thumbnailUrl: string;
  artist?: string;
  author?: string;
  description?: string;
  genre: string[];
  status: string;
  inLibrary: boolean;
  inLibraryAt?: Date;
  categories: number[];
  initialized: boolean;
  lastReadAt?: Date;
}

const MangaSchema = new Schema<IMangaDoc>({
  id: { type: Number, required: true, unique: true, index: true },
  sourceId: { type: String, required: true, index: true },
  url: { type: String, default: '' },
  title: { type: String, required: true, index: true },
  thumbnailUrl: { type: String, default: '' },
  artist: { type: String, default: '' },
  author: { type: String, default: '' },
  description: { type: String, default: '' },
  genre: [{ type: String }],
  status: { type: String, default: 'ONGOING' },
  inLibrary: { type: Boolean, default: false, index: true },
  inLibraryAt: { type: Date },
  categories: [{ type: Number }],
  initialized: { type: Boolean, default: true },
  lastReadAt: { type: Date },
}, { timestamps: true });

export interface IChapterDoc extends Document {
  id: number;
  mangaId: number;
  url: string;
  name: string;
  chapterNumber: number;
  uploadDate: Date;
  scanlator?: string;
  read: boolean;
  bookmark: boolean;
  lastPageRead: number;
  pageCount: number;
  pages?: string[];
  originalPages?: string[];
  script?: any;
}

const ChapterSchema = new Schema<IChapterDoc>({
  id: { type: Number, required: true, unique: true, index: true },
  mangaId: { type: Number, required: true, index: true },
  url: { type: String, default: '' },
  name: { type: String, required: true },
  chapterNumber: { type: Number, required: true },
  uploadDate: { type: Date, default: Date.now },
  scanlator: { type: String, default: 'Official / Scanlation' },
  read: { type: Boolean, default: false },
  bookmark: { type: Boolean, default: false },
  lastPageRead: { type: Number, default: 0 },
  pageCount: { type: Number, default: 1 },
  pages: [{ type: String }],
  originalPages: [{ type: String }],
  script: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });

export interface ICategoryDoc extends Document {
  id: number;
  name: string;
  order: number;
  isDefault: boolean;
}

const CategorySchema = new Schema<ICategoryDoc>({
  id: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

export interface ITrackerDoc extends Document {
  id: string;
  mangaId: number;
  trackerService: string;
  remoteId: string;
  title: string;
  status: string;
  score: number;
  lastChapterRead: number;
  totalChapters: number;
}

const TrackerSchema = new Schema<ITrackerDoc>({
  id: { type: String, required: true, unique: true, index: true },
  mangaId: { type: Number, required: true, index: true },
  trackerService: { type: String, default: 'AniList' },
  remoteId: { type: String, default: '' },
  title: { type: String, default: '' },
  status: { type: String, default: 'reading' },
  score: { type: Number, default: 0 },
  lastChapterRead: { type: Number, default: 0 },
  totalChapters: { type: Number, default: 0 },
}, { timestamps: true });

export interface IHistoryDoc extends Document {
  mangaId: number;
  chapterId: number;
  readAt: Date;
  lastPageRead: number;
}

const HistorySchema = new Schema<IHistoryDoc>({
  mangaId: { type: Number, required: true, index: true },
  chapterId: { type: Number, required: true },
  readAt: { type: Date, default: Date.now },
  lastPageRead: { type: Number, default: 0 },
}, { timestamps: true });

export interface ISettingDoc extends Document {
  key: string;
  value: any;
}

const SettingSchema = new Schema<ISettingDoc>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed },
}, { timestamps: true });

export interface IDownloadQueueDoc extends Document {
  chapterId: number;
  mangaId: number;
  mangaTitle: string;
  mangaThumbnail: string;
  chapterName: string;
  chapterNumber: number;
  progress: number;
  status: string;
  pagesDownloaded: number;
  totalPages: number;
  error?: string;
}

const DownloadQueueSchema = new Schema<IDownloadQueueDoc>({
  chapterId: { type: Number, required: true, unique: true, index: true },
  mangaId: { type: Number, required: true, index: true },
  mangaTitle: { type: String, required: true },
  mangaThumbnail: { type: String, default: '' },
  chapterName: { type: String, required: true },
  chapterNumber: { type: Number, required: true },
  progress: { type: Number, default: 0 },
  status: { type: String, default: 'QUEUED', index: true },
  pagesDownloaded: { type: Number, default: 0 },
  totalPages: { type: Number, default: 1 },
  error: { type: String },
}, { timestamps: true });

// Prevent model overwrite in dev reload
export const MangaModel: any = mongoose.models.Manga || mongoose.model<IMangaDoc>('Manga', MangaSchema);
export const ChapterModel: any = mongoose.models.Chapter || mongoose.model<IChapterDoc>('Chapter', ChapterSchema);
export const CategoryModel: any = mongoose.models.Category || mongoose.model<ICategoryDoc>('Category', CategorySchema);
export const TrackerModel: any = mongoose.models.Tracker || mongoose.model<ITrackerDoc>('Tracker', TrackerSchema);
export const HistoryModel: any = mongoose.models.History || mongoose.model<IHistoryDoc>('History', HistorySchema);
export const SettingModel: any = mongoose.models.Setting || mongoose.model<ISettingDoc>('Setting', SettingSchema);
export const DownloadQueueModel: any = mongoose.models.DownloadQueue || mongoose.model<IDownloadQueueDoc>('DownloadQueue', DownloadQueueSchema);

