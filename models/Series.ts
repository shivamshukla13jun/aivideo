import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISeriesDoc extends Document {
  title: string;
  alternativeTitle?: string;
  description: string;
  author: string;
  artist: string;
  genres: string[];
  status: 'ongoing' | 'completed' | 'hiatus';
  coverImage: string;
  bannerImage?: string;
  language: string;
  releaseYear: number;
  chapters: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const SeriesSchema = new Schema<ISeriesDoc>(
  {
    title: { type: String, required: true, index: true },
    alternativeTitle: { type: String },
    description: { type: String, required: true },
    author: { type: String, required: true },
    artist: { type: String, required: true },
    genres: [{ type: String }],
    status: { type: String, enum: ['ongoing', 'completed', 'hiatus'], default: 'ongoing' },
    coverImage: { type: String, required: true },
    bannerImage: { type: String },
    language: { type: String, default: 'English' },
    releaseYear: { type: Number, default: new Date().getFullYear() },
    chapters: [{ type: Schema.Types.ObjectId, ref: 'Chapter' }],
  },
  { timestamps: true }
);

export const Series: Model<ISeriesDoc> = mongoose.models.Series || mongoose.model<ISeriesDoc>('Series', SeriesSchema);
