# Project notes

- Dev server: `npm run dev` (port 5000). Next.js 15 App Router, Mongoose, Tailwind.
- Content source: user uploads — series created via `POST /api/series` (multipart), chapters via `POST /api/chapters` (multipart `.cbz`, multer in `lib/upload.ts`). NO Suwayomi anymore.
- Storage: MinIO (`lib/minio.ts`). `uploadFile()` stores buffers, `fileUrl(key)` → `/api/files/<key>` (same-origin stream route — keeps canvas untainted). `lib/cbz.ts` extracts page images with jszip and uploads archive+pages to `chapters/<id>/`.
- `Page.publicId` holds the MinIO object key; `originalUrl`/`editedUrl` hold `/api/files/...` URLs. OCR reads buffers straight from MinIO.
- Scene audio shape: `{ url, objectKey, duration, format, fileSize }` (`cloudinaryUrl`/`publicId` remain for legacy docs).
- Typecheck: `npx tsc --noEmit -p .` (ignore stale errors under `.next/types` for deleted routes).
- Lint: `npx eslint <files>` (`<img>` warnings are expected project-wide).
- Video: Remotion (`remotion`, `@remotion/player`, `@remotion/web-renderer`, `@remotion/media`, `@remotion/transitions`, pinned 4.0.526).
  - Composition: `components/video/WebtoonVideo.tsx`; camera math shared by preview/editor/export in `lib/video/camera.ts`; scene → props in `lib/video/project.ts`.
  - Scene clean-up (`lib/video/cleanup.ts`): `cuts` (full-width bands removed, content closes up) and `hideBoxes` (blur/black/white), in fractions of the ORIGINAL image. Camera coordinates are in the cleaned image space (`effectiveImageHeight`). `components/video/CleanedImage.tsx` renders the cleaned image for both the composition and the editor.
  - Subtitles: English (`narration`) + Hindi (`narrationHi`) stacked, chunked & timed by `lib/video/subtitles.ts`.
- OCR (`lib/ocr.ts`): providers `tesseract` (default, offline, sharp preprocessing + tiling + bubble grouping), `gemini` (`GEMINI_API_KEY`, also writes Hindi), `google-vision` (`GOOGLE_VISION_API_KEY`/`GOOGLE_CLOUD_API_KEY`). Hindi for non-Gemini providers comes from `translateText()` (Gemini or Google Translate); empty if no key. Jobs store `provider` + `overwriteScenes` (re-extract). Pages store `extractedText` (EN), `extractedTextHi`, `ocrRaw`, `ocrProvider`.
  - Remote images must go through `/api/proxy-image` (`toVideoSrc`) so the browser renderer can draw them to canvas.
  - Client-side rendering only supports a subset of CSS (no mix-blend-mode, backdrop-filter, radial gradients, inset shadows, z-index).
