import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVideoProjectDoc extends Document {
  chapterId: mongoose.Types.ObjectId;
  scenes: mongoose.Types.ObjectId[];
  timelineZoom: number;
  audioTrack?: {
    url: string;
    volume: number;
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
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true, unique: true, index: true },
    scenes: [{ type: Schema.Types.ObjectId, ref: 'Scene' }],
    timelineZoom: { type: Number, default: 1 },
    audioTrack: {
      url: String,
      volume: { type: Number, default: 1 },
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

export const VideoProject: Model<IVideoProjectDoc> = mongoose.models.VideoProject || mongoose.model<IVideoProjectDoc>('VideoProject', VideoProjectSchema);
