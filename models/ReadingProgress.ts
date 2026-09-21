import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReadingProgressDoc extends Document {
  chapterId: mongoose.Types.ObjectId;
  pageOrder: number;
  completed: boolean;
  updatedAt: Date;
}

const ReadingProgressSchema = new Schema<IReadingProgressDoc>(
  {
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true, unique: true, index: true },
    pageOrder: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ReadingProgress: Model<IReadingProgressDoc> = mongoose.models.ReadingProgress || mongoose.model<IReadingProgressDoc>('ReadingProgress', ReadingProgressSchema);
