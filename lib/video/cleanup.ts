/**
 * Scene image clean-up: parts of a page that should not appear in the video.
 *  - Cut bands remove a full-width horizontal strip (ads, credits, notes,
 *    huge blank gaps); the content below moves up to close the gap.
 *  - Hide boxes cover a rectangle (watermarks, site logos) with blur or a fill.
 * All values are fractions of the ORIGINAL image (0..1).
 */

export type CutBand = { top: number; bottom: number };
export type HideMode = 'blur' | 'black' | 'white';
export type HideBox = { x: number; y: number; width: number; height: number; mode: HideMode };
/** A kept slice of the original image and where it lands in the cleaned image (original-height units). */
export type Segment = { start: number; end: number; offset: number };

const MIN_BAND = 0.002;
const MIN_KEPT = 0.02;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round5 = (n: number) => Math.round(n * 100000) / 100000;

export function normalizeCuts(cuts: CutBand[] | undefined | null): CutBand[] {
  const sorted = (cuts || [])
    .map((c) => ({ top: clamp01(Math.min(c.top, c.bottom)), bottom: clamp01(Math.max(c.top, c.bottom)) }))
    .filter((c) => c.bottom - c.top >= MIN_BAND)
    .sort((a, b) => a.top - b.top);

  const merged: CutBand[] = [];
  for (const c of sorted) {
    const last = merged[merged.length - 1];
    if (last && c.top <= last.bottom) last.bottom = Math.max(last.bottom, c.bottom);
    else merged.push({ ...c });
  }

  // Never allow the whole image to be cut away
  const removed = merged.reduce((s, c) => s + c.bottom - c.top, 0);
  if (1 - removed < MIN_KEPT) return [];
  return merged.map((c) => ({ top: round5(c.top), bottom: round5(c.bottom) }));
}

export function normalizeHideBoxes(boxes: HideBox[] | undefined | null): HideBox[] {
  return (boxes || [])
    .map((b) => {
      const x = clamp01(b.x);
      const y = clamp01(b.y);
      return {
        x: round5(x),
        y: round5(y),
        width: round5(Math.min(1 - x, Math.max(0, b.width))),
        height: round5(Math.min(1 - y, Math.max(0, b.height))),
        mode: (['blur', 'black', 'white'] as HideMode[]).includes(b.mode) ? b.mode : 'blur',
      };
    })
    .filter((b) => b.width > 0.003 && b.height > 0.001);
}

export function keptSegments(cuts: CutBand[] | undefined | null): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let offset = 0;
  for (const c of normalizeCuts(cuts)) {
    if (c.top > cursor) {
      segments.push({ start: cursor, end: c.top, offset });
      offset += c.top - cursor;
    }
    cursor = c.bottom;
  }
  if (cursor < 1) segments.push({ start: cursor, end: 1, offset });
  return segments;
}

/** Fraction of the original height that remains after cuts. */
export const keptFraction = (cuts: CutBand[] | undefined | null) =>
  keptSegments(cuts).reduce((s, seg) => s + seg.end - seg.start, 0);

/**
 * Find large uniform gaps (empty space between webtoon panels) and return
 * cut bands that shrink each gap down to a small gutter.
 */
export async function detectBlankGaps(
  src: string,
  iw: number,
  ih: number,
  opts: { minGapWidths?: number; keepGutterWidths?: number } = {}
): Promise<CutBand[]> {
  const minGap = opts.minGapWidths ?? 0.3; // gap taller than 30% of image width
  const keep = opts.keepGutterWidths ?? 0.05; // leave a 5%-of-width gutter on each side

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image failed to load for analysis'));
    el.src = src;
  });

  const W = 120;
  const H = Math.min(6000, Math.max(1, Math.round((W * ih) / iw)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  const rowMean: number[] = new Array(H);
  const blank: boolean[] = new Array(H);
  for (let y = 0; y < H; y++) {
    const lum = (x: number) => {
      const i = (y * W + x) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };
    let sum = 0;
    for (let x = 0; x < W; x++) sum += lum(x);
    const mean = sum / W;
    let deviating = 0;
    for (let x = 0; x < W; x++) if (Math.abs(lum(x) - mean) > 24) deviating++;
    rowMean[y] = mean;
    blank[y] = deviating <= W * 0.01;
  }

  const rowsPerWidth = W; // 1 image-width of height == W rows at this scale
  const minRows = Math.round(minGap * rowsPerWidth);
  const keepRows = Math.round(keep * rowsPerWidth);
  const cuts: CutBand[] = [];

  for (let y = 0; y < H; ) {
    if (!blank[y]) {
      y++;
      continue;
    }
    let end = y;
    // A gap is a run of blank rows of the same colour
    while (end < H && blank[end] && Math.abs(rowMean[end] - rowMean[y]) < 12) end++;
    if (end - y >= minRows) {
      const top = y === 0 ? 0 : y + keepRows;
      const bottom = end === H ? H : end - keepRows;
      if (bottom > top) cuts.push({ top: top / H, bottom: bottom / H });
    }
    y = Math.max(end, y + 1);
  }
  return normalizeCuts(cuts);
}
