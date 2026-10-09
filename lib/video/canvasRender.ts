/**
 * Canvas2D frame renderer for the studio composition — draws exactly what the
 * video export encodes. Shared by the live preview (`VideoPreview`) and the
 * MP4 exporter (`exportVideo`), so what you see is what renders.
 *
 * Scene model comes from `buildVideoProps` (lib/video/project.ts): camera
 * keyframes in cleaned-image space, `segments`/`hideBoxes` cuts, camera FX,
 * visual FX overlays, transitions, bilingual subtitles.
 */
import { FPS, FRAME_SIZE, interpolateCamera } from './camera';
import { computeTimeline, hasTransitionIn, sceneIndexAtFrame } from './project';
import type { VideoScene, WebtoonVideoProps } from './project';
import { chunkAt, subtitleChunks } from './subtitles';
import { TRANSITION_FRAMES } from './camera';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Img = CanvasImageSource & { width: number; height: number };

/* ---------- deterministic per-frame randomness (replaces remotion `random`) ---------- */
function srand(seed: string): number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^= h >>> 16) >>> 0) / 4294967296;
}

const ease = (p: number) => p; // transitions use linear progress (linearTiming)

const FILTERS: Record<string, string> = {
  bloom: 'brightness(1.08) saturate(1.25) contrast(1.05)',
  sepia: 'sepia(0.7) saturate(1.1) brightness(1.05)',
  'high-contrast': 'contrast(1.5) saturate(1.2) brightness(0.95)',
  noir: 'grayscale(1) contrast(1.6) brightness(0.9)',
  'color-wash-warm': 'sepia(0.25) saturate(1.3) brightness(1.05) hue-rotate(-10deg)',
  'color-wash-cool': 'saturate(0.9) brightness(1.0) hue-rotate(20deg)',
  'focus-blur': 'contrast(1.05) saturate(1.1)',
};

/* ---------- cleaned image drawing (segments + hide boxes) ---------- */
function drawCleanedImage(
  ctx: Ctx,
  img: Img,
  scene: VideoScene,
  left: number,
  top: number,
  imgW: number,
  imgH: number
) {
  const segments = scene.segments?.length
    ? scene.segments
    : [{ start: 0, end: 1, offset: 0 }];
  const kept = segments.reduce((s, seg) => s + seg.end - seg.start, 0) || 1;
  const iw = img.width || 1;
  const ih = img.height || 1;
  const filter = FILTERS[scene.visualFx] || 'none';
  const blurPx = Math.max(8, imgW * 0.015);

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, imgW, imgH);
  ctx.clip();

  for (const seg of segments) {
    const segH = seg.end - seg.start;
    const sy = seg.start * ih;
    const sh = segH * ih;
    const dy = top + (seg.offset / kept) * imgH;
    const dh = (segH / kept) * imgH;
    ctx.save();
    if (filter !== 'none') ctx.filter = filter;
    ctx.drawImage(img, 0, sy, iw, sh, left, dy, imgW, dh);
    ctx.restore();

    for (const b of scene.hideBoxes || []) {
      if (!(b.y < seg.end && b.y + b.height > seg.start)) continue;
      const bx = left + b.x * imgW;
      const bw = b.width * imgW;
      const by = dy + ((b.y - seg.start) / segH) * dh;
      const bh = (b.height / segH) * dh;
      if (b.mode === 'blur') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx, by, bw, bh);
        ctx.clip();
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(img, 0, sy, iw, sh, left, dy, imgW, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = b.mode === 'white' ? '#fff' : '#000';
        ctx.fillRect(bx, by, bw, bh);
      }
    }
  }
  ctx.restore();
}

/* ---------- visual FX overlays ---------- */
function drawVignette(ctx: Ctx, FW: number, FH: number) {
  const edge = 'rgba(0,0,0,0.78)';
  const g1 = ctx.createLinearGradient(0, 0, 0, FH * 0.28);
  g1.addColorStop(0, edge);
  g1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, FW, FH * 0.28);
  const g2 = ctx.createLinearGradient(0, FH, 0, FH * 0.72);
  g2.addColorStop(0, edge);
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, FH * 0.72, FW, FH * 0.28);
  const g3 = ctx.createLinearGradient(0, 0, FW * 0.22, 0);
  g3.addColorStop(0, edge);
  g3.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, FW * 0.22, FH);
  const g4 = ctx.createLinearGradient(FW, 0, FW * 0.78, 0);
  g4.addColorStop(0, edge);
  g4.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g4;
  ctx.fillRect(FW * 0.78, 0, FW * 0.22, FH);
}

function drawSpeedLines(ctx: Ctx, frame: number, FW: number, FH: number) {
  const rot = (frame * 0.6 * Math.PI) / 180;
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#fff';
  for (let i = 0; i < 48; i++) {
    const a = (i * 7.5 * Math.PI) / 180 + rot;
    const inner = 34 + (i % 3) * 4;
    // svg 0..100 space → frame space
    const x1 = ((50 + Math.cos(a) * inner) / 100) * FW;
    const y1 = ((50 + Math.sin(a) * inner) / 100) * FH;
    const x2 = ((50 + Math.cos(a) * 90) / 100) * FW;
    const y2 = ((50 + Math.sin(a) * 90) / 100) * FH;
    ctx.lineWidth = i % 2 === 0 ? FW * 0.0016 : FW * 0.0008;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrain(ctx: Ctx, frame: number, FW: number, FH: number) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  const n = Math.round((FW * FH) / 800);
  for (let i = 0; i < n; i++) {
    const x = srand(`gx${frame}-${i}`) * FW;
    const y = srand(`gy${frame}-${i}`) * FH;
    const v = Math.floor(srand(`gv${frame}-${i}`) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();
}

function drawRain(ctx: Ctx, frame: number, FW: number, FH: number) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = 'rgba(180,200,255,0.7)';
  for (let i = 0; i < 80; i++) {
    const x = (((i * 37 + 13) % 100) / 100) * FW;
    const speed = 4 + (i % 5) * 1.5;
    const y = ((frame * speed + i * 41) % (FH + 60)) - 30;
    const len = 12 + (i % 4) * 6;
    ctx.lineWidth = 0.8 + (i % 3) * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx: Ctx, frame: number, FW: number, FH: number) {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 30; i++) {
    const baseX = (((i * 53 + 17) % 100) / 100) * FW;
    const phase = i * 0.8;
    const x = baseX + Math.sin((frame * 0.02 + phase) * Math.PI) * 20;
    const y = FH + 20 - ((frame * (0.3 + (i % 5) * 0.15) + i * 47) % (FH + 40));
    const r = 1.5 + (i % 4) * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

let mangaPattern: CanvasPattern | null = null;
function drawMangaTone(ctx: Ctx, FW: number, FH: number) {
  if (!mangaPattern) {
    const c = document.createElement('canvas');
    c.width = c.height = 6;
    const cctx = c.getContext('2d')!;
    cctx.fillStyle = '#000';
    cctx.beginPath();
    cctx.arc(3, 3, 1.2, 0, Math.PI * 2);
    cctx.fill();
    mangaPattern = cctx.createPattern(c, 'repeat');
  }
  if (!mangaPattern) return;
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = mangaPattern;
  ctx.fillRect(0, 0, FW, FH);
  ctx.restore();
}

function drawEdgeFade(ctx: Ctx, FW: number, FH: number) {
  const top = ctx.createLinearGradient(0, 0, 0, FH * 0.15);
  top.addColorStop(0, 'rgba(0,0,0,0.3)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, FW, FH * 0.15);
  const bot = ctx.createLinearGradient(0, FH, 0, FH * 0.85);
  bot.addColorStop(0, 'rgba(0,0,0,0.3)');
  bot.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, FH * 0.85, FW, FH * 0.15);
  const l = ctx.createLinearGradient(0, 0, FW * 0.08, 0);
  l.addColorStop(0, 'rgba(0,0,0,0.25)');
  l.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, FW * 0.08, FH);
  const r = ctx.createLinearGradient(FW, 0, FW * 0.92, 0);
  r.addColorStop(0, 'rgba(0,0,0,0.25)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r;
  ctx.fillRect(FW * 0.92, 0, FW * 0.08, FH);
}

/* ---------- subtitles ---------- */
function wrapLines(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawSubtitles(ctx: Ctx, scene: VideoScene, progress: number, FW: number, FH: number) {
  const en = chunkAt(subtitleChunks(scene.narration), progress);
  const hi = chunkAt(subtitleChunks(scene.narrationHi), progress);
  if (!en && !hi) return;

  const size = Math.round(Math.min(FW, FH) * 0.036);
  const hiSize = Math.round(size * 0.95);
  const fontFamily = 'Arial, "Nirmala UI", "Noto Sans Devanagari", Mangal, sans-serif';
  const maxW = FW * 0.86;
  const padY = Math.round(FH * 0.012);
  const padX = Math.round(FW * 0.022);
  const lineH = size * 1.35;

  ctx.font = `700 ${size}px ${fontFamily}`;
  const enLines = en ? wrapLines(ctx, en, maxW) : [];
  ctx.font = `700 ${hiSize}px ${fontFamily}`;
  const hiLines = hi ? wrapLines(ctx, hi, maxW) : [];
  const allLines = [
    ...enLines.map((t) => ({ t, size })),
    ...hiLines.map((t) => ({ t, size: hiSize })),
  ];
  if (!allLines.length) return;

  let boxW = 0;
  for (const l of allLines) {
    ctx.font = `700 ${l.size}px ${fontFamily}`;
    boxW = Math.max(boxW, ctx.measureText(l.t).width);
  }
  boxW += padX * 2;
  const boxH = allLines.length * lineH + padY * 2;
  const boxX = (FW - boxW) / 2;
  const boxY = FH - FH * 0.06 - boxH;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 16);
  ctx.fill();

  let y = boxY + padY + lineH * 0.8;
  ctx.textAlign = 'center';
  allLines.forEach((l, i) => {
    ctx.font = `700 ${l.size}px ${fontFamily}`;
    ctx.fillStyle = i < enLines.length ? '#ffffff' : '#ffd166';
    ctx.fillText(l.t, FW / 2, y);
    y += lineH;
  });
  ctx.restore();
}

/* ---------- one scene's full frame (image + fx + subtitles) ---------- */
export function drawSceneFrame(
  ctx: Ctx,
  scene: VideoScene,
  localFrame: number,
  FW: number,
  FH: number,
  images: Map<string, Img>,
  showSubtitles: boolean
) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, FW, FH);

  const img = images.get(scene.src);
  const progress = scene.durationInFrames > 1 ? localFrame / (scene.durationInFrames - 1) : 0;
  const k = interpolateCamera(scene.camera, Math.min(1, Math.max(0, progress)));

  let zoom = k.zoom;
  let dx = 0;
  let dy = 0;
  const t = localFrame / FPS;
  if (scene.cameraFx === 'pulse') zoom *= 1 + 0.025 * Math.sin(t * Math.PI * 1.6);
  if (scene.cameraFx === 'shake') {
    const amp = Math.min(FW, FH) * 0.008;
    dx = (srand(`${scene.id}-x-${localFrame}`) - 0.5) * 2 * amp;
    dy = (srand(`${scene.id}-y-${localFrame}`) - 0.5) * 2 * amp;
  }
  if (scene.cameraFx === 'float') {
    const amp = Math.min(FW, FH) * 0.004;
    dx = Math.sin(t * 0.7) * amp;
    dy = Math.cos(t * 0.5) * amp * 0.6;
  }
  if (scene.cameraFx === 'heartbeat') {
    const beat = (t * 1.2) % 1;
    const pulse =
      beat < 0.15
        ? Math.sin((beat / 0.15) * Math.PI) * 0.04
        : beat < 0.35
          ? Math.sin(((beat - 0.2) / 0.15) * Math.PI) * 0.025
          : 0;
    zoom *= 1 + pulse;
  }
  if (scene.cameraFx === 'zoom-pulse') zoom *= 1 + 0.035 * Math.sin(t * Math.PI * 1.2);
  if (scene.cameraFx === 'breathe') {
    zoom *= 1 + 0.018 * Math.sin(t * Math.PI * 0.6);
    dy += Math.sin(t * Math.PI * 0.6) * Math.min(FW, FH) * 0.002;
  }

  const imgW = zoom * FW;
  const imgH = (imgW * scene.imageHeight) / scene.imageWidth;
  const left = FW / 2 - k.cx * imgW + dx;
  const top = FH / 2 - k.cy * imgH + dy;
  const coversFrame = left <= 0.5 && top <= 0.5 && left + imgW >= FW - 0.5 && top + imgH >= FH - 0.5;

  if (img) {
    // Blurred cover backdrop when the framed image doesn't fill the screen
    if (!coversFrame) {
      ctx.save();
      ctx.filter = 'blur(48px) brightness(0.38)';
      const scale = Math.max(FW / (img.width || 1), FH / (img.height || 1)) * 1.2;
      const bw = (img.width || 1) * scale;
      const bh = (img.height || 1) * scale;
      ctx.drawImage(img, (FW - bw) / 2, (FH - bh) / 2, bw, bh);
      ctx.restore();
    }
    drawCleanedImage(ctx, img, scene, left, top, imgW, imgH);
  }

  // overlays
  switch (scene.visualFx) {
    case 'vignette': drawVignette(ctx, FW, FH); break;
    case 'speed-lines': drawSpeedLines(ctx, localFrame, FW, FH); break;
    case 'bloom':
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 0, FW, FH);
      break;
    case 'flash': {
      const a = Math.max(0, 0.95 - (localFrame / 10) * 0.95);
      if (a > 0) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(0, 0, FW, FH);
      }
      break;
    }
    case 'letterbox': {
      const bh = Math.round(FH * 0.1);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, FW, bh);
      ctx.fillRect(0, FH - bh, FW, bh);
      break;
    }
    case 'film-grain': drawGrain(ctx, localFrame, FW, FH); break;
    case 'rain': drawRain(ctx, localFrame, FW, FH); break;
    case 'particles': drawParticles(ctx, localFrame, FW, FH); break;
    case 'manga-tone': drawMangaTone(ctx, FW, FH); break;
    case 'color-wash-warm':
      ctx.fillStyle = 'rgba(255,140,50,0.08)';
      ctx.fillRect(0, 0, FW, FH);
      break;
    case 'color-wash-cool':
      ctx.fillStyle = 'rgba(50,100,255,0.08)';
      ctx.fillRect(0, 0, FW, FH);
      break;
    case 'focus-blur': drawEdgeFade(ctx, FW, FH); break;
  }

  if (showSubtitles) drawSubtitles(ctx, scene, progress, FW, FH);
}

/* ---------- transitions: composite two scene frames ---------- */
function compositeTransition(
  ctx: Ctx,
  type: string,
  outC: Img,
  inC: Img,
  p: number,
  FW: number,
  FH: number
) {
  const e = ease(p);
  ctx.save();
  switch (type) {
    case 'slide':
      ctx.drawImage(outC, 0, 0);
      ctx.drawImage(inC, (1 - e) * FW, 0);
      break;
    case 'wipe':
      ctx.drawImage(outC, 0, 0);
      ctx.beginPath();
      ctx.rect(FW * (1 - e), 0, FW * e, FH);
      ctx.clip();
      ctx.drawImage(inC, 0, 0);
      break;
    case 'push-cut':
      ctx.drawImage(outC, -e * FW, 0);
      ctx.drawImage(inC, (1 - e) * FW, 0);
      break;
    case 'blur-slide':
      ctx.drawImage(outC, 0, 0);
      ctx.filter = `blur(${(1 - e) * 14}px)`;
      ctx.drawImage(inC, (1 - e) * FW, 0);
      break;
    case 'linear-blur':
      ctx.globalAlpha = 1 - e;
      ctx.filter = `blur(${e * 16}px)`;
      ctx.drawImage(outC, 0, 0);
      ctx.globalAlpha = e;
      ctx.filter = `blur(${(1 - e) * 16}px)`;
      ctx.drawImage(inC, 0, 0);
      break;
    case 'cross-zoom':
      ctx.save();
      ctx.globalAlpha = 1 - e;
      ctx.translate(FW / 2, FH / 2);
      ctx.scale(1 + e * 0.35, 1 + e * 0.35);
      ctx.drawImage(outC, -FW / 2, -FH / 2);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(FW / 2, FH / 2);
      const z = 1.45 - e * 0.45;
      ctx.scale(z, z);
      ctx.drawImage(inC, -FW / 2, -FH / 2);
      ctx.restore();
      break;
    case 'zoom-in-out':
      ctx.save();
      ctx.globalAlpha = 1 - e;
      ctx.translate(FW / 2, FH / 2);
      ctx.scale(1 + e * 0.5, 1 + e * 0.5);
      ctx.drawImage(outC, -FW / 2, -FH / 2);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(FW / 2, FH / 2);
      const zi = 0.6 + e * 0.4;
      ctx.scale(zi, zi);
      ctx.drawImage(inC, -FW / 2, -FH / 2);
      ctx.restore();
      break;
    case 'iris': {
      ctx.drawImage(outC, 0, 0);
      const r = e * Math.hypot(FW, FH) * 0.55;
      ctx.beginPath();
      ctx.arc(FW / 2, FH / 2, Math.max(0.01, r), 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(inC, 0, 0);
      break;
    }
    case 'flip': {
      if (e < 0.5) {
        const s = Math.cos(e * Math.PI);
        ctx.translate(FW / 2, 0);
        ctx.scale(Math.max(0.01, s), 1);
        ctx.drawImage(outC, -FW / 2, 0);
      } else {
        ctx.drawImage(outC, 0, 0);
        const s = Math.sin((e - 0.5) * Math.PI);
        ctx.translate(FW / 2, 0);
        ctx.scale(Math.max(0.01, s), 1);
        ctx.drawImage(inC, -FW / 2, 0);
      }
      break;
    }
    case 'dissolve':
    case 'fade':
    default:
      ctx.drawImage(outC, 0, 0);
      ctx.globalAlpha = e;
      ctx.drawImage(inC, 0, 0);
      break;
  }
  ctx.restore();
}

/* ---------- whole composition frame ---------- */
export interface FrameRenderCtx {
  /** Two reusable offscreen buffers for transition compositing. */
  bufA?: HTMLCanvasElement | OffscreenCanvas;
  bufB?: HTMLCanvasElement | OffscreenCanvas;
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function drawCompositionFrame(
  ctx: Ctx,
  props: WebtoonVideoProps,
  frame: number,
  images: Map<string, Img>,
  scratch?: FrameRenderCtx
) {
  const { width: FW, height: FH } = FRAME_SIZE[props.aspect];
  const scenes = props.scenes;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, FW, FH);
  if (!scenes.length) return;

  const { starts } = computeTimeline(scenes);
  const idx = sceneIndexAtFrame(scenes, starts, frame);
  if (idx < 0) {
    drawSceneFrame(ctx, scenes[scenes.length - 1], scenes[scenes.length - 1].durationInFrames - 1, FW, FH, images, props.showSubtitles);
    return;
  }
  const scene = scenes[idx];
  const local = frame - starts[idx];

  // Transition overlap: this scene just started while the previous is still on
  if (hasTransitionIn(scenes, idx) && local < TRANSITION_FRAMES && idx > 0) {
    const prev = scenes[idx - 1];
    const prevLocal = frame - starts[idx - 1];
    scratch = scratch || {};
    if (!scratch.bufA || !scratch.bufB) {
      scratch.bufA = makeCanvas(FW, FH);
      scratch.bufB = makeCanvas(FW, FH);
    }
    const aCtx = scratch.bufA.getContext('2d')!;
    const bCtx = scratch.bufB.getContext('2d')!;
    drawSceneFrame(aCtx, prev, prevLocal, FW, FH, images, props.showSubtitles);
    drawSceneFrame(bCtx, scene, local, FW, FH, images, props.showSubtitles);
    compositeTransition(ctx, scene.transition, scratch.bufA as Img, scratch.bufB as Img, ease(local / TRANSITION_FRAMES), FW, FH);
    return;
  }

  drawSceneFrame(ctx, scene, local, FW, FH, images, props.showSubtitles);
}
