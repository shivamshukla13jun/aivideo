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
NEXT_PUBLIC_APP_URL=http://localhost:5000
```

---

## Development & Production Commands

- **Install Dependencies**: `npm install`
- **Run Development Server**: `npm run dev`
- **Production Build**: `npm run build`
- **Start Production Server**: `npm start`
- **Lint Code**: `npm run lint`

---

## Docker — all-in-one web service (one domain, one port)

`Dockerfile` builds a single image that runs **both** the Next.js app and
Suwayomi-Server in one container (JRE + jar copied from the official
`ghcr.io/suwayomi/suwayomi-server:stable` image). Deployable to any single
web service (Render, Railway, a VPS, etc.).

Everything shares the same domain/port (default `5000`, honors `PORT`):

- `http://localhost:5000/` — the web app
- `http://localhost:5000/suwayomi` — Suwayomi WebUI (extensions, sources)
- `http://localhost:5000/suwayomi/api/graphql` — GraphQL
- `http://localhost:5000/suwayomi/api/v1/*` — thumbnails, pages, REST

Internally Suwayomi runs with `webUISubpath=/suwayomi` on port 4567 and the
Next.js server proxies `/suwayomi/*` to it. Suwayomi data persists in the
`suwayomi_data` volume mounted at `/home/suwayomi/.local/share/Tachidesk`
— on Render/Railway attach a persistent disk at that path.

```bash
# Build + start (uses .env for MONGODB_URI, Cloudinary, Gemini keys)
npm run docker:up          # = docker compose up -d --build

# or plain docker:
docker build -t aivideo-app .
docker run -d -p 5000:5000 --env-file .env \
  -v suwayomi_data:/home/suwayomi/.local/share/Tachidesk \
  --name aivideo-app aivideo-app

npm run docker:logs        # tail logs
npm run docker:down        # stop
```

Notes:
- Port already taken? `APP_PORT=3001 docker compose up -d --build`
- Compose also publishes `4567` for direct Suwayomi access during local dev;
  comment it out for production.
- Small hosts (512MB): set `JAVA_OPTS=-Xmx384m` to cap the JVM heap.
