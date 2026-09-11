import axios from 'axios';

export interface AnimeManga {
  id: number;
  title: string;
  thumbnailUrl?: string;
  status?: string;
  genre?: string[];
  artist?: string;
  author?: string;
  description?: string;
  unreadCount?: number;
  chapters?: { totalCount: number };
}

export interface AnimeChapter {
  id: number;
  name: string;
  chapterNumber: number;
  pageCount?: number;
  isRead?: boolean;
  isDownloaded?: boolean;
}

const GRAPHQL_URL = 'https://suwayomi-server-stable-ky1i.onrender.com/graphql';

const GET_LIBRARY_MANGAS = `
  query GET_LIBRARY_MANGAS {
    mangas(condition: { inLibrary: true }, first: 100) {
      nodes {
        id
        title
        thumbnailUrl
        status
        genre
        artist
        author
        description
        unreadCount
        chapters {
          totalCount
        }
      }
      totalCount
    }
  }
`;

const GET_CHAPTERS = `
  query GET_CHAPTERS($mangaId: Int!) {
    chapters(condition: { mangaId: $mangaId }, first: 500) {
      nodes {
        id
        name
        chapterNumber
        pageCount
        isRead
        isDownloaded
      }
      totalCount
    }
  }
`;

const FETCH_CHAPTER_PAGES = `
  mutation FETCH_CHAPTER_PAGES($input: FetchChapterPagesInput!) {
    fetchChapterPages(input: $input) {
      chapter {
        id
        pageCount
      }
      pages
    }
  }
`;

export const animeLibraryService = {
  /**
   * Check if Suwayomi server is reachable
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await axios.post(
        GRAPHQL_URL,
        { query: 'query { mangas(first: 1) { totalCount } }' },
        { timeout: 4000 }
      );
      return !response.data.errors;
    } catch {
      return false;
    }
  },

  /**
   * Get all anime/manga in the user's library
   */
  async getLibrary(): Promise<AnimeManga[]> {
    try {
      const response = await axios.post(GRAPHQL_URL, {
        query: GET_LIBRARY_MANGAS,
      });

      if (response.data?.data?.mangas?.nodes) {
        return response.data.data.mangas.nodes.map((m: any) => ({
          ...m,
          thumbnailUrl: m.thumbnailUrl ? `/suwayomi${m.thumbnailUrl}` : undefined,
        }));
      }
      return [];
    } catch (error) {
      console.error('[AnimeLibrary] Failed to fetch library', error);
      throw error;
    }
  },

  /**
   * Get chapter list for a specific anime/manga
   */
  async getChapters(mangaId: number): Promise<AnimeChapter[]> {
    try {
      const response = await axios.post(GRAPHQL_URL, {
        query: GET_CHAPTERS,
        variables: { mangaId: Number(mangaId) },
      });

      if (response.data?.data?.chapters?.nodes) {
        // Sort chapters by chapter number ascending or descending
        const nodes: AnimeChapter[] = response.data.data.chapters.nodes;
        return nodes.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
      }
      return [];
    } catch (error) {
      console.error('[AnimeLibrary] Failed to fetch chapters', error);
      throw error;
    }
  },

  /**
   * Fetch chapter pages/panels URLs
   */
  async getChapterPages(chapterId: number): Promise<string[]> {
    try {
      const response = await axios.post(GRAPHQL_URL, {
        query: FETCH_CHAPTER_PAGES,
        variables: { input: { chapterId: Number(chapterId) } },
      });

      const pages: string[] = response.data?.data?.fetchChapterPages?.pages || [];
      // Map page relative paths to proxied URLs
      return pages.map((pagePath) => {
        if (pagePath.startsWith('/suwayomi')) return pagePath;
        return `/suwayomi${pagePath}`;
      });
    } catch (error) {
      console.error('[AnimeLibrary] Failed to fetch chapter pages', error);
      throw error;
    }
  },
};
