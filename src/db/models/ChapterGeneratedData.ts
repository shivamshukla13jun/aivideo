import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubtitleData {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  style?: Record<string, any>;
}

export interface IGeneratedSceneData {
  id: string;
  slideNumber: number;
  pageIndex?: number;
  title: string;
  imageUrl: string;
  duration: number; // Situation & subtitle-length aware duration
  effect: string;
  narration: string;
  subtitles: ISubtitleData[];
  audioClips?: any[];
}

export interface IChapterGeneratedDoc extends Document {
  chapterId: string; // Unique index for the chapter
  mangaId: string;   // Associated manga ID
  mangaTitle: string;
  chapterName: string;
  title: string;
  description: string;
  chapterSummary: string;
  totalPanels: number;
  scenes: IGeneratedSceneData[];
  panelCaptions: Record<string, string>; // pageIndex -> caption
  characters?: Array<{
    name: string;
    role: string;
    description: string;
    keyTraits?: string[];
    secretsOrMysteries?: string[];
  }>;
  unresolvedMysteries?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const SubtitleSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    style: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const GeneratedSceneSchema = new Schema(
  {
    id: { type: String, required: true },
    slideNumber: { type: Number, required: true },
    pageIndex: { type: Number },
    title: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    duration: { type: Number, required: true, min: 1.5, max: 20 },
    effect: { type: String, default: 'kenburns' },
    narration: { type: String, default: '' },
    subtitles: { type: [SubtitleSchema], default: [] },
    audioClips: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const ChapterGeneratedSchema = new Schema<IChapterGeneratedDoc>(
  {
    chapterId: { type: String, required: true, unique: true, index: true },
    mangaId: { type: String, required: true, index: true },
    mangaTitle: { type: String, required: true, trim: true, index: true },
    chapterName: { type: String, required: true, trim: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    chapterSummary: { type: String, default: '' },
    totalPanels: { type: Number, default: 0 },
    scenes: { type: [GeneratedSceneSchema], default: [] },
    panelCaptions: { type: Schema.Types.Mixed, default: {} },
    characters: [{ type: Schema.Types.Mixed }],
    unresolvedMysteries: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

export const ChapterGeneratedModel: Model<IChapterGeneratedDoc> =
  mongoose.models.ChapterGenerated ||
  mongoose.model<IChapterGeneratedDoc>('ChapterGenerated', ChapterGeneratedSchema);
