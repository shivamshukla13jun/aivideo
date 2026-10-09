'use client';

import React, { useCallback, useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Scissors, Loader2, Check, ChevronRight, Copy, X } from 'lucide-react';

const pageImage = (p: any) => p.editedUrl || p.originalUrl;

type Region = { x: number; y: number; w: number; h: number; script: string };
type RawRect = { x: number; y: number; w: number; h: number };

/** Blankness profile of a page image — rows AND columns — so crop edges can
 *  snap into the whitespace gutters around panels instead of cutting art. */
async function analyzeBlankGrid(
  src: string
): Promise<{ rows: boolean[]; cols: boolean[]; rh: number; cw: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.referrerPolicy = 'no-referrer';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image failed to load'));
    el.src = src;
  });
  const W = 160;
  const H = Math.min(8000, Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const lum = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  const rowMean = new Array<number>(H);
  const rows = new Array<boolean>(H);
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = 0; x < W; x++) sum += lum(x, y);
    const mean = sum / W;
    rowMean[y] = mean;
    let deviating = 0;
    for (let x = 0; x < W; x++) if (Math.abs(lum(x, y) - mean) > 24) deviating++;
    rows[y] = deviating <= W * 0.01;
  }
  const cols = new Array<boolean>(W);
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = 0; y < H; y++) sum += lum(x, y);
    const mean = sum / H;
    let deviating = 0;
    for (let y = 0; y < H; y++) if (Math.abs(lum(x, y) - mean) > 24) deviating++;
    cols[x] = deviating <= H * 0.01;
  }
  return { rows, cols, rh: H, cw: W };
}

/** Snap an edge (fraction) to the nearest blank row/col within ±range, else keep it. */
function snapEdge(blank: boolean[], size: number, frac: number, range = 0.05): number {
  const at = Math.round(frac * size);
  const span = Math.round(range * size);
  for (let d = 0; d <= span; d++) {
    const a = at - d;
    const b = at + d;
    if (a >= 0 && a < size && blank[a]) return a / size;
    if (b >= 0 && b < size && blank[b]) return b / size;
  }
  return frac;
}

/**
 * Dedicated page splitter — pick a page, DRAG A BOX around any part (freeform
 * crop, not just full-width bands); each marked rect becomes its own page,
 * extracted at original resolution as lossless PNG (no quality loss).
 * Unmarked parts are discarded. Edges snap to blank gutters automatically.
 */
export default function PageSplitterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chapterId } = use(params);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draft, setDraft] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [message, setMessage] = useState('');
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const gridRef = useRef<{ key: string; rows: boolean[]; cols: boolean[]; rh: number; cw: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/chapters/${chapterId}/pages`);
    const data = await res.json();
    const list = data.success ? data.data : [];
    setPages(list);
    return list;
  }, [chapterId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await load();
      if (alive) {
        setLoading(false);
        if (list.length && !activeId) setActiveId(list[0]._id);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const active = pages.find((p) => p._id === activeId) || null;

  const pick = (id: string) => {
    setActiveId(id);
    setRegions([]);
    setDraft(null);
    setMessage('');
    gridRef.current = null;
  };

  /** Snap a dragged rect's edges into blank gutters (rows + cols). */
  const snapRect = useCallback(async (src: string, rect: RawRect): Promise<Region> => {
    if (gridRef.current?.key !== src) {
      gridRef.current = { key: src, ...(await analyzeBlankGrid(src)) };
    }
    const { rows, cols, rh, cw } = gridRef.current;
    const y1 = snapEdge(rows, rh, rect.y);
    const y2 = snapEdge(rows, rh, rect.y + rect.h);
    const x1 = snapEdge(cols, cw, rect.x);
    const x2 = snapEdge(cols, cw, rect.x + rect.w);
    const out = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), script: '' };
    return out.w >= 0.02 && out.h >= 0.01 ? out : { ...rect, script: '' };
  }, []);

  const addRegion = async (rect: RawRect) => {
    if (!active) return;
    setSnapping(true);
    try {
      const snapped = await snapRect(pageImage(active), rect);
      setRegions((prev) => [...prev, snapped].sort((a, b) => a.y - b.y || a.x - b.x));
    } finally {
      setSnapping(false);
    }
  };

  const setRegionScript = (i: number, script: string) =>
    setRegions((prev) => prev.map((r, j) => (j === i ? { ...r, script } : r)));

  const confirmSplit = async () => {
    if (!active || splitting || !regions.length) return;
    setSplitting(true);
    const order = active.order;
    try {
      const res = await fetch(`/api/chapters/${chapterId}/pages/${active._id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Split failed');
      const list = await load();
      const next = list.find((p: any) => p.order === order + regions.length) || list[0];
      setActiveId(next?._id || null);
      setRegions([]);
      setDraft(null);
      gridRef.current = null;
      setMessage(`Created ${regions.length} page${regions.length === 1 ? '' : 's'}`);
      setTimeout(() => setMessage(''), 4000);
    } catch (e: any) {
      alert(e.message || 'Split failed');
    } finally {
      setSplitting(false);
    }
  };

  const markXY = (e: React.MouseEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const draftRect: RawRect | null = draft
    ? {
        x: Math.min(draft.ax, draft.bx),
        y: Math.min(draft.ay, draft.by),
        w: Math.abs(draft.bx - draft.ax),
        h: Math.abs(draft.by - draft.ay),
      }
    : null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar />
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href={`/chapters/${chapterId}/studio`}
            className="text-neutral-400 hover:text-white flex items-center space-x-1.5 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Studio</span>
          </Link>
          <h1 className="text-sm font-bold flex items-center space-x-2">
            <Scissors className="w-4 h-4 text-rose-400" />
            <span>Page Splitter</span>
          </h1>
        </div>
        <p className="text-[11px] text-neutral-500">
          Select a page → drag a box around any part → each crop becomes its own page (lossless)
        </p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Pages rail */}
        <aside className="w-44 shrink-0 border-r border-neutral-800 overflow-y-auto p-2 space-y-2">
          {loading && <p className="text-xs text-neutral-500 p-2">Loading pages…</p>}
          {pages.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => pick(p._id)}
              className={`relative w-full aspect-[3/4] rounded-lg overflow-hidden border transition-all ${
                activeId === p._id
                  ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                  : 'border-neutral-800 hover:border-neutral-600'
              }`}
            >
              <img
                src={pageImage(p)}
                alt={`Page ${p.order}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
              <span className="absolute bottom-1 right-1 bg-neutral-950/80 px-1 py-0.5 rounded text-[9px] font-bold text-neutral-300">
                #{p.order}
              </span>
              {p.ocrProvider && (
                <span className="absolute top-1 right-1 bg-purple-600/90 text-white rounded px-1 text-[8px] font-bold">
                  OCR
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* Marking stage — reader mode: page at full width, scrolls vertically */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto min-w-0 px-4 py-6">
          {!active ? (
            <p className="text-neutral-500 text-sm mt-20 text-center">No pages — upload a CBZ first.</p>
          ) : (
            <div
              ref={stageRef}
              className="relative mx-auto w-full max-w-3xl select-none cursor-crosshair"
              onMouseDown={(e) => {
                const p = markXY(e);
                // Always start a new box — overlapping boxes let the same panel
                // be cropped 2-3 times (multiple scenes from one panel).
                setDraft({ ax: p.x, ay: p.y, bx: p.x, by: p.y });
              }}
              onMouseMove={(e) => {
                if (!draft || !(e.buttons & 1)) return;
                const sc = scrollRef.current;
                if (sc) {
                  // Auto-scroll when dragging near the viewport edges
                  const r = sc.getBoundingClientRect();
                  const edge = 70;
                  if (e.clientY < r.top + edge) sc.scrollTop -= 24;
                  else if (e.clientY > r.bottom - edge) sc.scrollTop += 24;
                }
                const p = markXY(e);
                setDraft({ ...draft, bx: p.x, by: p.y });
              }}
              onMouseUp={() => {
                if (draftRect && draftRect.w >= 0.02 && draftRect.h >= 0.01) {
                  const r = draftRect;
                  setDraft(null);
                  addRegion(r);
                  return;
                }
                setDraft(null);
              }}
              onMouseLeave={() => setDraft(null)}
            >
              <img
                src={pageImage(active)}
                alt={`Page ${active.order}`}
                draggable={false}
                onLoad={(e) =>
                  setImgDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                }
                className="w-full block rounded-lg"
              />
              {/* Marked crops */}
              {regions.map((r, i) => (
                <div
                  key={`${r.x}-${r.y}-${r.w}-${r.h}-${i}`}
                  className="absolute border-2 border-indigo-400 bg-indigo-500/25"
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                  }}
                >
                  <span className="absolute top-0.5 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                    Part {i + 1} → #{active.order + i}
                  </span>
                  {/* ✕ removes just this crop */}
                  <button
                    type="button"
                    title="Remove this part"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setRegions((prev) => prev.filter((_, j) => j !== i));
                    }}
                    className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-0.5 shadow z-10"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              {/* Live drag box */}
              {draftRect && draftRect.w >= 0.005 && draftRect.h >= 0.003 && (
                <div
                  className="absolute border-2 border-dashed border-rose-400 bg-rose-500/20 pointer-events-none"
                  style={{
                    left: `${draftRect.x * 100}%`,
                    top: `${draftRect.y * 100}%`,
                    width: `${draftRect.w * 100}%`,
                    height: `${draftRect.h * 100}%`,
                  }}
                />
              )}
            </div>
          )}
        </main>

        {/* Crops preview + scripts + confirm */}
        <aside className="w-56 shrink-0 border-l border-neutral-800 p-3 space-y-3 overflow-y-auto">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase">New pages</p>
          {snapping && (
            <p className="text-[10px] text-indigo-400 flex items-center space-x-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Snapping edges to panel gaps…</span>
            </p>
          )}
          {regions.length === 0 && !draft && !snapping && (
            <p className="text-[10px] text-neutral-600">
              Drag a box around any part of the page — a panel, a character, a bubble. Click a box to remove it.
            </p>
          )}
          {regions.map((r, i) => {
            // Real pixel dims of this crop for aspect-correct preview
            const pxW = imgDims ? Math.max(1, Math.round(r.w * imgDims.w)) : 3;
            const pxH = imgDims ? Math.max(1, Math.round(r.h * imgDims.h)) : 4;
            return (
              <div key={`${r.x}-${r.y}-${r.w}-${r.h}-${i}`}>
                <p className="text-[10px] text-neutral-500 mb-1 flex items-center">
                  Part {i + 1} <ChevronRight className="w-2.5 h-2.5 mx-0.5" /> page #{active ? active.order + i : '?'}
                  <span className="ml-auto text-neutral-600 mr-1">
                    {pxW}×{pxH}px
                  </span>
                  {/* Duplicate — same crop again (e.g. panel reused in 2-3 scenes) */}
                  <button
                    type="button"
                    title="Duplicate this part as another page"
                    onClick={() =>
                      setRegions((prev) => {
                        const next = [...prev];
                        next.splice(i + 1, 0, { ...r });
                        return next;
                      })
                    }
                    className="text-neutral-500 hover:text-indigo-400 transition-colors mr-1"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    title="Remove this part"
                    onClick={() => setRegions((prev) => prev.filter((_, j) => j !== i))}
                    className="text-neutral-500 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </p>
                <div
                  className="relative bg-black rounded-lg overflow-hidden border border-neutral-800 w-full"
                  style={{ aspectRatio: `${pxW}/${pxH}` }}
                >
                  {/* Full image scaled so this crop's window fills the box */}
                  <img
                    src={active ? pageImage(active) : ''}
                    alt={`Part ${i + 1}`}
                    draggable={false}
                    style={{
                      position: 'absolute',
                      width: `${100 / r.w}%`,
                      height: `${100 / r.h}%`,
                      left: `${(-r.x / r.w) * 100}%`,
                      top: `${(-r.y / r.h) * 100}%`,
                      objectFit: 'fill',
                      maxWidth: 'none',
                    }}
                  />
                </div>
                <textarea
                  value={r.script}
                  onChange={(e) => setRegionScript(i, e.target.value)}
                  placeholder="Script for this part (English) — becomes narration, skips OCR"
                  rows={3}
                  className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500 resize-y"
                />
              </div>
            );
          })}
          <button
            type="button"
            onClick={confirmSplit}
            disabled={splitting || snapping || !regions.length}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            {splitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
            <span>
              {splitting ? 'Splitting…' : `Create ${regions.length || ''} Page${regions.length === 1 ? '' : 's'}`}
            </span>
          </button>
          {message && (
            <p className="text-[11px] text-emerald-400 flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>{message}</span>
            </p>
          )}
          <p className="text-[9px] text-neutral-600 leading-snug">
            Crops are extracted at full resolution and saved lossless — no quality drop. Edges auto-snap to blank
            gutters. Marked parts replace the page in order; unmarked parts are discarded. Scripts attach as English
            narration (extract stage skips them; translate still runs).
          </p>
        </aside>
      </div>
    </div>
  );
}
