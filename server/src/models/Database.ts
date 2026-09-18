import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  Series,
  Chapter,
  Page,
  Scene,
  ChapterStory,
  ReferenceVoice,
  GeneratedNarration,
  Asset,
  VideoProject
} from '../../src/types/index';

// In-Memory & Persistent Database Store for robust execution
class MemoryDatabase {
  public users: Map<string, User & { passwordHash: string }> = new Map();
  public series: Map<string, Series> = new Map();
  public chapters: Map<string, Chapter> = new Map();
  public pages: Map<string, Page[]> = new Map(); // chapterId -> pages
  public scenes: Map<string, Scene[]> = new Map(); // chapterId -> scenes
  public stories: Map<string, ChapterStory> = new Map(); // chapterId -> story
  public narrations: Map<string, GeneratedNarration[]> = new Map(); // chapterId -> narrations
  public assets: Map<string, Asset[]> = new Map(); // userId -> assets
  public videoProjects: Map<string, VideoProject> = new Map(); // projectId -> project

  private dbFilePath = path.join(process.cwd(), 'server', 'data', 'store.json');

  constructor() {
    this.seedDefaults();
    this.loadFromDisk();
    this.ensureSuperAdminExists();
  }

  public saveToDisk() {
    try {
      const dataDir = path.dirname(this.dbFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const serializable = {
        users: Array.from(this.users.entries()),
        series: Array.from(this.series.entries()),
        chapters: Array.from(this.chapters.entries()),
        pages: Array.from(this.pages.entries()),
        scenes: Array.from(this.scenes.entries()),
        stories: Array.from(this.stories.entries()),
        narrations: Array.from(this.narrations.entries()),
        assets: Array.from(this.assets.entries()),
        videoProjects: Array.from(this.videoProjects.entries())
      };
      fs.writeFileSync(this.dbFilePath, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed saving database to disk:', err);
    }
  }

  public loadFromDisk() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.users && Array.isArray(parsed.users)) this.users = new Map(parsed.users);
        if (parsed.series && Array.isArray(parsed.series)) this.series = new Map(parsed.series);
        if (parsed.chapters && Array.isArray(parsed.chapters)) this.chapters = new Map(parsed.chapters);
        if (parsed.pages && Array.isArray(parsed.pages)) this.pages = new Map(parsed.pages);
        if (parsed.scenes && Array.isArray(parsed.scenes)) this.scenes = new Map(parsed.scenes);
        if (parsed.stories && Array.isArray(parsed.stories)) this.stories = new Map(parsed.stories);
        if (parsed.narrations && Array.isArray(parsed.narrations)) this.narrations = new Map(parsed.narrations);
        if (parsed.assets && Array.isArray(parsed.assets)) this.assets = new Map(parsed.assets);
        if (parsed.videoProjects && Array.isArray(parsed.videoProjects)) this.videoProjects = new Map(parsed.videoProjects);
        console.log('[DB] Restored database from disk successfully.');
      }
    } catch (err) {
      console.error('[DB] Failed reading database from disk:', err);
    }
  }

  public ensureSuperAdminExists() {
    const adminList = [
      {
        email: 'admin@webtoonstudio.com',
        password: 'Admin@12345',
        name: 'Super Administrator'
      }
    ];

    if (process.env.SUPER_ADMIN_EMAIL) {
      const envEmail = process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
      if (envEmail !== 'admin@webtoonstudio.com') {
        adminList.push({
          email: envEmail,
          password: (process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345').trim(),
          name: (process.env.SUPER_ADMIN_NAME || 'Super Administrator').trim()
        });
      }
    }

    for (const adminDef of adminList) {
      let admin = Array.from(this.users.values()).find(
        (u) => u.email.toLowerCase() === adminDef.email.toLowerCase()
      );

      if (!admin) {
        const superAdminId = `usr_superadmin_${adminDef.email.replace(/[^a-z0-9]/gi, '_')}`;
        const passwordHash = bcrypt.hashSync(adminDef.password, 10);
        admin = {
          id: superAdminId,
          email: adminDef.email,
          name: adminDef.name,
          role: 'superadmin',
          passwordHash,
          referenceVoice: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.users.set(superAdminId, admin);
        console.log(`[DB] Created default super admin: ${adminDef.email}`);
      } else {
        admin.role = 'superadmin';
        if (!bcrypt.compareSync(adminDef.password, admin.passwordHash)) {
          admin.passwordHash = bcrypt.hashSync(adminDef.password, 10);
        }
      }
    }
  }

  private seedDefaults() {
    const demoPasswordHash = bcrypt.hashSync('demo1234', 10);
    const demoUserId = 'usr_demo123';

    // Seed Demo User
    this.users.set(demoUserId, {
      id: demoUserId,
      email: 'creator@webtoonstudio.com',
      name: 'Comic Creator',
      role: 'creator',
      passwordHash: demoPasswordHash,
      referenceVoice: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Seed Demo Series
    const series1Id = 'srs_shadow_reborn';
    this.series.set(series1Id, {
      id: series1Id,
      title: 'Shadow Monarch Reborn',
      description: 'In a world overrun by dungeon gates, a rank-E hunter discovers an ancient power awakening within him.',
      coverImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&q=80',
      author: 'Sung Jin',
      genres: ['Action', 'Fantasy', 'Webtoon', 'Supernatural'],
      status: 'ongoing',
      createdBy: demoUserId,
      chapterCount: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Seed Demo Chapters
    const ch1Id = 'ch_001';
    const ch2Id = 'ch_002';
    const ch3Id = 'ch_003';

    this.chapters.set(ch1Id, {
      id: ch1Id,
      seriesId: series1Id,
      chapterNumber: 1,
      title: 'The Dual Dungeon',
      status: 'narration-ready',
      readingProgress: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.chapters.set(ch2Id, {
      id: ch2Id,
      seriesId: series1Id,
      chapterNumber: 2,
      title: 'Awakening of the Shadow',
      status: 'script-completed',
      readingProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.chapters.set(ch3Id, {
      id: ch3Id,
      seriesId: series1Id,
      chapterNumber: 3,
      title: 'The First Quest',
      status: 'unread',
      readingProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Seed Pages for Chapter 1
    const pagesCh1: Page[] = [
      {
        id: 'pg_1_1',
        chapterId: ch1Id,
        pageNumber: 1,
        imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&q=80',
        width: 1000,
        height: 1500,
        createdAt: new Date().toISOString()
      },
      {
        id: 'pg_1_2',
        chapterId: ch1Id,
        pageNumber: 2,
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&q=80',
        width: 1000,
        height: 1500,
        createdAt: new Date().toISOString()
      },
      {
        id: 'pg_1_3',
        chapterId: ch1Id,
        pageNumber: 3,
        imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1000&q=80',
        width: 1000,
        height: 1500,
        createdAt: new Date().toISOString()
      },
      {
        id: 'pg_1_4',
        chapterId: ch1Id,
        pageNumber: 4,
        imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1000&q=80',
        width: 1000,
        height: 1500,
        createdAt: new Date().toISOString()
      }
    ];
    this.pages.set(ch1Id, pagesCh1);

    // Seed Scenes for Chapter 1
    const scenesCh1: Scene[] = [
      {
        id: 'scn_1',
        chapterId: ch1Id,
        pageId: 'pg_1_1',
        sceneNumber: 1,
        characters: ['Jin', 'Mr. Song'],
        narration: 'Deep beneath the city streets, an unranked gate opened into a pitch black cavern.',
        dialogue: 'Mr. Song: "Keep your eyes sharp, everyone. Something feels wrong."',
        emotion: 'Tension',
        duration: 6,
        order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'scn_2',
        chapterId: ch1Id,
        pageId: 'pg_1_2',
        sceneNumber: 2,
        characters: ['Jin'],
        narration: 'Jin stepped toward the colossal stone doors adorned with ancient glyphs.',
        dialogue: 'Jin: "A double dungeon inside a D-Rank gate? This cannot be real."',
        emotion: 'Awe & Dread',
        duration: 7,
        order: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'scn_3',
        chapterId: ch1Id,
        pageId: 'pg_1_3',
        sceneNumber: 3,
        characters: ['Statue of God'],
        narration: 'The massive stone statue seated at the throne suddenly turned its crimson eyes upon the hunters.',
        dialogue: 'System Warning: "Prepare to bow before the Lord."',
        emotion: 'Terror',
        duration: 8,
        order: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    this.scenes.set(ch1Id, scenesCh1);

    // Seed Complete Story for Chapter 1
    this.stories.set(ch1Id, {
      id: 'st_1',
      chapterId: ch1Id,
      content: `[Chapter 1: The Dual Dungeon]\n\nDeep beneath the city streets, an unranked gate opened into a pitch black cavern. Mr. Song warned everyone to keep their eyes sharp, as an uneasy stillness filled the damp air.\n\nJin slowly stepped toward the colossal stone doors adorned with glowing ancient glyphs. "A double dungeon inside a D-Rank gate? This cannot be real," he whispered under his breath.\n\nWithout warning, the massive stone statue seated on the central throne turned its crimson glowing eyes upon the trembling hunters. The air compressed violently as a System notification flashed in dark red: "Prepare to bow before the Lord."`,
      status: 'saved',
      versions: [
        {
          version: 1,
          content: 'Initial scene compilation story draft.',
          updatedAt: new Date().toISOString()
        }
      ],
      updatedAt: new Date().toISOString()
    });

    // Seed Assets
    this.assets.set(demoUserId, [
      {
        id: 'ast_1',
        userId: demoUserId,
        title: 'Epic Cinematic Theme',
        type: 'music',
        url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=cinematic-atmosphere-112318.mp3',
        duration: 120,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ast_2',
        userId: demoUserId,
        title: 'Thunder & Door Creak SFX',
        type: 'sfx',
        url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_88490a6e0c.mp3?filename=creepy-door-open-9801.mp3',
        duration: 5,
        createdAt: new Date().toISOString()
      }
    ]);
  }
}

export const db = new MemoryDatabase();
