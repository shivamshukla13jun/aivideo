# Webtoon Studio & Reader

A production-ready Webtoon Reader, Scene Editor, and Video Studio built with Next.js App Router, TypeScript, Redux Toolkit, Mongoose, and MinIO object storage.

## Features

- **No Authentication**: Designed as a personal, local webtoon management studio without login or signup hurdles.
- **Series & Chapter Management**: Create and manage webtoons, upload CBZ files with extraction and progress tracking.
- **Webtoon Video Editor (Remotion)**: Pages are added in reading order as webtoon scenes that scroll like the reader. Each scene has a START/END camera (which part of the page is visible and how zoomed), easing, camera/visual FX, transitions, narration, and voiceover. Scenes can be split at the playhead. Preview uses `@remotion/player`; export renders an MP4 in the browser with `@remotion/web-renderer` (16:9 or 9:16).
- **Full Video Studio**: Professional timeline, scene tracks, audio tracks, Ken Burns effects, transitions, and persistent MongoDB autosave.
- **YouTube Publisher**: Render the studio timeline to a video file in-browser, auto-generate SEO metadata (Gemini), and publish to multiple connected YouTube channels with share links.
- **Monetization Tracker**: Connect YouTube channels via OAuth, sync real channel stats (subscribers, watch hours, Shorts views, recent uploads), and track progress toward YouTube Partner Program tiers with custom goals and deadlines.
- **Webtoon Reader**: Vertical continuous scroll and single page modes with zoom and reading progress tracking.

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure your credentials:

```env
MONGODB_URI=your_mongodb_connection_string

# MinIO object storage — all files (CBZ archives, page images, audio, covers)
# are uploaded here via multer and served through /api/files/<key>.
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=webtoon
NEXT_PUBLIC_APP_URL=http://localhost:3000

# YouTube publishing (optional) — Google Cloud OAuth client with
# YouTube Data API v3 + YouTube Analytics API enabled.
# Redirect URI to register: {APP_URL}/api/youtube/auth/callback
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## Development & Production Commands

- **Install Dependencies**: `npm install`
- **Run Development Server**: `npm run dev`
- **Production Build**: `npm run build`
- **Start Production Server**: `npm start`
- **Lint Code**: `npm run lint`
