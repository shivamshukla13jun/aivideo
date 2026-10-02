import React from 'react';
import type { HideBox, Segment } from '@/lib/video/cleanup';

type ImgRenderer = (style: React.CSSProperties, key?: string) => React.ReactNode;

interface Props {
  /** Kept slices of the original image (from keptSegments). */
  segments: Segment[];
  hideBoxes: HideBox[];
  renderImg: ImgRenderer;
  /** Blur radius for hide boxes, in px of the rendered image. */
  blurPx: number;
  imageFilter?: string;
}

/**
 * Lays out the cleaned image inside a parent box that already has the cleaned
 * aspect ratio. Everything is in percentages so the same markup works in the
 * Remotion composition (px-sized parent) and in the editor (responsive parent).
 */
export default function CleanedImage({ segments, hideBoxes, renderImg, blurPx, imageFilter }: Props) {
  const kept = segments.reduce((s, seg) => s + seg.end - seg.start, 0) || 1;

  return (
    <>
      {segments.map((seg) => {
        const segH = seg.end - seg.start;
        return (
          <div
            key={`${seg.start}-${seg.end}`}
            style={{
              position: 'absolute',
              left: 0,
              width: '100%',
              top: `${(seg.offset / kept) * 100}%`,
              height: `${(segH / kept) * 100}%`,
              overflow: 'hidden',
            }}
          >
            {renderImg({
              position: 'absolute',
              left: 0,
              width: '100%',
              top: `${(-seg.start / segH) * 100}%`,
              height: `${100 / segH}%`,
              maxWidth: 'none',
              filter: imageFilter,
            })}

            {hideBoxes
              .filter((b) => b.y < seg.end && b.y + b.height > seg.start)
              .map((b, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${b.x * 100}%`,
                    width: `${b.width * 100}%`,
                    top: `${((b.y - seg.start) / segH) * 100}%`,
                    height: `${(b.height / segH) * 100}%`,
                    overflow: 'hidden',
                    backgroundColor: b.mode === 'black' ? '#000' : b.mode === 'white' ? '#fff' : undefined,
                  }}
                >
                  {b.mode === 'blur' &&
                    renderImg({
                      position: 'absolute',
                      left: `${(-b.x / b.width) * 100}%`,
                      width: `${100 / b.width}%`,
                      top: `${(-b.y / b.height) * 100}%`,
                      height: `${100 / b.height}%`,
                      maxWidth: 'none',
                      filter: `blur(${blurPx}px)`,
                    })}
                </div>
              ))}
          </div>
        );
      })}
    </>
  );
}
