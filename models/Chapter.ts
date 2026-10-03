import mongoose, { Schema, Document, Model } from 'mongoose';

const CloudinaryAssetSchema = new Schema(
  {
    cloudinaryUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    format: { type: String, required: true },
    dimensions: {
      width: Number,
      height: Number,
    },
    duration: Number,
  },
  { _id: false }
);

export interface IChapterDoc extends Document {
  seriesId: any;
  chapterNumber: number;
  title: string;
  originalCbz?: any;
  editedCbz?: any;
  pages: mongoose.Types.ObjectId[];
  scenes: mongoose.Types.ObjectId[];
  videoProject?: any;
  audioTrack?: {
    url: string;
    volume: number;
    duration?: number;
    fileName?: string;
  };
  editorState?: any;
  status: 'uploaded' | 'processing' | 'ready' | 'error' | 'downloaded';
  source?: 'local' | 'suwayomi';
  createdAt: Date;
  updatedAt: Date;
}

const ChapterSchema = new Schema<IChapterDoc>(
  {
    seriesId: { type: Schema.Types.Mixed, required: true, index: true },
    chapterNumber: { type: Number, required: true },
    title: { type: String, required: true },
    originalCbz: CloudinaryAssetSchema,
    editedCbz: CloudinaryAssetSchema,
    pages: [{ type: Schema.Types.ObjectId, ref: 'Page' }],
    scenes: [{ type: Schema.Types.ObjectId, ref: 'Scene' }],
    videoProject: { type: Schema.Types.Mixed },
    audioTrack: {
      url: { type: String },
      volume: { type: Number, default: 1 },
      duration: { type: Number },
      fileName: { type: String },
    },
    editorState: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['uploaded', 'processing', 'ready', 'error', 'downloaded'], default: 'ready' },
    source: { type: String, default: 'local' },
  },
  { timestamps: true }
);

if (mongoose.models.Chapter && !mongoose.models.Chapter.schema.path('audioTrack')) {
  mongoose.deleteModel('Chapter');
}

export const Chapter: Model<IChapterDoc> = mongoose.models.Chapter || mongoose.model<IChapterDoc>('Chapter', ChapterSchema);
