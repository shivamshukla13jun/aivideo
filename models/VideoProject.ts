import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVideoProjectDoc extends Document {
  chapterId: string;
  scenes: mongoose.Types.ObjectId[];
  timelineZoom: number;
  audioTrack?: {
    url: string;
    volume: number;
    duration?: number;
    fileName?: string;
  };
  versionHistory: {
    version: number;
    timestamp: Date;
    snapshot: any;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const VideoProjectSchema = new Schema<IVideoProjectDoc>(
  {
    chapterId: { type: String, required: true, unique: true, index: true },
    scenes: [{ type: Schema.Types.ObjectId, ref: 'Scene' }],
    timelineZoom: { type: Number, default: 1 },
    audioTrack: {
      url: String,
      volume: { type: Number, default: 1 },
      duration: Number,
      fileName: String,
    },
    versionHistory: [
      {
        version: Number,
        timestamp: { type: Date, default: Date.now },
        snapshot: Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

if (mongoose.models.VideoProject) {
  mongoose.deleteModel('VideoProject');
}

export const VideoProject: Model<IVideoProjectDoc> = mongoose.models.VideoProject || mongoose.model<IVideoProjectDoc>('VideoProject', VideoProjectSchema);
