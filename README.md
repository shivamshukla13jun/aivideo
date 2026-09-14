# Suwayomi-Server TypeScript + MongoDB

A complete TypeScript / Node.js conversion of [Suwayomi-Server](https://github.com/Suwayomi/Suwayomi-Server) with MongoDB database integration, modern React WebUI reader, multi-source manga catalog, reading history, and full REST API.

## Features

- **TypeScript Full-Stack Backend**: Built with Express, TypeScript (`tsx`), and ESM.
- **MongoDB Database**: Replaces SQLite/Exposed ORM with full MongoDB models (Manga, Chapter, Category, Source, History, Settings) + graceful in-memory fallback.
- **Suwayomi REST API Compatible**: Implements `/api/v1/source/*`, `/api/v1/manga/*`, `/api/v1/category/*`, `/api/v1/update/*`, and `/api/v1/history/*`.
- **Built-in Manga Sources**: MangaDex, MangaPark, MangaFox, and Local Manga.
- **Interactive Reader**:
  - Webtoon continuous scroll
  - Single page & Double page
  - Left-to-Right & Right-to-Left
  - Page jump slider & chapter navigation
  - Progress autosave to MongoDB
- **Manga Library Management**:
  - Custom categories (Reading, Plan to Read, Completed, Action)
  - Unread chapter badges
  - Search & sorting
- **Docker & Docker Compose**: 1-command startup with MongoDB container.

## Quick Start (Local Node.js)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment** (Optional):
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set `MONGODB_URI` (defaults to `mongodb://localhost:27017/suwayomi`).
   *(Note: The server automatically falls back to in-memory mode if MongoDB is not running).*

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Production Build & Start**:
   ```bash
   npm run build
   npm start
   ```

## Quick Start (Docker Compose)

Run both the TypeScript Suwayomi Server and MongoDB database with one command:

```bash
docker compose up -d
```
The server will be accessible at `http://localhost:3000`.

## REST API Summary

- `GET /api/v1/source/list` - List available manga sources
- `GET /api/v1/source/:sourceId/popular/:pageNum` - Get popular manga
- `GET /api/v1/source/:sourceId/search?query=...` - Search manga
- `GET /api/v1/manga/:mangaId` - Get manga details
- `GET /api/v1/manga/:mangaId/chapters` - Get chapters list
- `GET /api/v1/manga/:mangaId/library` - Add to library
- `DELETE /api/v1/manga/:mangaId/library` - Remove from library
- `POST /api/v1/chapter/:chapterId/progress` - Save reading progress
- `GET /api/v1/database/status` - Check MongoDB connection status
- `POST /api/v1/database/connect` - Connect or switch MongoDB URI
- `GET /api/v1/download/project-zip` - Download the complete project ZIP
