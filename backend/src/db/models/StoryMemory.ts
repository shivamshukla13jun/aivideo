import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMangaCharacter {
  name: string;
  aliases?: string[];
  role: string; // e.g., "नायक (Protagonist)", "खलनायक (Villain)", "नकाबपोश योद्धा (Masked Warrior)"
  description: string; // Large text: appearance, visual traits, dialogue style
  fullBio?: string; // Large text: backstory, powers, techniques
  keyTraits?: string[];
  firstAppearedChapterId?: string;
  firstAppearedChapter?: string;
  lastSeenChapterId?: string;
  lastSeenChapter?: string;
  secretsOrMysteries?: string[]; // Ongoing mysteries or clues
}

export interface IChapterHistory {
  chapterId?: string; // Suwayomi chapter id
  chapterName: string;
  summary: string; // Large text: comprehensive chapter recap
  fullTranscript?: string; // Large text: complete narrative subtitles & spoken dialogue
  keyEvents?: string[];
  cliffhanger?: string;
  recordedAt: string;
}

export interface IStoryMemoryDoc extends Document {
  mangaId: string; // Unique manga library identifier
  mangaTitle: string;
  slug: string;
  theme: string;
  overallLore: string; // Large text: deep lore and world background
  characters: IMangaCharacter[];
  pastChapters: IChapterHistory[];
  unresolvedMysteries: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CharacterSubSchema = new Schema<IMangaCharacter>(
  {
    name: { type: String, required: true, trim: true },
    aliases: [{ type: String, trim: true }],
    role: { type: String, default: 'Supporting Character' },
    description: { type: String, default: '' }, // Large text
    fullBio: { type: String, default: '' }, // Large text
    keyTraits: [{ type: String }],
    firstAppearedChapterId: { type: String },
    firstAppearedChapter: { type: String },
    lastSeenChapterId: { type: String },
    lastSeenChapter: { type: String },
    secretsOrMysteries: [{ type: String }],
  },
  { _id: false }
);

const ChapterSubSchema = new Schema<IChapterHistory>(
  {
    chapterId: { type: String },
    chapterName: { type: String, required: true },
    summary: { type: String, default: '' }, // Large text
    fullTranscript: { type: String, default: '' }, // Large text
    keyEvents: [{ type: String }],
    cliffhanger: { type: String },
    recordedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false }
);

const StoryMemorySchema = new Schema<IStoryMemoryDoc>(
  {
    mangaId: { type: String, required: true, unique: true, index: true },
    mangaTitle: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, index: true },
    theme: { type: String, default: 'Action Anime & Story' },
    overallLore: { type: String, default: '' }, // Large text
    characters: { type: [CharacterSubSchema], default: [] },
    pastChapters: { type: [ChapterSubSchema], default: [] },
    unresolvedMysteries: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Prevent re-compiling Model in HMR / ts-node-dev
export const StoryMemoryModel: Model<IStoryMemoryDoc> =
  mongoose.models.StoryMemory || mongoose.model<IStoryMemoryDoc>('StoryMemory', StoryMemorySchema);

