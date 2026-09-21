import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISceneDoc extends Document {
  chapterId: string;
  pageId?: string;
  order: number;
  title: string;
  narration?: string;
  dialogue?: string;
  description?: string;
  duration: number;
  image: string;
  audio?: {
    cloudinaryUrl: string;
    publicId: string;
    duration: number;
    format: string;
    fileSize: number;
  };
  effects?: string;
  visualEffect?: string;
  transition?: string;
  zoom: number;
  pan: { x: number; y: number };
  createdAt: Date;
  updatedAt: Date;
}

const SceneSchema = new Schema<ISceneDoc>(
  {
    chapterId: { type: String, required: true, index: true },
    pageId: { type: String },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    narration: { type: String },
    dialogue: { type: String },
    description: { type: String },
    duration: { type: Number, default: 5 },
    image: { type: String, required: true },
    audio: {
      cloudinaryUrl: String,
      publicId: String,
      duration: Number,
      format: String,
      fileSize: Number,
    },
    effects: { type: String, default: 'ken-burns' },
    visualEffect: { type: String, default: 'none' },
    transition: { type: String, default: 'none' },
    zoom: { type: Number, default: 1 },
    pan: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Scene: Model<ISceneDoc> = mongoose.models.Scene || mongoose.model<ISceneDoc>('Scene', SceneSchema);
