'use client';

import React, { useState } from 'react';
import { Eraser, Loader2, Scissors, Square, Timer, Wand2, X } from 'lucide-react';
import {
  CutBand,
  HideBox,
  HideMode,
  detectBlankGaps,
  keptFraction,
  normalizeCuts,
  normalizeHideBoxes,
} from '@/lib/video/cleanup';

interface Props {
  src: string;
  /** Same-origin URL used for pixel analysis (auto-cut). */
  analysisSrc: string;
  imageWidth: number;
  /** Original image height (before cuts). */
  imageHeight: number;
  cuts: CutBand[];
  hideBoxes: HideBox[];
  onChange: (next: { cuts: CutBand[]; hideBoxes: HideBox[] }) => void;
  onRefitDuration?: () => void;
}

type Tool = 'cut' | 'hide';
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const BAND_STYLE: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(239,68,68,0.55) 0 8px, rgba(127,29,29,0.55) 8px 16px)',
};
const BOX_FILL: Record<HideMode, string> = {
  blur: 'rgba(245,158,11,0.35)',
  black: 'rgba(0,0,0,0.85)',
  white: 'rgba(255,255,255,0.85)',
};

export default function SceneCleanupEditor({
  src,
  analysisSrc,
  imageWidth: iw,
  imageHeight: ih,
  cuts,
  hideBoxes,
  onChange,
  onRefitDuration,
}: Props) {
  const [tool, setTool] = useState<Tool>('cut');
  const [hideMode, setHideMode] = useState<HideMode>('blur');
  const [detecting, setDetecting] = useState(false);
  const imgBoxRef = React.useRef<HTMLDivElement>(null);

  const toFrac = (clientX: number, clientY: number) => {
    const r = imgBoxRef.current!.getBoundingClientRect();
    return { fx: clamp01((clientX - r.left) / r.width), fy: clamp01((clientY - r.top) / r.height) };
  };

  /**
   * Generic drag: `compute` maps the pointer position to the next state. The
   * state is normalised (sorted / merged) only when the drag ends so indexes
   * stay stable while dragging.
   */
  const drag = (
    e: React.PointerEvent,
    compute: (p: { fx: number; fy: number }, origin: { fx: number; fy: number }) => { cuts: CutBand[]; hideBoxes: HideBox[] }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imgBoxRef.current) return;
    const origin = toFrac(e.clientX, e.clientY);
    let latest = { cuts, hideBoxes };
    const onMove = (ev: PointerEvent) => {
      latest = compute(toFrac(ev.clientX, ev.clientY), origin);
      onChange(latest);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onChange({ cuts: normalizeCuts(latest.cuts), hideBoxes: normalizeHideBoxes(latest.hideBoxes) });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startDraw = (e: React.PointerEvent) => {
    if (tool === 'cut') {
      drag(e, (p, o) => ({
        cuts: [...cuts, { top: Math.min(o.fy, p.fy), bottom: Math.max(o.fy, p.fy) }],
        hideBoxes,
      }));
    } else {
      drag(e, (p, o) => ({
        cuts,
        hideBoxes: [
          ...hideBoxes,
          {
            x: Math.min(o.fx, p.fx),
            y: Math.min(o.fy, p.fy),
            width: Math.abs(p.fx - o.fx),
            height: Math.abs(p.fy - o.fy),
            mode: hideMode,
          },
        ],
      }));
    }
  };

  const dragBandEdge = (e: React.PointerEvent, idx: number, edge: 'top' | 'bottom') =>
    drag(e, (p) => ({ cuts: cuts.map((c, i) => (i === idx ? { ...c, [edge]: p.fy } : c)), hideBoxes }));

  const moveBand = (e: React.PointerEvent, idx: number) => {
    const c0 = cuts[idx];
    const h = c0.bottom - c0.top;
    drag(e, (p, o) => {
      const top = Math.min(1 - h, Math.max(0, c0.top + p.fy - o.fy));
      return { cuts: cuts.map((c, i) => (i === idx ? { top, bottom: top + h } : c)), hideBoxes };
    });
  };

  const moveBox = (e: React.PointerEvent, idx: number) => {
    const b0 = hideBoxes[idx];
    drag(e, (p, o) => ({
      cuts,
      hideBoxes: hideBoxes.map((b, i) =>
        i === idx
          ? {
              ...b,
              x: Math.min(1 - b0.width, Math.max(0, b0.x + p.fx - o.fx)),
              y: Math.min(1 - b0.height, Math.max(0, b0.y + p.fy - o.fy)),
            }
          : b
      ),
    }));
  };

  const resizeBox = (e: React.PointerEvent, idx: number) => {
    const b0 = hideBoxes[idx];
    drag(e, (p) => ({
      cuts,
      hideBoxes: hideBoxes.map((b, i) =>
        i === idx ? { ...b, width: Math.max(0.01, p.fx - b0.x), height: Math.max(0.002, p.fy - b0.y) } : b
      ),
    }));
  };

  const handleAutoCut = async () => {
    setDetecting(true);
    try {
      const found = await detectBlankGaps(analysisSrc, iw, ih);
      if (found.length === 0) alert('No large blank gaps found on this page.');
      else onChange({ cuts: normalizeCuts([...cuts, ...found]), hideBoxes });
    } catch (e: any) {
      alert(e.message || 'Auto-cut failed');
    } finally {
      setDetecting(false);
    }
  };

  const removedPct = Math.round((1 - keptFraction(cuts)) * 1000) / 10;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
          <button
            type="button"
            onClick={() => setTool('cut')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1 ${
              tool === 'cut' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Scissors className="w-3 h-3" />
            <span>Cut Band</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('hide')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1 ${
              tool === 'hide' ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Square className="w-3 h-3" />
            <span>Hide Box</span>
          </button>
        </div>
        {tool === 'hide' && (
          <select
            value={hideMode}
            onChange={(e) => setHideMode(e.target.value as HideMode)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="blur">Blur</option>
            <option value="black">Black fill</option>
            <option value="white">White fill</option>
          </select>
        )}
      </div>

      <div className="relative h-[420px] overflow-y-auto overflow-x-hidden bg-neutral-950 rounded-xl border border-neutral-800">
        <div className="py-3 px-2">
          <div
            ref={imgBoxRef}
            onPointerDown={startDraw}
            className={`relative select-none ${tool === 'cut' ? 'cursor-row-resize' : 'cursor-crosshair'}`}
          >
            <img
              src={src}
              alt="Original page"
              referrerPolicy="no-referrer"
              draggable={false}
              className="block w-full h-auto pointer-events-none select-none"
            />

            {cuts.map((c, i) => (
              <div
                key={`cut-${i}`}
                onPointerDown={(e) => moveBand(e, i)}
                className="absolute left-0 w-full border-y-2 border-red-500 cursor-move"
                style={{ top: `${c.top * 100}%`, height: `${(c.bottom - c.top) * 100}%`, ...BAND_STYLE }}
              >
                <div
                  onPointerDown={(e) => dragBandEdge(e, i, 'top')}
                  className="absolute -top-1.5 left-0 w-full h-3 cursor-ns-resize"
                />
                <div
                  onPointerDown={(e) => dragBandEdge(e, i, 'bottom')}
                  className="absolute -bottom-1.5 left-0 w-full h-3 cursor-ns-resize"
                />
                <div className="absolute top-0.5 left-1 flex items-center space-x-1">
                  <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded select-none">
                    REMOVED
                  </span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onChange({ cuts: cuts.filter((_, j) => j !== i), hideBoxes })}
                    className="bg-neutral-950/90 hover:bg-red-600 text-white rounded p-0.5"
                    title="Restore this part"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {hideBoxes.map((b, i) => (
              <div
                key={`box-${i}`}
                onPointerDown={(e) => moveBox(e, i)}
                className="absolute border-2 border-amber-400 cursor-move"
                style={{
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: `${b.width * 100}%`,
                  height: `${b.height * 100}%`,
                  backgroundColor: BOX_FILL[b.mode],
                }}
              >
                <div className="absolute -top-5 left-0 flex items-center space-x-1">
                  <select
                    value={b.mode}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      onChange({
                        cuts,
                        hideBoxes: hideBoxes.map((x, j) => (j === i ? { ...x, mode: e.target.value as HideMode } : x)),
                      })
                    }
                    className="bg-amber-600 text-white text-[9px] font-bold rounded px-1 py-0 focus:outline-none"
                  >
                    <option value="blur">BLUR</option>
                    <option value="black">BLACK</option>
                    <option value="white">WHITE</option>
                  </select>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onChange({ cuts, hideBoxes: hideBoxes.filter((_, j) => j !== i) })}
                    className="bg-neutral-950/90 hover:bg-red-600 text-white rounded p-0.5"
                    title="Remove hide box"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div
                  onPointerDown={(e) => resizeBox(e, i)}
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-amber-500 rounded-full cursor-nwse-resize"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-400">
        <span>
          Removed <strong className="text-red-300">{removedPct}%</strong> of page • {cuts.length} cut(s) •{' '}
          {hideBoxes.length} hidden box(es)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={handleAutoCut}
          disabled={detecting}
          className="col-span-2 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[11px] font-semibold text-white flex items-center justify-center space-x-1 disabled:opacity-50"
        >
          {detecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          <span>Auto-cut Blank Gaps</span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ cuts: [], hideBoxes })}
          disabled={cuts.length === 0}
          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[11px] text-neutral-200 flex items-center justify-center space-x-1 disabled:opacity-40"
        >
          <Eraser className="w-3 h-3" />
          <span>Restore All Cuts</span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ cuts, hideBoxes: [] })}
          disabled={hideBoxes.length === 0}
          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[11px] text-neutral-200 flex items-center justify-center space-x-1 disabled:opacity-40"
        >
          <Eraser className="w-3 h-3" />
          <span>Clear Hide Boxes</span>
        </button>
        {onRefitDuration && (
          <button
            type="button"
            onClick={onRefitDuration}
            className="col-span-2 px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[11px] text-neutral-200 flex items-center justify-center space-x-1"
          >
            <Timer className="w-3 h-3" />
            <span>Re-fit Duration &amp; Scroll to Cleaned Page</span>
          </button>
        )}
      </div>

      <p className="text-[10px] text-neutral-500 leading-relaxed">
        <strong className="text-red-300">Cut Band</strong>: drag up/down on the page to remove a full-width strip (ads,
        credits, notes, empty space) — the rest closes up. <strong className="text-amber-300">Hide Box</strong>: drag a
        rectangle to blur or cover a watermark/logo. Drag items to move, edges/corner to resize, ✕ to restore.
      </p>
    </div>
  );
}
