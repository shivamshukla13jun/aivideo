import mongoose, { Schema, Document, Model } from 'mongoose';

const PanelSchema = new Schema(
  {
    id: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    imageUrl: { type: String },
  },
  { _id: false }
);

export interface IPageDoc extends Document {
  chapterId: string;
  pageId: string;
  order: number;
  originalUrl: string;
  editedUrl?: string;
  publicId?: string;
  extractedText?: string;
  panels: any[];
  status: 'active' | 'deleted' | 'split';
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema = new Schema<IPageDoc>(
  {
    chapterId: { type: String, required: true, index: true },
    pageId: { type: String, default: '', index: true },
    order: { type: Number, required: true },
    originalUrl: { type: String, required: true },
    editedUrl: { type: String },
    publicId: { type: String, default: '' },
    extractedText: { type: String, default: '' },
    panels: [PanelSchema],
    status: { type: String, enum: ['active', 'deleted', 'split'], default: 'active' },
  },
  { timestamps: true }
);

export const Page: Model<IPageDoc> = mongoose.models.Page || mongoose.model<IPageDoc>('Page', PageSchema);
