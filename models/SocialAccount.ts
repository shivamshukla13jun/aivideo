import mongoose, { Schema, Document, Model } from 'mongoose';

export type SocialPlatform = 'instagram' | 'reddit' | 'twitter' | 'facebook';

export interface ISocialAccountDoc extends Document {
  platform: SocialPlatform;
  platformUserId: string;
  displayName: string;
  username?: string;
  profileImageUrl?: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  scopes: string[];
  /** Platform-specific metadata (page ID for Facebook, business account ID for Instagram, etc.) */
  platformMeta: Record<string, any>;
  stats: {
    followers: number;
    totalPosts: number;
    totalViews: number;
    lastSyncedAt?: Date;
  };
  connectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SocialAccountSchema = new Schema<ISocialAccountDoc>(
  {
    platform: { type: String, required: true, enum: ['instagram', 'reddit', 'twitter', 'facebook'], index: true },
    platformUserId: { type: String, required: true },
    displayName: { type: String, required: true },
    username: { type: String },
    profileImageUrl: { type: String },
    email: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    tokenExpiry: { type: Date },
    scopes: [{ type: String }],
    platformMeta: { type: Schema.Types.Mixed, default: {} },
    stats: {
      followers: { type: Number, default: 0 },
      totalPosts: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      lastSyncedAt: { type: Date },
    },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SocialAccountSchema.index({ platform: 1, platformUserId: 1 }, { unique: true });

export const SocialAccount: Model<ISocialAccountDoc> =
  mongoose.models.SocialAccount ||
  mongoose.model<ISocialAccountDoc>('SocialAccount', SocialAccountSchema);
