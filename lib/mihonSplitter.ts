import sharp from 'sharp';

export interface ImageSlice {
  buffer: Buffer;
  width: number;
  height: number;
  index: number;
}

/**
 * Checks if an image is considered "tall" in Mihon (e.g., long strip webtoon).
 * Mihon splits images when the height is at least twice the width or exceeds standard texture height.
 */
export function isTallImage(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = height / width;
  return ratio >= 2.0 || height >= 2600;
}

/**
 * Calculates optimal cut points for a tall webtoon strip using Mihon's smart gutter detection.
 * Inspects row averages in a window around target slice heights to cut cleanly in blank gutters
 * (white/black borders) between panels instead of slicing through artwork or speech bubbles.
 */
export async function calculateMihonSplitPoints(
  imageBuffer: Buffer,
  width: number,
  height: number
): Promise<number[]> {
  // Target slice height: ~2x width, bounded between 1600px and 2600px
  const targetSliceHeight = Math.min(Math.max(Math.round(width * 2.0), 1600), 2600);
  const approxSlices = Math.ceil(height / targetSliceHeight);

  if (approxSlices <= 1) {
    return [0, height];
  }

  // Compress horizontally to a 1-pixel-wide column to evaluate average row colors across the entire strip
  let rowAverages: Buffer;
  try {
    rowAverages = await sharp(imageBuffer)
      .resize(1, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();
  } catch (err) {
    console.warn('Gutter detection fallback to uniform slices:', err);
    // Uniform slice fallback
    const points = [0];
    for (let i = 1; i < approxSlices; i++) {
      points.push(Math.round((i * height) / approxSlices));
    }
    points.push(height);
    return points;
  }

  const splitPoints: number[] = [0];
  const searchWindow = Math.min(250, Math.round(targetSliceHeight * 0.15));

  for (let i = 1; i < approxSlices; i++) {
    const rawTargetY = Math.round((i * height) / approxSlices);
    const minY = Math.max(splitPoints[splitPoints.length - 1] + 600, rawTargetY - searchWindow);
    const maxY = Math.min(height - 600, rawTargetY + searchWindow);

    let bestY = rawTargetY;
    let bestScore = -1;

    // Scan through rows in the search window to find the most uniform gutter row
    for (let y = minY; y <= maxY; y++) {
      const idx = y * 3;
      const r = rowAverages[idx];
      const g = rowAverages[idx + 1];
      const b = rowAverages[idx + 2];

      // White gutter score (webtoon panels are separated by white backgrounds)
      const whiteScore = Math.min(r, g, b);
      // Black gutter score (dark mode or dark webtoons)
      const blackScore = 255 - Math.max(r, g, b);

      let score = 0;
      if (whiteScore >= 240) {
        score = 1000 + whiteScore; // High priority for white gutter
      } else if (blackScore >= 240) {
        score = 800 + blackScore; // High priority for black gutter
      } else {
        // Uniform color / low variance row
        const variance = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        score = 255 - variance;
      }

      if (score > bestScore) {
        bestScore = score;
        bestY = y;
      }
    }

    splitPoints.push(bestY);
  }

  splitPoints.push(height);
  return splitPoints;
}

/**
 * Splits a tall image buffer into multiple webtoon slices according to Mihon logic.
 * If the image is not tall, returns a single slice with the original image.
 */
export async function splitTallImageMihon(
  imageBuffer: Buffer,
  format: 'jpeg' | 'webp' | 'png' = 'jpeg'
): Promise<ImageSlice[]> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (!isTallImage(width, height)) {
    return [
      {
        buffer: imageBuffer,
        width,
        height,
        index: 0,
      },
    ];
  }

  const splitPoints = await calculateMihonSplitPoints(imageBuffer, width, height);
  const slices: ImageSlice[] = [];

  for (let i = 0; i < splitPoints.length - 1; i++) {
    const top = splitPoints[i];
    const sliceHeight = splitPoints[i + 1] - top;

    if (sliceHeight <= 0) continue;

    const sliceBuffer = await sharp(imageBuffer)
      .extract({ left: 0, top, width, height: sliceHeight })
      .toFormat(format, { quality: 92 })
      .toBuffer();

    slices.push({
      buffer: sliceBuffer,
      width,
      height: sliceHeight,
      index: i,
    });
  }

  return slices;
}
