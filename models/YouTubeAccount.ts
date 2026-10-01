import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IYouTubeAccountDoc extends Document {
  channelId: string;
  channelTitle: string;
  customUrl?: string;
  thumbnailUrl?: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  scopes: string[];
  stats: {
    subscribers: number;
    totalViews: number;
    videoCount: number;
    watchHours365?: number | null;
    shortsViews90?: number | null;
    uploads90d?: number | null;
    lastSyncedAt?: Date;
  };
  uploadsPlaylistId?: string;
  connectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const YouTubeAccountSchema = new Schema<IYouTubeAccountDoc>(
  {
    channelId: { type: String, required: true, unique: true, index: true },
    channelTitle: { type: String, required: true },
    customUrl: { type: String },
    thumbnailUrl: { type: String },
    email: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    tokenExpiry: { type: Date },
    scopes: [{ type: String }],
    stats: {
      subscribers: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      videoCount: { type: Number, default: 0 },
      watchHours365: { type: Number, default: null },
      shortsViews90: { type: Number, default: null },
      uploads90d: { type: Number, default: null },
      lastSyncedAt: { type: Date },
    },
    uploadsPlaylistId: { type: String },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const YouTubeAccount: Model<IYouTubeAccountDoc> =
  mongoose.models.YouTubeAccount ||
  mongoose.model<IYouTubeAccountDoc>('YouTubeAccount', YouTubeAccountSchema);
