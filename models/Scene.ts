import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISceneDoc extends Document {
  chapterId: string;
  pageId?: string;
  order: number;
  title: string;
  narration?: string;
  /** Hindi narration / subtitle (Devanagari). */
  narrationHi?: string;
  dialogue?: string;
  description?: string;
  duration: number;
  image: string;
  audio?: {
    url: string;
    objectKey: string;
    duration: number;
    format: string;
    fileSize: number;
  };
  effects?: string;
  visualEffect?: string;
  transition?: string;
  zoom: number;
  pan: { x: number; y: number };
  imageWidth?: number;
  imageHeight?: number;
  camera?: {
    start: { cx: number; cy: number; zoom: number };
    end: { cx: number; cy: number; zoom: number };
    easing: string;
    steps?: number;
  };
  cuts?: { top: number; bottom: number }[];
  hideBoxes?: { x: number; y: number; width: number; height: number; mode: string }[];
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
    narrationHi: { type: String, default: '' },
    dialogue: { type: String },
    description: { type: String },
    duration: { type: Number, default: 5 },
    image: { type: String, required: true },
    audio: {
      url: String,
      objectKey: String,
      cloudinaryUrl: String, // legacy field from the Cloudinary era
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
    imageWidth: { type: Number },
    imageHeight: { type: Number },
    camera: {
      type: new Schema(
        {
          start: { cx: Number, cy: Number, zoom: Number },
          end: { cx: Number, cy: Number, zoom: Number },
          easing: { type: String, default: 'linear' },
          steps: { type: Number },
        },
        { _id: false }
      ),
      default: undefined,
    },
    cuts: {
      type: [new Schema({ top: Number, bottom: Number }, { _id: false })],
      default: [],
    },
    hideBoxes: {
      type: [
        new Schema(
          { x: Number, y: Number, width: Number, height: Number, mode: { type: String, default: 'blur' } },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// A model cached by hot reload with an older schema would silently drop the newer fields
if (mongoose.models.Scene && (!mongoose.models.Scene.schema.path('audio.url') || !mongoose.models.Scene.schema.path('camera.steps'))) mongoose.deleteModel('Scene');

export const Scene: Model<ISceneDoc> = mongoose.models.Scene || mongoose.model<ISceneDoc>('Scene', SceneSchema);
