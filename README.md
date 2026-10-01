# Webtoon Studio & Reader

A production-ready Webtoon Reader, CBZ Panel Editor, Scene Editor, and Video Studio built with Next.js App Router, TypeScript, Redux Toolkit, Mongoose, and Cloudinary.

## Features

- **No Authentication**: Designed as a personal, local webtoon management studio without login or signup hurdles.
- **Series & Chapter Management**: Create and manage webtoons, upload CBZ files with extraction and progress tracking.
- **CBZ Panel & Page Editor**: Mobile gallery-style cropper, multi-panel crop, split page, reorder pages, and generate edited CBZ archives stored in Cloudinary.
- **Scene Editor & Audio**: Turn pages/panels into scenes with narration, dialogue, and audio uploads.
- **Full Video Studio**: Professional timeline, scene tracks, audio tracks, Ken Burns effects, transitions, and persistent MongoDB autosave.
- **YouTube Publisher**: Render the studio timeline to a video file in-browser, auto-generate SEO metadata (Gemini), and publish to multiple connected YouTube channels with share links.
- **Monetization Tracker**: Connect YouTube channels via OAuth, sync real channel stats (subscribers, watch hours, Shorts views, recent uploads), and track progress toward YouTube Partner Program tiers with custom goals and deadlines.
- **Webtoon Reader**: Vertical continuous scroll and single page modes with zoom and reading progress tracking.

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure your credentials:

```env
MONGODB_URI=your_mongodb_connection_string
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# YouTube publishing (optional) — Google Cloud OAuth client with
# YouTube Data API v3 + YouTube Analytics API enabled.
# Redirect URI to register: {APP_URL}/api/youtube/auth/callback
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GEMINI_API_KEY=your_gemini_api_key   # used for AI SEO generation
```

---

## Development & Production Commands

- **Install Dependencies**: `npm install`
- **Run Development Server**: `npm run dev`
- **Production Build**: `npm run build`
- **Start Production Server**: `npm start`
- **Lint Code**: `npm run lint`
