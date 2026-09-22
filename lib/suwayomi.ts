/**
 * Suwayomi Server Integration Client
 * Interacts with Suwayomi-Server running on port 4567 via GraphQL and REST endpoints.
 */

export const SUWAYOMI_URL = process.env.SUWAYOMI_URL || 'http://localhost:4567';

export function resolveSuwayomiUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanBase = SUWAYOMI_URL.replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}

export async function querySuwayomi<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const endpoint = `${SUWAYOMI_URL.replace(/\/+$/, '')}/api/graphql`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Suwayomi GraphQL error (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e: any) => e.message).join(', '));
  }

  return json.data;
}

export interface SuwayomiMangaNode {
  id: number;
  title: string;
  artist?: string | null;
  author?: string | null;
  description?: string | null;
  genre?: string[] | string | null;
  status: string;
  inLibrary: boolean;
  thumbnailUrl?: string | null;
  thumbnailUrlLastFetched?: string | null;
  chapters?: {
    totalCount: number;
  };
}

export interface SuwayomiChapterNode {
  id: number;
  name: string;
  chapterNumber: number;
  mangaId?: number | null;
  scanlator?: string | null;
  isRead: boolean;
  isDownloaded: boolean;
  isBookmarked?: boolean;
  uploadDate?: string | null;
  lastPageRead?: number | null;
}

/**
 * Fetch all manga currently in the Suwayomi user library
 */
export async function getLibraryMangas(): Promise<SuwayomiMangaNode[]> {
  const query = `
    query GetLibraryMangas {
      mangas(condition: { inLibrary: true }) {
        totalCount
        nodes {
          id
          title
          artist
          author
          description
          genre
          status
          inLibrary
          thumbnailUrl
          thumbnailUrlLastFetched
          chapters {
            totalCount
          }
        }
      }
    }
  `;
  const data = await querySuwayomi<{ mangas: { totalCount: number; nodes: SuwayomiMangaNode[] } }>(query);
  return data?.mangas?.nodes || [];
}

/**
 * Fetch a specific manga's details from Suwayomi
 */
export async function getMangaDetails(id: number): Promise<SuwayomiMangaNode | null> {
  const query = `
    query GetMangaDetails($id: Int!) {
      manga(id: $id) {
        id
        title
        artist
        author
        description
        genre
        status
        inLibrary
        thumbnailUrl
        thumbnailUrlLastFetched
        chapters {
          totalCount
        }
      }
    }
  `;
  const data = await querySuwayomi<{ manga: SuwayomiMangaNode | null }>(query, { id });
  return data?.manga || null;
}

/**
 * Fetch all chapters for a manga ordered by chapter number ascending
 */
export async function getMangaChapters(mangaId: number): Promise<SuwayomiChapterNode[]> {
  const query = `
    query GetMangaChapters($mangaId: Int!) {
      chapters(
        condition: { mangaId: $mangaId }
        order: [{ by: CHAPTER_NUMBER, byType: ASC }]
      ) {
        totalCount
        nodes {
          id
          name
          chapterNumber
          scanlator
          isRead
          isDownloaded
          isBookmarked
          uploadDate
          lastPageRead
        }
      }
    }
  `;
  const data = await querySuwayomi<{ chapters: { totalCount: number; nodes: SuwayomiChapterNode[] } }>(query, {
    mangaId,
  });
  const nodes = data?.chapters?.nodes || [];
  return [...nodes].sort((a, b) => a.chapterNumber - b.chapterNumber);
}

/**
 * Fetch a single chapter details by its ID
 */
export async function getChapterDetails(chapterId: number): Promise<SuwayomiChapterNode | null> {
  const query = `
    query GetChapterDetails($id: Int!) {
      chapter(id: $id) {
        id
        name
        chapterNumber
        mangaId
        scanlator
        isRead
        isDownloaded
        isBookmarked
        uploadDate
        lastPageRead
      }
    }
  `;
  const data = await querySuwayomi<{ chapter: SuwayomiChapterNode | null }>(query, { id: chapterId });
  return data?.chapter || null;
}

/**
 * Fetch page image URLs for a chapter using Suwayomi's fetchChapterPages mutation
 */
export async function getChapterPages(chapterId: number): Promise<{ pageCount: number; pages: string[] }> {
  const query = `
    mutation FetchPages($chapterId: Int!) {
      fetchChapterPages(input: { chapterId: $chapterId }) {
        chapter {
          id
          pageCount
          isDownloaded
        }
        pages
      }
    }
  `;
  const data = await querySuwayomi<{
    fetchChapterPages: {
      chapter: { id: number; pageCount: number; isDownloaded: boolean };
      pages: string[];
    };
  }>(query, { chapterId });

  const rawPages = data?.fetchChapterPages?.pages || [];
  return {
    pageCount: data?.fetchChapterPages?.chapter?.pageCount || rawPages.length,
    pages: rawPages.map(resolveSuwayomiUrl),
  };
}

/**
 * Maps Suwayomi Manga object to WebtoonForge Series format
 */
export function mapSuwayomiMangaToSeries(manga: SuwayomiMangaNode) {
  let genresList: string[] = ['All'];
  if (Array.isArray(manga.genre)) {
    genresList = manga.genre;
  } else if (typeof manga.genre === 'string') {
    genresList = manga.genre.split(',').map(s => s.trim()).filter(Boolean);
  }

  return {
    _id: String(manga.id),
    title: manga.title,
    author: manga.author || 'Unknown Author',
    artist: manga.artist || 'Unknown Artist',
    description: manga.description || 'No description available in Suwayomi library.',
    genres: genresList.length > 0 ? genresList : ['Webtoon'],
    status: (manga.status || 'ongoing').toLowerCase(),
    coverImage: resolveSuwayomiUrl(manga.thumbnailUrl),
    bannerImage: resolveSuwayomiUrl(manga.thumbnailUrl),
    language: 'English',
    releaseYear: 2026,
    chapters: Array.from({ length: manga.chapters?.totalCount || 0 }, (_, i) => String(i + 1)),
    totalChapters: manga.chapters?.totalCount || 0,
    source: 'suwayomi',
    updatedAt: manga.thumbnailUrlLastFetched || new Date().toISOString(),
  };
}

/**
 * Maps Suwayomi Chapter object to WebtoonForge Chapter format
 */
export function mapSuwayomiChapter(chap: SuwayomiChapterNode, seriesId?: string | number) {
  const resolvedSeriesId = seriesId ? String(seriesId) : (chap.mangaId != null ? String(chap.mangaId) : '');
  return {
    _id: String(chap.id),
    seriesId: resolvedSeriesId,
    chapterNumber: chap.chapterNumber,
    title: chap.name || `Chapter ${chap.chapterNumber}`,
    status: chap.isDownloaded ? 'downloaded' : 'ready',
    isRead: chap.isRead,
    isDownloaded: chap.isDownloaded,
    isBookmarked: chap.isBookmarked || false,
    uploadDate: chap.uploadDate,
    lastPageRead: chap.lastPageRead || 0,
    pages: [],
  };
}
