/**
 * MP4 export — renders the composition frame-by-frame on a canvas and encodes
 * with WebCodecs via mediabunny. Scene audio is mixed into one AAC track.
 * Fully client-side, no license/watermark.
 */
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
} from 'mediabunny';
import { FPS, FRAME_SIZE } from './camera';
import { computeTimeline } from './project';
import type { VideoScene, WebtoonVideoProps } from './project';
import { drawCompositionFrame, makeCanvas } from './canvasRender';

export type RenderProgress = { frame: number; total: number };

/** Load a scene image once; used by both preview and export. */
export function loadSceneImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src.slice(0, 80)}`));
    img.src = src;
  });
}

export async function preloadSceneImages(scenes: VideoScene[]) {
  const map = new Map<string, HTMLImageElement>();
  await Promise.all(
    scenes.map(async (s) => {
      if (!map.has(s.src)) map.set(s.src, await loadSceneImage(s.src));
    })
  );
  return map;
}

/** Decode + mix every scene's narration audio into one AudioBuffer at the right offsets. */
async function mixAudio(scenes: VideoScene[], starts: number[], totalSec: number): Promise<AudioBuffer | null> {
  const withAudio = scenes
    .map((s, i) => ({ url: s.audioUrl, offsetSec: starts[i] / FPS, durSec: s.durationInFrames / FPS }))
    .filter((x): x is { url: string; offsetSec: number; durSec: number } => Boolean(x.url));
  if (!withAudio.length) return null;

  const sr = 44100;
  const off = new OfflineAudioContext(2, Math.max(1, Math.ceil(totalSec * sr)), sr);
  await Promise.all(
    withAudio.map(async ({ url, offsetSec }) => {
      try {
        const buf = await fetch(url).then((r) => r.arrayBuffer());
        const audio = await off.decodeAudioData(buf);
        const src = off.createBufferSource();
        src.buffer = audio;
        src.connect(off.destination);
        src.start(offsetSec);
      } catch {
        // skip undecodable audio — the track still renders
      }
    })
  );
  return off.startRendering();
}

export async function renderVideoToBlob(
  props: WebtoonVideoProps,
  onProgress?: (p: RenderProgress) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const { width: FW, height: FH } = FRAME_SIZE[props.aspect];
  const { durationInFrames } = computeTimeline(props.scenes);
  const totalSec = durationInFrames / FPS;

  const images = await preloadSceneImages(props.scenes);
  const audioBuffer = await mixAudio(props.scenes, computeTimeline(props.scenes).starts, totalSec);

  const canvas = makeCanvas(FW, FH);
  const ctx = canvas.getContext('2d')!;

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: 10_000_000 });
  output.addVideoTrack(videoSource);
  const audioSource = audioBuffer
    ? new AudioBufferSource({ codec: 'aac', bitrate: 192_000 })
    : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const scratch = {};
  for (let f = 0; f < durationInFrames; f++) {
    if (signal?.aborted) {
      await output.cancel().catch(() => {});
      throw new Error('Render aborted');
    }
    drawCompositionFrame(ctx, props, f, images as any, scratch);
    await videoSource.add(f / FPS, 1 / FPS);
    onProgress?.({ frame: f + 1, total: durationInFrames });
  }
  videoSource.close?.();
  if (audioSource && audioBuffer) await audioSource.add(audioBuffer);
  audioSource?.close?.();
  await output.finalize();

  if (!target.buffer) throw new Error('Encode produced no output');
  return new Blob([target.buffer], { type: 'video/mp4' });
}
