import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMonetizationGoalDoc extends Document {
  accountId: mongoose.Types.ObjectId;
  targetSubscribers: number;
  targetWatchHours: number;
  targetShortsViews: number;
  targetUploadsPerMonth: number;
  deadline?: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MonetizationGoalSchema = new Schema<IMonetizationGoalDoc>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'YouTubeAccount', required: true, unique: true, index: true },
    targetSubscribers: { type: Number, default: 1000 },
    targetWatchHours: { type: Number, default: 4000 },
    targetShortsViews: { type: Number, default: 10_000_000 },
    targetUploadsPerMonth: { type: Number, default: 4 },
    deadline: { type: Date },
    note: { type: String },
  },
  { timestamps: true }
);

export const MonetizationGoal: Model<IMonetizationGoalDoc> =
  mongoose.models.MonetizationGoal ||
  mongoose.model<IMonetizationGoalDoc>('MonetizationGoal', MonetizationGoalSchema);
