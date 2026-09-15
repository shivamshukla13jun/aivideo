import { getMangas, getChapters, getCategories, getSources, getHistory, addManga, addChapters, setInLibrary } from '../db/store.js';

export interface StandardMangaJSON {
  id: number;
  sourceId: string;
  title: string;
  thumbnailUrl: string;
  author: string;
  artist: string;
  description: string;
  genre: string[];
  status: 'ONGOING' | 'COMPLETED' | 'LICENSED' | 'UNKNOWN';
  inLibrary: boolean;
  inLibraryAt?: string | null;
  categories: number[];
  url: string;
  chaptersCount: number;
  unreadCount: number;
  lastReadAt?: string | null;
  initialized: boolean;
}

export interface StandardChapterJSON {
  id: number;
  mangaId: number;
  chapterNumber: number;
  name: string;
  url: string;
  uploadDate: string;
  scanlator: string;
  read: boolean;
  bookmark: boolean;
  lastPageRead: number;
  pageCount: number;
  pages: string[];
}

export interface StandardCatalogResultJSON {
  mangasPage: number;
  hasNextPage: boolean;
  mangaList: StandardMangaJSON[];
}

export interface StandardBackupJSON {
  version: number;
  timestamp: string;
  sources: any[];
  categories: any[];
  mangas: StandardMangaJSON[];
  chapters: StandardChapterJSON[];
  history: any[];
}

/**
 * Standardize any raw scraped Manga item into the unified JSON structure across all sources
 */
export function formatMangaJSON(raw: any, defaultSourceId = 'mangafire', inLibraryIds: Set<number> = new Set()): StandardMangaJSON {
  const sourceId = (raw.sourceId || defaultSourceId).toLowerCase();
  
  // Clean title
  let cleanTitle = (raw.title || 'Untitled Manga')
    .replace(/^[\d.]+\s*[\d.]*\s*/, '') // Remove rating numbers like "9.09.0" or "7.8"
    .trim();
  
  // Deduplicate title if repeated back to back
  const mid = Math.floor(cleanTitle.length / 2);
  if (mid > 3 && cleanTitle.substring(0, mid) === cleanTitle.substring(mid)) {
    cleanTitle = cleanTitle.substring(0, mid).trim();
  }

  const id = typeof raw.id === 'number' ? raw.id : Math.abs(hashString(raw.url || cleanTitle));

  return {
    id,
    sourceId,
    title: cleanTitle || 'Untitled Manga',
    thumbnailUrl: raw.thumbnailUrl || raw.cover || raw.img || '',
    author: raw.author || `${sourceId.charAt(0).toUpperCase() + sourceId.slice(1)} Author`,
    artist: raw.artist || `${sourceId.charAt(0).toUpperCase() + sourceId.slice(1)} Artist`,
    description: raw.description || `Read ${cleanTitle} on ${sourceId}`,
    genre: Array.isArray(raw.genre) && raw.genre.length > 0 ? raw.genre : ['Action', 'Fantasy'],
    status: (raw.status || 'ONGOING').toUpperCase() as any,
    inLibrary: raw.inLibrary ?? inLibraryIds.has(id),
    inLibraryAt: raw.inLibraryAt || null,
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    url: raw.url || '',
    chaptersCount: raw.chaptersCount || raw.chapterCount || 0,
    unreadCount: raw.unreadCount || 0,
    lastReadAt: raw.lastReadAt || null,
    initialized: true,
  };
}

/**
 * Standardize any raw Chapter item into the unified JSON structure across all sources
 */
export function formatChapterJSON(raw: any, mangaId: number, defaultSourceId = 'mangafire'): StandardChapterJSON {
  const chapterNumber = typeof raw.chapterNumber === 'number' ? raw.chapterNumber : 1;
  const chapterName = raw.name || raw.title || `Chapter ${chapterNumber}`;
  const url = raw.url || '';
  const id = typeof raw.id === 'number' ? raw.id : Math.abs(hashString(url || `${mangaId}-${chapterNumber}`));

  return {
    id,
    mangaId,
    chapterNumber,
    name: chapterName,
    url,
    uploadDate: raw.uploadDate || new Date().toISOString(),
    scanlator: raw.scanlator || defaultSourceId,
    read: !!raw.read,
    bookmark: !!raw.bookmark,
    lastPageRead: raw.lastPageRead || 0,
    pageCount: raw.pageCount || (Array.isArray(raw.pages) ? raw.pages.length : 0),
    pages: Array.isArray(raw.pages) ? raw.pages : [],
  };
}

/**
 * Standardize Catalog / Search results page into unified JSON structure
 */
export function formatCatalogResultJSON(pageNum: number, rawList: any[], sourceId = 'mangafire', hasNextPage = false): StandardCatalogResultJSON {
  const mangaList = (rawList || []).map((raw) => formatMangaJSON(raw, sourceId));
  return {
    mangasPage: pageNum,
    hasNextPage,
    mangaList,
  };
}

/**
 * Helper string hashing function for numerical IDs
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 90000000) + 100000;
}

/**
 * Export current database / store state to standardized JSON structure
 */
export async function exportBackupJSON(): Promise<StandardBackupJSON> {
  const sources = await getSources();
  const categories = await getCategories();
  const mangas = await getMangas();
  
  const allChapters: StandardChapterJSON[] = [];
  for (const m of mangas) {
    const chapters = await getChapters(m.id);
    for (const ch of chapters) {
      allChapters.push(formatChapterJSON(ch, m.id, m.sourceId));
    }
  }

  const history = await getHistory();

  return {
    version: 1,
    timestamp: new Date().toISOString(),
    sources,
    categories,
    mangas: mangas.map((m:any) => formatMangaJSON(m, m.sourceId)),
    chapters: allChapters,
    history: history || [],
  };
}

/**
 * Import and restore state from standardized JSON structure
 */
export async function importBackupJSON(jsonData: any): Promise<{
  success: boolean;
  imported: { mangasCount: number; chaptersCount: number };
}> {
  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Invalid JSON import payload');
  }

  const mangas = Array.isArray(jsonData.mangas) ? jsonData.mangas : [];
  const chapters = Array.isArray(jsonData.chapters) ? jsonData.chapters : [];

  let importedMangasCount = 0;
  let importedChaptersCount = 0;

  for (const rawManga of mangas) {
    const m = formatMangaJSON(rawManga, rawManga.sourceId || 'mangafire');
    m.inLibrary = true;
    m.inLibraryAt = new Date().toISOString();
    await addManga(m);
    await setInLibrary(m.id, true);
    importedMangasCount++;
  }

  if (chapters.length > 0) {
    const formattedChapters = chapters.map((ch: any) => formatChapterJSON(ch, ch.mangaId, ch.scanlator || 'mangafire'));
    await addChapters(formattedChapters);
    importedChaptersCount = formattedChapters.length;
  }

  return {
    success: true,
    imported: {
      mangasCount: importedMangasCount,
      chaptersCount: importedChaptersCount,
    },
  };
}
