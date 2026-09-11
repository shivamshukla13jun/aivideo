import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProjectDoc extends Document {
  projectId: string;
  title: string;
  description: string;
  aspectRatio: string;
  fps: number;
  scenes: any[];
  bgMusicUrl?: string;
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProjectDoc>(
  {
    projectId: { type: String, required: true, unique: true, index: true, default: 'current' },
    title: { type: String, default: 'My Anime Video' },
    description: { type: String, default: '' },
    aspectRatio: { type: String, default: '16:9' },
    fps: { type: Number, default: 30 },
    scenes: [{ type: Schema.Types.Mixed }],
    bgMusicUrl: { type: String, default: '' },
    totalDuration: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const ProjectModel: Model<IProjectDoc> =
  mongoose.models.Project || mongoose.model<IProjectDoc>('Project', ProjectSchema);
