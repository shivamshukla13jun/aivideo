/**
 * Webtoon camera model shared by the live preview, the camera editor and the
 * MP4 export, so what you see in the studio is exactly what gets rendered.
 *
 * A keyframe describes the viewport over the page image:
 *  - cx / cy: centre of the view as a fraction of image width / height
 *  - zoom:    1 = image width fills the frame width (webtoon read mode on
 *             9:16), 2 = 2x closer, 0.5 = page column takes half the frame.
 */

export type Aspect = '16:9' | '9:16';
export type Easing = 'linear' | 'ease-in-out' | 'ease-out' | 'ease-in' | 'steps';
export type Keyframe = { cx: number; cy: number; zoom: number };
export type Camera = { start: Keyframe; end: Keyframe; easing: Easing; steps?: number };
export type CameraPreset =
  | 'read-down'
  | 'read-up'
  | 'slideshow'
  | 'hold'
  | 'zoom-in'
  | 'zoom-out'
  | 'full-page'
  | 'pan-left'
  | 'pan-right'
  | 'diagonal-dr'
  | 'diagonal-dl'
  | 'dolly-in'
  | 'crane-down'
  | 'focus-pull'
  | 'orbit'
  | 'whip-pan'
  | 'drift';

export const FPS = 30;
export const TRANSITION_FRAMES = 15;
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 6;

export const FRAME_SIZE: Record<Aspect, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

/** Zoom at which a webtoon reads naturally: full width on phones, a centred column on 16:9. */
export const readModeZoom = (aspect: Aspect) => (aspect === '9:16' ? 1 : 0.5);

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Half of the visible area, expressed as fractions of the image width / height. */
export function visibleHalf(k: Pick<Keyframe, 'zoom'>, aspect: Aspect, iw: number, ih: number) {
  const { width: FW, height: FH } = FRAME_SIZE[aspect];
  const scale = (k.zoom * FW) / iw; // frame px per image px
  return { hw: 0.5 / k.zoom, hh: FH / 2 / (ih * scale) };
}

/** Keep the view inside the page (centred on an axis when the page is smaller than the view). */
export function clampKeyframe(k: Keyframe, aspect: Aspect, iw: number, ih: number): Keyframe {
  const zoom = clamp(k.zoom, MIN_ZOOM, MAX_ZOOM);
  const { hw, hh } = visibleHalf({ zoom }, aspect, iw, ih);
  return {
    zoom: round4(zoom),
    cx: round4(hw >= 0.5 ? 0.5 : clamp(k.cx, hw, 1 - hw)),
    cy: round4(hh >= 0.5 ? 0.5 : clamp(k.cy, hh, 1 - hh)),
  };
}

export function presetCamera(preset: CameraPreset, aspect: Aspect, iw: number, ih: number, base?: Camera): Camera {
  const z = readModeZoom(aspect);
  const at = (cy: number, zoom = z, cx = 0.5) => clampKeyframe({ cx, cy, zoom }, aspect, iw, ih);
  const center = base?.start ?? at(0.5);
  switch (preset) {
    case 'read-down':
      return { start: at(0), end: at(1), easing: 'linear' };
    case 'read-up':
      return { start: at(1), end: at(0), easing: 'linear' };
    case 'slideshow': {
      // Step through the page like a slide deck: hold on each viewport-sized
      // "slide", then slide to the next. Steps = number of screens in the page.
      const { hh } = visibleHalf({ zoom: z }, aspect, iw, ih);
      const visible = Math.min(1, hh * 2);
      const screens = Math.max(1, Math.round(1 / visible));
      return { start: at(0), end: at(1), easing: 'steps', steps: screens };
    }
    case 'hold':
      return { start: center, end: center, easing: 'linear' };
    case 'zoom-in':
      return { start: center, end: at(center.cy, center.zoom * 1.6, center.cx), easing: 'ease-in-out' };
    case 'zoom-out':
      return { start: at(center.cy, center.zoom * 1.6, center.cx), end: center, easing: 'ease-in-out' };
    case 'full-page': {
      const { height: FH, width: FW } = FRAME_SIZE[aspect];
      const fit = at(0.5, Math.min(1, (FH * iw) / (ih * FW)));
      return { start: fit, end: fit, easing: 'linear' };
    }
    // --- Cinematic presets ---
    case 'pan-left':
      return { start: at(0.5, z * 1.3, 0.8), end: at(0.5, z * 1.3, 0.2), easing: 'ease-in-out' };
    case 'pan-right':
      return { start: at(0.5, z * 1.3, 0.2), end: at(0.5, z * 1.3, 0.8), easing: 'ease-in-out' };
    case 'diagonal-dr':
      return { start: at(0.15, z * 1.2, 0.25), end: at(0.85, z * 1.2, 0.75), easing: 'ease-in-out' };
    case 'diagonal-dl':
      return { start: at(0.15, z * 1.2, 0.75), end: at(0.85, z * 1.2, 0.25), easing: 'ease-in-out' };
    case 'dolly-in':
      return { start: at(0.3, z * 0.8, 0.5), end: at(0.6, z * 2.0, 0.5), easing: 'ease-in' };
    case 'crane-down':
      return { start: at(0.1, z * 0.6), end: at(0.7, z * 1.4), easing: 'ease-out' };
    case 'focus-pull': {
      const wide = at(0.5, z * 0.5);
      const tight = at(center.cy, z * 2.2, center.cx);
      return { start: wide, end: tight, easing: 'ease-in-out' };
    }
    case 'orbit':
      return { start: at(0.35, z * 1.4, 0.3), end: at(0.65, z * 1.4, 0.7), easing: 'ease-in-out' };
    case 'whip-pan':
      return { start: at(0.5, z * 1.5, 0.1), end: at(0.5, z * 1.5, 0.9), easing: 'ease-in' };
    case 'drift':
      return { start: at(0.4, z, 0.45), end: at(0.6, z, 0.55), easing: 'ease-in-out' };
  }
}

export const defaultCamera = (aspect: Aspect, iw: number, ih: number) => presetCamera('read-down', aspect, iw, ih);

/** Reading-speed based duration: ~2.5s per screen scrolled, plus a short hold. */
export function defaultDurationSeconds(aspect: Aspect, iw: number, ih: number) {
  const { hh } = visibleHalf({ zoom: readModeZoom(aspect) }, aspect, iw, ih);
  const visible = Math.min(1, hh * 2);
  const screens = visible >= 1 ? 0 : (1 - visible) / visible;
  return Math.round(clamp(3 + screens * 2.5, 3, 90) * 2) / 2;
}

/** Fallback for scenes created before the camera model existed. */
export function cameraFromLegacyEffect(effect: string | undefined, aspect: Aspect, iw: number, ih: number): Camera {
  if (effect === 'vertical-pan') return presetCamera('read-down', aspect, iw, ih);
  if (effect === 'zoom-in' || effect === 'ken-burns') return presetCamera('zoom-in', aspect, iw, ih);
  return presetCamera('hold', aspect, iw, ih);
}

const EASINGS: Record<Exclude<Easing, 'steps'>, (t: number) => number> = {
  linear: (t) => t,
  'ease-in': (t) => t * t * t,
  'ease-out': (t) => 1 - Math.pow(1 - t, 3),
  'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/** Slideshow easing: hold ~70% of each step, eased slide to the next viewport. */
function steppedEase(t: number, steps: number): number {
  const n = Math.max(1, Math.round(steps));
  const i = Math.floor(t * n);
  if (i >= n) return 1;
  const frac = t * n - i;
  const slide = Math.min(1, frac / 0.3);
  const e = slide < 0.5 ? 4 * slide * slide * slide : 1 - Math.pow(-2 * slide + 2, 3) / 2;
  return (i + e) / n;
}

export function interpolateCamera(cam: Camera, progress: number): Keyframe {
  const t = cam.easing === 'steps'
    ? steppedEase(clamp(progress, 0, 1), cam.steps ?? 4)
    : EASINGS[cam.easing || 'linear'](clamp(progress, 0, 1));
  // Interpolate zoom geometrically so zooming feels uniform
  const zoom = cam.start.zoom * Math.pow(cam.end.zoom / cam.start.zoom, t);
  return {
    cx: cam.start.cx + (cam.end.cx - cam.start.cx) * t,
    cy: cam.start.cy + (cam.end.cy - cam.start.cy) * t,
    zoom,
  };
}

/** Split a camera move at the given progress into two moves that meet at the cut point. */
export function splitCamera(cam: Camera, progress: number): [Camera, Camera] {
  const mid = interpolateCamera(cam, progress);
  const r = (k: Keyframe): Keyframe => ({ cx: round4(k.cx), cy: round4(k.cy), zoom: round4(k.zoom) });
  const easing = cam.easing || 'linear';
  // Keep stepped cameras stepped — scale each half's slide count to its share
  const stepsA = cam.steps ? Math.max(1, Math.round(cam.steps * progress)) : undefined;
  const stepsB = cam.steps ? Math.max(1, cam.steps - Math.round(cam.steps * progress)) : undefined;
  return [
    { start: cam.start, end: r(mid), easing, steps: stepsA },
    { start: r(mid), end: cam.end, easing, steps: stepsB },
  ];
}
