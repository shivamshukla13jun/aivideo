import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGeminiKeyDoc extends Document {
  /** Full API key — only ever stored server-side, masked in API responses. */
  key: string;
  label: string;
  /** Manually disabled or auto-disabled on an invalid-key auth error. */
  disabled: boolean;
  /** Last failure kind: 'quota' | 'invalid' | '' (cleared on success). */
  lastError: string;
  lastErrorAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GeminiKeySchema = new Schema<IGeminiKeyDoc>(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    lastError: { type: String, default: '' },
    lastErrorAt: { type: Date },
  },
  { timestamps: true }
);

export const GeminiKey: Model<IGeminiKeyDoc> =
  mongoose.models.GeminiKey || mongoose.model<IGeminiKeyDoc>('GeminiKey', GeminiKeySchema);
