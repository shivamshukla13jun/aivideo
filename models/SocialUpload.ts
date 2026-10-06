import mongoose, { Schema, Document, Model } from 'mongoose';
import { SocialPlatform } from './SocialAccount';

export interface ISocialUploadTarget {
  platform: SocialPlatform | 'youtube';
  accountId: mongoose.Types.ObjectId;
  displayName: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface ISocialUploadDoc extends Document {
  chapterId?: string;
  youtubeUploadId?: string;
  videoType: 'full' | 'short';
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** MinIO object key for the video file */
  videoObjectKey?: string;
  seo: {
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
  };
  targets: ISocialUploadTarget[];
  status: 'pending' | 'uploading' | 'done' | 'partial' | 'failed';
  /** Shorts metadata */
  shortsConfig?: {
    sourceVideoKey?: string;
    startTime: number;
    endTime: number;
    /** Scene IDs used for the short */
    sceneIds: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const SocialUploadSchema = new Schema<ISocialUploadDoc>(
  {
    chapterId: { type: String, index: true },
    youtubeUploadId: { type: String },
    videoType: { type: String, enum: ['full', 'short'], default: 'full' },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: 'video/mp4' },
    videoObjectKey: { type: String },
    seo: {
      title: { type: String, required: true },
      description: { type: String, default: '' },
      tags: [{ type: String }],
      hashtags: [{ type: String }],
    },
    targets: [
      {
        platform: { type: String, required: true },
        accountId: { type: Schema.Types.ObjectId, required: true },
        displayName: { type: String },
        status: { type: String, enum: ['pending', 'uploading', 'done', 'failed'], default: 'pending' },
        postId: { type: String },
        postUrl: { type: String },
        error: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'uploading', 'done', 'partial', 'failed'],
      default: 'pending',
    },
    shortsConfig: {
      type: {
        sourceVideoKey: String,
        startTime: Number,
        endTime: Number,
        sceneIds: [String],
      },
      default: undefined,
    },
  },
  { timestamps: true }
);

export const SocialUpload: Model<ISocialUploadDoc> =
  mongoose.models.SocialUpload ||
  mongoose.model<ISocialUploadDoc>('SocialUpload', SocialUploadSchema);
