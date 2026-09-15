import express from 'express';
import swaggerUi from 'swagger-ui-express';

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Suwayomi Server Manga API',
    version: '1.0.0',
    description:
      'API documentation for Suwayomi TypeScript Manga Reader & Server. Supports live scraping from MangaFire, Asura Scans, chapter reading, library management, downloads, and MongoDB persistence.',
    contact: {
      name: 'Suwayomi Development Team',
      url: 'https://asuracomic.net',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment Server',
    },
  ],
  tags: [
    { name: 'Sources', description: 'Scrape and browse manga sources (MangaFire, Asura Scans, etc.)' },
    { name: 'Manga', description: 'Manga library management, search, and details' },
    { name: 'Chapters', description: 'Chapter listing, reading progress, and page scraping' },
    { name: 'Categories', description: 'Manage custom library categories' },
    { name: 'Downloads', description: 'Offline reading queue and download manager' },
    { name: 'History & Stats', description: 'User reading history and statistics' },
    { name: 'Backup', description: 'Export and import backup snapshots' },
    { name: 'Database & System', description: 'Database status and system utilities' },
  ],
  paths: {
    '/api/v1/source/list': {
      get: {
        tags: ['Sources'],
        summary: 'List available sources',
        responses: {
          200: {
            description: 'List of manga sources',
          },
        },
      },
    },
    '/api/v1/source/{sourceId}': {
      get: {
        tags: ['Sources'],
        summary: 'Get source details by ID',
        parameters: [
          { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' }, example: 'mangafire' },
        ],
        responses: {
          200: { description: 'Source object' },
          404: { description: 'Source not found' },
        },
      },
    },
    '/api/v1/source/{sourceId}/popular/{pageNum}': {
      get: {
        tags: ['Sources'],
        summary: 'Fetch popular manga catalog from source',
        parameters: [
          { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' }, example: 'asura' },
          { name: 'pageNum', in: 'path', required: false, schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: { description: 'Paginated manga catalog' },
        },
      },
    },
    '/api/v1/source/{sourceId}/latest/{pageNum}': {
      get: {
        tags: ['Sources'],
        summary: 'Fetch latest manga catalog from source',
        parameters: [
          { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' }, example: 'mangafire' },
          { name: 'pageNum', in: 'path', required: false, schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: { description: 'Paginated manga catalog' },
        },
      },
    },
    '/api/v1/source/{sourceId}/search': {
      get: {
        tags: ['Sources'],
        summary: 'Search manga catalog on specified source portal',
        parameters: [
          { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' }, example: 'asura' },
          { name: 'query', in: 'query', required: true, schema: { type: 'string' }, example: 'Solo Leveling' },
          { name: 'pageNum', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: { description: 'Search results catalog' },
        },
      },
    },
    '/api/v1/manga': {
      get: {
        tags: ['Manga'],
        summary: 'Get mangas list with optional filters',
        parameters: [
          { name: 'inLibrary', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'query', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'List of manga' },
        },
      },
    },
    '/api/v1/manga/{mangaId}': {
      get: {
        tags: ['Manga'],
        summary: 'Get single manga details',
        parameters: [
          { name: 'mangaId', in: 'path', required: true, schema: { type: 'integer' }, example: 100001 },
        ],
        responses: {
          200: { description: 'Manga details' },
          404: { description: 'Manga not found' },
        },
      },
      patch: {
        tags: ['Manga'],
        summary: 'Update manga fields',
        parameters: [
          { name: 'mangaId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  inLibrary: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated manga object' },
        },
      },
    },
    '/api/v1/manga/{mangaId}/full': {
      get: {
        tags: ['Manga'],
        summary: 'Get manga details with full chapter list',
        parameters: [
          { name: 'mangaId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Manga details with chapters' },
        },
      },
    },
    '/api/v1/manga/{mangaId}/chapters': {
      get: {
        tags: ['Manga'],
        summary: 'Fetch chapters for manga (from cache or live source)',
        parameters: [
          { name: 'mangaId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'refresh', in: 'query', required: false, schema: { type: 'boolean' } },
        ],
        responses: {
          200: { description: 'List of chapters' },
        },
      },
    },
    '/api/v1/manga/{mangaId}/library': {
      post: {
        tags: ['Manga'],
        summary: 'Toggle or update library state of a manga',
        parameters: [
          { name: 'mangaId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  inLibrary: { type: 'boolean' },
                  categoryIds: { type: 'array', items: { type: 'integer' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated library status' },
        },
      },
    },
    '/api/v1/chapter/{chapterId}': {
      get: {
        tags: ['Chapters'],
        summary: 'Get chapter metadata',
        parameters: [
          { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Chapter object' },
        },
      },
    },
    '/api/v1/chapter/{chapterId}/pages': {
      get: {
        tags: ['Chapters'],
        summary: 'Fetch image URLs for chapter reader pages',
        parameters: [
          { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'List of image URLs or proxy image endpoints' },
        },
      },
    },
    '/api/v1/chapter/{chapterId}/read': {
      post: {
        tags: ['Chapters'],
        summary: 'Update reading progress for chapter',
        parameters: [
          { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  read: { type: 'boolean' },
                  lastPageRead: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated chapter progress' },
        },
      },
    },
    '/api/v1/chapter/{chapterId}/bookmark': {
      post: {
        tags: ['Chapters'],
        summary: 'Toggle chapter bookmark status',
        parameters: [
          { name: 'chapterId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Updated bookmark status' },
        },
      },
    },
    '/api/v1/category': {
      get: {
        tags: ['Categories'],
        summary: 'Get all user library categories',
        responses: {
          200: { description: 'List of categories' },
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create a new category',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Favorites' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created category' },
        },
      },
    },
    '/api/v1/category/{categoryId}': {
      put: {
        tags: ['Categories'],
        summary: 'Update category name or order',
        parameters: [
          { name: 'categoryId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Updated category' },
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete category',
        parameters: [
          { name: 'categoryId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Deleted status' },
        },
      },
    },
    '/api/v1/download/queue': {
      get: {
        tags: ['Downloads'],
        summary: 'Get current download queue items',
        responses: {
          200: { description: 'Download queue items' },
        },
      },
    },
    '/api/v1/download/enqueue': {
      post: {
        tags: ['Downloads'],
        summary: 'Enqueue single chapter for offline download',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['chapterId'],
                properties: {
                  chapterId: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Enqueued item' },
        },
      },
    },
    '/api/v1/download/batch': {
      post: {
        tags: ['Downloads'],
        summary: 'Enqueue batch of chapters for download',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['chapterIds'],
                properties: {
                  chapterIds: { type: 'array', items: { type: 'integer' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Batch enqueued' },
        },
      },
    },
    '/api/v1/history': {
      get: {
        tags: ['History & Stats'],
        summary: 'Get recent chapter reading history',
        responses: {
          200: { description: 'History items' },
        },
      },
      delete: {
        tags: ['History & Stats'],
        summary: 'Clear reading history',
        responses: {
          200: { description: 'Cleared status' },
        },
      },
    },
    '/api/v1/stats': {
      get: {
        tags: ['History & Stats'],
        summary: 'Get user reading statistics',
        responses: {
          200: { description: 'Statistics object' },
        },
      },
    },
    '/api/v1/backup/export': {
      get: {
        tags: ['Backup'],
        summary: 'Export database backup as JSON',
        responses: {
          200: { description: 'JSON backup snapshot' },
        },
      },
    },
    '/api/v1/backup/import': {
      post: {
        tags: ['Backup'],
        summary: 'Import database backup JSON',
        responses: {
          200: { description: 'Import result summary' },
        },
      },
    },
    '/api/v1/database/status': {
      get: {
        tags: ['Database & System'],
        summary: 'Get current database connection status (MongoDB / In-Memory)',
        responses: {
          200: { description: 'Database status object' },
        },
      },
    },
    '/api/v1/database/reset': {
      post: {
        tags: ['Database & System'],
        summary: 'Reset database store to default initial state',
        responses: {
          200: { description: 'Reset confirmation' },
        },
      },
    },
    '/api/v1/proxy/image': {
      get: {
        tags: ['Database & System'],
        summary: 'Proxy image request to bypass hotlinking and CORS restrictions',
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'referer', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Image binary buffer' },
        },
      },
    },
  },
};

export const swaggerRouter = express.Router();

swaggerRouter.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
