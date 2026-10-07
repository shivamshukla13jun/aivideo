import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISettingDoc extends Document {
  name: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISettingDoc>(
  {
    name: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Setting: Model<ISettingDoc> =
  mongoose.models.Setting || mongoose.model<ISettingDoc>('Setting', SettingSchema);
