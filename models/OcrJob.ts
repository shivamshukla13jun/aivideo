import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOcrJobDoc extends Document {
  jobId: string;
  chapterId: string;
  seriesId: string;
  seriesTitle: string;
  chapterName: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  totalPages: number;
  donePages: number;
  failedOrders: number[];
  error?: string;
  attempts: number;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OcrJobSchema = new Schema<IOcrJobDoc>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    chapterId: { type: String, required: true, index: true },
    seriesId: { type: String, default: '' },
    seriesTitle: { type: String, default: '' },
    chapterName: { type: String, default: '' },
    status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued', index: true },
    totalPages: { type: Number, default: 0 },
    donePages: { type: Number, default: 0 },
    failedOrders: [{ type: Number }],
    error: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

export const OcrJob: Model<IOcrJobDoc> =
  mongoose.models.OcrJob || mongoose.model<IOcrJobDoc>('OcrJob', OcrJobSchema);
