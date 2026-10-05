import mongoose, { Schema, Document, Model } from 'mongoose';

const StoredFileSchema = new Schema(
  {
    url: { type: String, required: true },
    objectKey: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    format: { type: String, required: true },
    mimeType: { type: String },
    dimensions: {
      width: Number,
      height: Number,
    },
    duration: Number,
  },
  { _id: false }
);

export interface IChapterDoc extends Document {
  seriesId: mongoose.Types.ObjectId;
  chapterNumber: number;
  title: string;
  originalCbz?: any;
  editedCbz?: any;
  pages: mongoose.Types.ObjectId[];
  scenes: mongoose.Types.ObjectId[];
  videoProject?: mongoose.Types.ObjectId;
  editorState?: any;
  status: 'uploaded' | 'processing' | 'ready' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

const ChapterSchema = new Schema<IChapterDoc>(
  {
    seriesId: { type: Schema.Types.ObjectId, ref: 'Series', required: true, index: true },
    chapterNumber: { type: Number, required: true },
    title: { type: String, required: true },
    originalCbz: StoredFileSchema,
    editedCbz: StoredFileSchema,
    pages: [{ type: Schema.Types.ObjectId, ref: 'Page' }],
    scenes: [{ type: Schema.Types.ObjectId, ref: 'Scene' }],
    videoProject: { type: Schema.Types.ObjectId, ref: 'VideoProject' },
    editorState: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['uploaded', 'processing', 'ready', 'error'], default: 'uploaded' },
  },
  { timestamps: true }
);

// A model cached by hot reload with an older schema would silently drop the newer fields
if (mongoose.models.Chapter && !mongoose.models.Chapter.schema.path('originalCbz.objectKey')) mongoose.deleteModel('Chapter');

export const Chapter: Model<IChapterDoc> = mongoose.models.Chapter || mongoose.model<IChapterDoc>('Chapter', ChapterSchema);
