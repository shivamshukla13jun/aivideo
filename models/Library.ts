import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILibraryDoc extends Document {
  seriesId: mongoose.Types.ObjectId;
  isFavorite: boolean;
  lastReadChapterId?: mongoose.Types.ObjectId;
  lastReadPageOrder?: number;
  readingProgressPercent: number;
  isCompleted: boolean;
  updatedAt: Date;
}

const LibrarySchema = new Schema<ILibraryDoc>(
  {
    seriesId: { type: Schema.Types.ObjectId, ref: 'Series', required: true, unique: true, index: true },
    isFavorite: { type: Boolean, default: false },
    lastReadChapterId: { type: Schema.Types.ObjectId, ref: 'Chapter' },
    lastReadPageOrder: { type: Number, default: 0 },
    readingProgressPercent: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Library: Model<ILibraryDoc> = mongoose.models.Library || mongoose.model<ILibraryDoc>('Library', LibrarySchema);
