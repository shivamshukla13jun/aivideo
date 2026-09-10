import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { StoryMemoryModel, IStoryMemoryDoc } from '../db/models/StoryMemory';
import { connectDB, isDBConnected } from '../db/connection';

export interface MangaIdentifier {
  mangaId?: string | number;
  mangaTitle: string;
}

export interface MangaCharacter {
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
  secretsOrMysteries?: string[];
}

export interface ChapterHistory {
  chapterId?: string;
  chapterName: string;
  summary: string; // Large text summary
  fullTranscript?: string; // Large text complete dialogue & narration
  keyEvents?: string[];
  cliffhanger?: string;
  recordedAt: string;
}

export interface MangaStoryMemory {
  mangaId: string;
  mangaTitle: string;
  theme?: string;
  overallLore: string; // Large text deep lore
  characters: MangaCharacter[];
  pastChapters: ChapterHistory[];
  unresolvedMysteries: string[];
  updatedAt: string;
}

export class CharacterMemoryService {
  private memoryDir: string;

  constructor() {
    this.memoryDir = path.join(config.storageDir, 'memory');
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  private getSlug(title: string): string {
    return (title || 'anime').toLowerCase().replace(/[^a-z0-9]/gi, '_');
  }

  private getFilePath(mangaTitle: string): string {
    const slug = this.getSlug(mangaTitle);
    return path.join(this.memoryDir, `${slug}_memory.json`);
  }

  /**
   * Retrieve stored story memory, theme and characters from MongoDB by mangaId or mangaTitle
   */
  async getMemory(identifier: MangaIdentifier | string): Promise<MangaStoryMemory> {
    const mangaTitle = typeof identifier === 'string' ? identifier : identifier.mangaTitle;
    const rawMangaId = typeof identifier === 'object' && identifier.mangaId ? String(identifier.mangaId).trim() : '';
    const slug = this.getSlug(mangaTitle);
    const mangaId = rawMangaId || slug;

    // 1. Try fetching from MongoDB first
    try {
      if (!isDBConnected()) {
        await connectDB();
      }

      const orConditions: any[] = [];
      if (rawMangaId) {
        orConditions.push({ mangaId: rawMangaId });
      }
      orConditions.push({ mangaTitle: { $regex: new RegExp(`^${mangaTitle.trim()}$`, 'i') } });
      orConditions.push({ slug });

      const doc = await StoryMemoryModel.findOne({ $or: orConditions }).lean();

      if (doc) {
        return {
          mangaId: doc.mangaId || mangaId,
          mangaTitle: doc.mangaTitle,
          theme: doc.theme || 'Action Anime & Story',
          overallLore: doc.overallLore || '',
          characters: (doc.characters || []).map((c) => ({
            name: c.name,
            aliases: c.aliases,
            role: c.role,
            description: c.description,
            fullBio: c.fullBio,
            keyTraits: c.keyTraits,
            firstAppearedChapterId: c.firstAppearedChapterId,
            firstAppearedChapter: c.firstAppearedChapter,
            lastSeenChapterId: c.lastSeenChapterId,
            lastSeenChapter: c.lastSeenChapter,
            secretsOrMysteries: c.secretsOrMysteries,
          })),
          pastChapters: (doc.pastChapters || []).map((ch) => ({
            chapterId: ch.chapterId,
            chapterName: ch.chapterName,
            summary: ch.summary,
            fullTranscript: ch.fullTranscript,
            keyEvents: ch.keyEvents,
            cliffhanger: ch.cliffhanger,
            recordedAt: ch.recordedAt,
          })),
          unresolvedMysteries: doc.unresolvedMysteries || [],
          updatedAt: (doc.updatedAt ? new Date(doc.updatedAt) : new Date()).toISOString(),
        };
      }
    } catch (dbErr) {
      console.warn(`[CharacterMemoryService] MongoDB fetch error for "${mangaTitle}":`, dbErr);
    }

    // 2. Fallback: check file cache
    const filePath = this.getFilePath(mangaTitle);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.mangaId) parsed.mangaId = mangaId;
        // Automatically sync existing disk file into MongoDB
        this.saveToDB(parsed).catch(() => {});
        return parsed;
      } catch (err) {
        console.warn(`[CharacterMemory] Failed to read disk memory for ${mangaTitle}`, err);
      }
    }

    // 3. Default empty memory record
    return {
      mangaId,
      mangaTitle,
      theme: 'Action Anime & Story',
      overallLore: '',
      characters: [],
      pastChapters: [],
      unresolvedMysteries: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Helper to persist to MongoDB
   */
  private async saveToDB(memory: MangaStoryMemory): Promise<void> {
    try {
      if (!isDBConnected()) {
        await connectDB();
      }

      const mangaId = memory.mangaId || this.getSlug(memory.mangaTitle);
      const slug = this.getSlug(memory.mangaTitle);
      await StoryMemoryModel.findOneAndUpdate(
        {
          $or: [
            { mangaId },
            { mangaTitle: { $regex: new RegExp(`^${memory.mangaTitle.trim()}$`, 'i') } },
          ],
        },
        {
          $set: {
            mangaId,
            mangaTitle: memory.mangaTitle,
            slug,
            theme: memory.theme || 'Action Anime & Story',
            overallLore: memory.overallLore || '',
            characters: memory.characters || [],
            pastChapters: memory.pastChapters || [],
            unresolvedMysteries: memory.unresolvedMysteries || [],
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.warn(`[CharacterMemoryService] MongoDB save error for "${memory.mangaTitle}":`, err);
    }
  }

  /**
   * Save updated memory to both MongoDB and local backup
   */
  async saveMemory(memory: MangaStoryMemory): Promise<MangaStoryMemory> {
    memory.updatedAt = new Date().toISOString();

    // Save to MongoDB
    await this.saveToDB(memory);

    // Save to file cache as safe local backup
    try {
      const filePath = this.getFilePath(memory.mangaTitle);
      fs.writeFileSync(filePath, JSON.stringify(memory, null, 2), 'utf-8');
    } catch (fileErr) {
      console.warn(`[CharacterMemoryService] File backup warning:`, fileErr);
    }

    return memory;
  }

  /**
   * Format existing character memory into an AI context block for Gemini Vision prompt injection
   */
  async formatMemoryForPrompt(identifier: MangaIdentifier | string): Promise<string> {
    const memory = await this.getMemory(identifier);
    if (!memory.characters.length && !memory.pastChapters.length && !memory.overallLore) {
      return '';
    }

    let result = `=== PERSISTENT MANGA STORY MEMORY (पूर्व कहानी और किरदारों की याददाश्त) ===\n`;
    result += `MANGA ID: ${memory.mangaId} | TITLE: "${memory.mangaTitle}"\n`;

    if (memory.theme) {
      result += `STORY THEME: ${memory.theme}\n`;
    }

    if (memory.overallLore) {
      result += `OVERALL STORY LORE: ${memory.overallLore}\n\n`;
    }

    if (memory.characters.length > 0) {
      result += `KNOWN CHARACTERS IN THIS SERIES:\n`;
      memory.characters.forEach((char) => {
        result += `- **${char.name}** (${char.role}): ${char.description}`;
        if (char.fullBio) result += ` | Bio: ${char.fullBio}`;
        if (char.keyTraits?.length) result += ` | Traits: ${char.keyTraits.join(', ')}`;
        if (char.secretsOrMysteries?.length) result += ` | Mystery/Secrets: ${char.secretsOrMysteries.join(', ')}`;
        result += `\n`;
      });
      result += `\n`;
    }

    if (memory.pastChapters.length > 0) {
      result += `RECENT CHAPTER RECAPS:\n`;
      const recent = memory.pastChapters.slice(-5);
      recent.forEach((ch) => {
        result += `* ${ch.chapterName} (ID: ${ch.chapterId || 'N/A'}): ${ch.summary}`;
        if (ch.keyEvents?.length) result += ` (Key events: ${ch.keyEvents.join('; ')})`;
        result += `\n`;
      });
      result += `\n`;
    }

    result += `=== INSTRUCTION FOR AUDIENCE ENGAGEMENT & RECALL (हिंदी में) ===\n`;
    result += `1. If any anonymous, mysterious, or masked character appears, or if an established character behaves strangely or performs a recognizable move, connect it to past events in Hindi!\n`;
    result += `2. Add exciting narrator reminders in Hindi to engage the audience (उदा: "ज़रा रुकिए... उस निशान को ध्यान से देखिए!", "क्या ये वही पुराना योद्धा है?!", "याद कीजिए पिछली बार जब इसने वो चाल चली थी...").\n`;
    result += `3. EVERYTHING must be written in dramatic, high-energy conversational Hindi.\n`;

    return result;
  }

  /**
   * Update character memory, theme, and chapter history after Gemini analyzes the new chapter
   */
  async updateMemoryFromAnalysis(
    identifier: MangaIdentifier | string,
    chapterInfo: { chapterId?: string | number; chapterName: string } | string,
    extractedData: {
      theme?: string;
      chapterSummary?: string;
      fullTranscript?: string;
      keyEvents?: string[];
      newCharacters?: MangaCharacter[];
      discoveredMysteries?: string[];
    }
  ): Promise<MangaStoryMemory> {
    const memory = await this.getMemory(identifier);
    const chapterName = typeof chapterInfo === 'string' ? chapterInfo : chapterInfo.chapterName;
    const chapterId =
      typeof chapterInfo === 'object' && chapterInfo.chapterId ? String(chapterInfo.chapterId) : undefined;

    if (extractedData.theme) {
      memory.theme = extractedData.theme;
    }

    // 1. Add chapter history with chapterId and fullTranscript
    if (extractedData.chapterSummary || extractedData.fullTranscript) {
      const existingIdx = memory.pastChapters.findIndex(
        (c) => (chapterId && c.chapterId === chapterId) || c.chapterName === chapterName
      );
      const chapterEntry: ChapterHistory = {
        chapterId,
        chapterName,
        summary: extractedData.chapterSummary || '',
        fullTranscript: extractedData.fullTranscript || '',
        keyEvents: extractedData.keyEvents || [],
        recordedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        memory.pastChapters[existingIdx] = chapterEntry;
      } else {
        memory.pastChapters.push(chapterEntry);
      }
    }

    // 2. Merge / update characters
    if (extractedData.newCharacters && extractedData.newCharacters.length > 0) {
      extractedData.newCharacters.forEach((newChar) => {
        if (!newChar.name) return;

        const existingChar = memory.characters.find(
          (c) => c.name.toLowerCase() === newChar.name.toLowerCase()
        );

        if (existingChar) {
          existingChar.lastSeenChapterId = chapterId || existingChar.lastSeenChapterId;
          existingChar.lastSeenChapter = chapterName;
          if (newChar.description) existingChar.description = newChar.description;
          if (newChar.fullBio) existingChar.fullBio = newChar.fullBio;
          if (newChar.role) existingChar.role = newChar.role;
          if (newChar.keyTraits?.length) {
            existingChar.keyTraits = Array.from(
              new Set([...(existingChar.keyTraits || []), ...newChar.keyTraits])
            );
          }
          if (newChar.secretsOrMysteries?.length) {
            existingChar.secretsOrMysteries = Array.from(
              new Set([...(existingChar.secretsOrMysteries || []), ...newChar.secretsOrMysteries])
            );
          }
        } else {
          memory.characters.push({
            ...newChar,
            firstAppearedChapterId: chapterId,
            firstAppearedChapter: chapterName,
            lastSeenChapterId: chapterId,
            lastSeenChapter: chapterName,
          });
        }
      });
    }

    // 3. Add unresolved mysteries
    if (extractedData.discoveredMysteries?.length) {
      memory.unresolvedMysteries = Array.from(
        new Set([...memory.unresolvedMysteries, ...extractedData.discoveredMysteries])
      ).slice(-20);
    }

    await this.saveMemory(memory);
    return memory;
  }

  /**
   * Retrieve all stored manga memories from MongoDB
   */
  async getAllMemories(): Promise<MangaStoryMemory[]> {
    try {
      if (!isDBConnected()) {
        await connectDB();
      }

      const docs = await StoryMemoryModel.find({}).sort({ updatedAt: -1 }).lean();
      return docs.map((doc) => ({
        mangaId: doc.mangaId || doc.slug,
        mangaTitle: doc.mangaTitle,
        theme: doc.theme,
        overallLore: doc.overallLore,
        characters: (doc.characters || []).map((c) => ({
          name: c.name,
          aliases: c.aliases,
          role: c.role,
          description: c.description,
          fullBio: c.fullBio,
          keyTraits: c.keyTraits,
          firstAppearedChapterId: c.firstAppearedChapterId,
          firstAppearedChapter: c.firstAppearedChapter,
          lastSeenChapterId: c.lastSeenChapterId,
          lastSeenChapter: c.lastSeenChapter,
          secretsOrMysteries: c.secretsOrMysteries,
        })),
        pastChapters: (doc.pastChapters || []).map((ch) => ({
          chapterId: ch.chapterId,
          chapterName: ch.chapterName,
          summary: ch.summary,
          fullTranscript: ch.fullTranscript,
          keyEvents: ch.keyEvents,
          cliffhanger: ch.cliffhanger,
          recordedAt: ch.recordedAt,
        })),
        unresolvedMysteries: doc.unresolvedMysteries || [],
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      }));
    } catch (err) {
      console.warn('[CharacterMemoryService] Failed to get all memories from DB:', err);
      return [];
    }
  }

  /**
   * Delete a memory record from MongoDB and disk
   */
  async deleteMemory(identifier: MangaIdentifier | string): Promise<boolean> {
    const mangaTitle = typeof identifier === 'string' ? identifier : identifier.mangaTitle;
    const mangaId = typeof identifier === 'object' && identifier.mangaId ? String(identifier.mangaId) : '';
    const slug = this.getSlug(mangaTitle);
    try {
      if (!isDBConnected()) {
        await connectDB();
      }
      const orConditions: any[] = [{ mangaTitle }, { slug }];
      if (mangaId) orConditions.push({ mangaId });
      await StoryMemoryModel.deleteOne({ $or: orConditions });
    } catch (err) {
      console.warn('[CharacterMemoryService] Failed to delete from DB:', err);
    }

    const filePath = this.getFilePath(mangaTitle);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }

    return true;
  }
}

export const characterMemoryService = new CharacterMemoryService();
