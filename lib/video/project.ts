import {
  Aspect,
  Camera,
  FPS,
  TRANSITION_FRAMES,
  cameraFromLegacyEffect,
  clampKeyframe,
} from './camera';
import { HideBox, Segment, keptFraction, keptSegments, normalizeHideBoxes } from './cleanup';

export type SceneTransition = 'none' | 'fade' | 'slide' | 'wipe';
export type CameraFx = 'none' | 'shake' | 'pulse';
export type VisualFx = 'none' | 'vignette' | 'speed-lines' | 'bloom' | 'flash';

export interface VideoScene {
  id: string;
  src: string;
  imageWidth: number;
  /** Height after removed parts are cut out — the camera works in this space. */
  imageHeight: number;
  segments: Segment[];
  hideBoxes: HideBox[];
  durationInFrames: number;
  camera: Camera;
  cameraFx: CameraFx;
  visualFx: VisualFx;
  transition: SceneTransition;
  audioUrl: string | null;
  narration: string;
  narrationHi: string;
}

export interface WebtoonVideoProps {
  [key: string]: unknown;
  scenes: VideoScene[];
  aspect: Aspect;
  showSubtitles: boolean;
}

/** Remote images go through the same-origin proxy so they can be drawn to a canvas on export. */
export function toVideoSrc(url: string): string {
  return /^https?:\/\//i.test(url) ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url;
}

export function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(`Failed to load ${url.slice(0, 80)}`));
    img.src = url;
  });
}

const TRANSITIONS: SceneTransition[] = ['none', 'fade', 'slide', 'wipe'];
const CAMERA_FX: CameraFx[] = ['none', 'shake', 'pulse'];
const VISUAL_FX: VisualFx[] = ['none', 'vignette', 'speed-lines', 'bloom', 'flash'];

/** Image height once the scene's cut bands are removed. */
export const effectiveImageHeight = (scene: any) => (scene.imageHeight || 1) * keptFraction(scene.cuts);

/** Camera to use for a scene: its saved camera (kept inside the page) or one derived from legacy effects. */
export function sceneCamera(scene: any, aspect: Aspect): Camera {
  const iw = scene.imageWidth || 1;
  const ih = effectiveImageHeight(scene);
  const cam: Camera | undefined = scene.camera?.start && scene.camera?.end ? scene.camera : undefined;
  if (!cam) return cameraFromLegacyEffect(scene.effects, aspect, iw, ih);
  return {
    start: clampKeyframe(cam.start, aspect, iw, ih),
    end: clampKeyframe(cam.end, aspect, iw, ih),
    easing: cam.easing || 'linear',
  };
}

export function buildVideoProps(scenes: any[], aspect: Aspect, showSubtitles: boolean): WebtoonVideoProps {
  const videoScenes = scenes
    .filter((s) => s.image && s.imageWidth && s.imageHeight)
    .map<VideoScene>((s) => ({
      id: String(s._id),
      src: toVideoSrc(s.image),
      imageWidth: s.imageWidth,
      imageHeight: effectiveImageHeight(s),
      segments: keptSegments(s.cuts),
      hideBoxes: normalizeHideBoxes(s.hideBoxes),
      durationInFrames: Math.max(TRANSITION_FRAMES + 1, Math.round((s.duration || 5) * FPS)),
      camera: sceneCamera(s, aspect),
      cameraFx: CAMERA_FX.includes(s.effects) ? s.effects : 'none',
      visualFx: VISUAL_FX.includes(s.visualEffect) ? s.visualEffect : 'none',
      transition: s.transition === 'dissolve' ? 'fade' : TRANSITIONS.includes(s.transition) ? s.transition : 'none',
      audioUrl: s.audio?.url || s.audio?.cloudinaryUrl || null,
      narration: s.narration || '',
      narrationHi: s.narrationHi || '',
    }));
  return { scenes: videoScenes, aspect, showSubtitles };
}

export const hasTransitionIn = (scenes: VideoScene[], i: number) => i > 0 && scenes[i].transition !== 'none';

/** Start frame of every scene and total length, accounting for transition overlaps. */
export function computeTimeline(scenes: VideoScene[]) {
  const starts: number[] = [];
  let cursor = 0;
  scenes.forEach((s, i) => {
    if (hasTransitionIn(scenes, i)) cursor -= TRANSITION_FRAMES;
    starts.push(cursor);
    cursor += s.durationInFrames;
  });
  return { starts, durationInFrames: Math.max(1, cursor) };
}

export function sceneIndexAtFrame(scenes: VideoScene[], starts: number[], frame: number) {
  for (let i = scenes.length - 1; i >= 0; i--) if (frame >= starts[i]) return i;
  return 0;
}
