# Webtoon Studio & Reader

A production-ready Webtoon Reader, CBZ Panel Editor, Scene Editor, and Video Studio built with Next.js App Router, TypeScript, Redux Toolkit, Mongoose, and Cloudinary.

## Features

- **No Authentication**: Designed as a personal, local webtoon management studio without login or signup hurdles.
- **Series & Chapter Management**: Create and manage webtoons, upload CBZ files with extraction and progress tracking.
- **CBZ Panel & Page Editor**: Mobile gallery-style cropper, multi-panel crop, split page, reorder pages, and generate edited CBZ archives stored in Cloudinary.
- **Scene Editor & Audio**: Turn pages/panels into scenes with narration, dialogue, and audio uploads.
- **Full Video Studio**: Professional timeline, scene tracks, audio tracks, Ken Burns effects, transitions, and persistent MongoDB autosave.
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
```

---

## Development & Production Commands

- **Install Dependencies**: `npm install`
- **Run Development Server**: `npm run dev`
- **Production Build**: `npm run build`
- **Start Production Server**: `npm start`
- **Lint Code**: `npm run lint`
