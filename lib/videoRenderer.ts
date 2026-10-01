'use client';

export interface RenderSceneInput {
  image: string;
  duration: number; // seconds
  effects?: string;
  visualEffect?: string;
  transition?: string;
  audioUrl?: string | null;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (percent: number, label: string) => void;
  shouldCancel?: () => boolean;
}

function proxied(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  // Try CORS-enabled direct load first, fall back to same-origin proxy.
  for (const candidate of [src, proxied(src)]) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('image load failed'));
        el.src = candidate;
      });
      return img;
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Failed to load image: ${src.slice(0, 80)}`);
}

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

/** Cover-fit the image into the canvas, applying camera transforms. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  effect: string,
  p: number,
  alpha: number,
  slideOffset: number
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const baseScale = Math.max(w / iw, h / ih);
  let scale = baseScale;
  let tx = 0;
  let ty = 0;

  switch (effect) {
    case 'ken-burns':
      scale = baseScale * (1 + 0.18 * p);
      tx = -0.03 * p * w;
      ty = -0.025 * p * h;
      break;
    case 'vertical-pan':
      scale = baseScale * 1.05;
      ty = -0.28 * p * h;
      break;
    case 'zoom-in':
      scale = baseScale * (1 + 0.25 * p);
      break;
    case 'shake':
      tx = (Math.random() - 0.5) * 14;
      ty = (Math.random() - 0.5) * 14;
      break;
    case 'pulse':
      scale = baseScale * (1 + 0.04 * Math.sin(p * Math.PI * 2 * 3));
      break;
    default:
      break;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(w / 2 + tx + slideOffset, h / 2 + ty);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
}

/**
 * Renders the scene sequence to a video blob entirely in the browser:
 * draws frames on a canvas (same effects as the live preview), mixes scene
 * audio through Web Audio, and records via MediaRecorder.
 * Rendering happens in real time (a 60s video takes ~60s to render).
 */
export async function renderVideoToBlob(
  scenes: RenderSceneInput[],
  opts: RenderOptions = {}
): Promise<Blob> {
  const width = opts.width || 1280;
  const height = opts.height || 720;
  const fps = opts.fps || 30;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported in this browser');

  const canvasStream = canvas.captureStream(fps);

  // Audio pipeline
  const hasAudio = scenes.some((s) => s.audioUrl);
  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  if (hasAudio) {
    audioCtx = new AudioContext();
    audioDest = audioCtx.createMediaStreamDestination();
  }

  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (audioDest) tracks.push(...audioDest.stream.getAudioTracks());
  const combined = new MediaStream(tracks);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const type = mimeType.split(';')[0] || 'video/webm';
      resolve(new Blob(chunks, { type }));
    };
  });

  recorder.start(500);

  const FADE_MS = 400;
  const totalMs = scenes.reduce((s, sc) => s + Math.max(1, sc.duration || 5) * 1000, 0);
  const startTime = performance.now();
  let elapsedSceneStart = 0;

  try {
    let prevImg: HTMLImageElement | null = null;
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const label = `Rendering scene ${i + 1}/${scenes.length}`;
      const img = await loadImage(scene.image);

      // Start scene audio in sync
      if (audioCtx && audioDest && scene.audioUrl) {
        try {
          const res = await fetch(scene.audioUrl);
          const buf = await audioCtx.decodeAudioData(await res.arrayBuffer());
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(audioDest);
          src.start();
        } catch (e) {
          console.warn('Scene audio skipped:', e);
        }
      }

      const sceneMs = Math.max(1, scene.duration || 5) * 1000;
      const sceneStart = performance.now();
      const useTransition =
        prevImg && scene.transition && scene.transition !== 'none';

      // Frame loop (real-time)
      while (true) {
        if (opts.shouldCancel?.()) {
          recorder.stop();
          await done;
          throw new Error('cancelled');
        }
        const now = performance.now();
        const localMs = now - sceneStart;
        const p = Math.min(1, localMs / sceneMs);

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        let alpha = 1;
        let slideOffset = 0;
        if (useTransition && localMs < FADE_MS) {
          const t = localMs / FADE_MS;
          if (scene.transition === 'slide') {
            drawFrame(ctx, prevImg!, width, height, 'none', 1, 1, -t * width);
            slideOffset = (1 - t) * width;
          } else {
            // fade / dissolve crossfade
            drawFrame(ctx, prevImg!, width, height, 'none', 1, 1, 0);
            alpha = t;
          }
        }
        drawFrame(ctx, img, width, height, scene.effects || 'ken-burns', p, alpha, slideOffset);

        // Visual effect overlays
        if (scene.visualEffect === 'vignette') {
          const g = ctx.createRadialGradient(
            width / 2, height / 2, height / 3,
            width / 2, height / 2, height
          );
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, 'rgba(0,0,0,0.85)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
        } else if (scene.visualEffect === 'bloom') {
          ctx.fillStyle = 'rgba(99,102,241,0.15)';
          ctx.fillRect(0, 0, width, height);
        } else if (scene.visualEffect === 'flash' && localMs < 350) {
          ctx.fillStyle = `rgba(255,255,255,${1 - localMs / 350})`;
          ctx.fillRect(0, 0, width, height);
        }

        const totalElapsed = elapsedSceneStart + localMs;
        opts.onProgress?.(Math.min(99, Math.round((totalElapsed / totalMs) * 100)), label);

        if (localMs >= sceneMs) break;
        await new Promise((r) => setTimeout(r, Math.max(1, 1000 / fps - 4)));
      }

      elapsedSceneStart += sceneMs;
      prevImg = img;
    }
  } finally {
    opts.onProgress?.(100, 'Finalizing video…');
    if (recorder.state !== 'inactive') recorder.stop();
    if (audioCtx) audioCtx.close().catch(() => {});
  }

  const blob = await done;
  return blob;
}
