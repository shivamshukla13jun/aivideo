import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOcrJobDoc extends Document {
  jobId: string;
  chapterId: string;
  seriesId: string;
  seriesTitle: string;
  chapterName: string;
  provider: string;
  /** Which pipeline stage this job runs: image cleanup, OCR→EN extraction, or EN→HI translation. */
  stage: 'extract' | 'translate' | 'preprocess';
  /** Re-run: replace existing values instead of only filling missing ones. */
  overwriteScenes: boolean;
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
    provider: { type: String, default: 'paddle' },
    stage: { type: String, enum: ['extract', 'translate', 'preprocess'], default: 'extract' },
    overwriteScenes: { type: Boolean, default: false },
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

// A model cached by hot reload with an older schema would silently drop the newer fields
const cachedOcrJob = mongoose.models.OcrJob;
if (
  cachedOcrJob &&
  !(cachedOcrJob.schema.path('stage') as any)?.enumValues?.includes('preprocess')
) {
  mongoose.deleteModel('OcrJob');
}

export const OcrJob: Model<IOcrJobDoc> =
  mongoose.models.OcrJob || mongoose.model<IOcrJobDoc>('OcrJob', OcrJobSchema);
