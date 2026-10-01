import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUploadTarget {
  accountId: mongoose.Types.ObjectId;
  channelId: string;
  channelTitle: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  videoId?: string;
  watchUrl?: string;
  error?: string;
}

export interface IYouTubeUploadDoc extends Document {
  chapterId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  seo: {
    title: string;
    description: string;
    tags: string[];
    categoryId?: string;
    privacyStatus: string;
    madeForKids: boolean;
  };
  targets: IUploadTarget[];
  status: 'pending' | 'uploading' | 'done' | 'partial' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const YouTubeUploadSchema = new Schema<IYouTubeUploadDoc>(
  {
    chapterId: { type: String, index: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: 'video/webm' },
    seo: {
      title: { type: String, required: true },
      description: { type: String, default: '' },
      tags: [{ type: String }],
      categoryId: { type: String, default: '24' },
      privacyStatus: { type: String, default: 'unlisted' },
      madeForKids: { type: Boolean, default: false },
    },
    targets: [
      {
        accountId: { type: Schema.Types.ObjectId, ref: 'YouTubeAccount', required: true },
        channelId: { type: String, required: true },
        channelTitle: { type: String },
        status: { type: String, enum: ['pending', 'uploading', 'done', 'failed'], default: 'pending' },
        videoId: { type: String },
        watchUrl: { type: String },
        error: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'uploading', 'done', 'partial', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

export const YouTubeUpload: Model<IYouTubeUploadDoc> =
  mongoose.models.YouTubeUpload ||
  mongoose.model<IYouTubeUploadDoc>('YouTubeUpload', YouTubeUploadSchema);
