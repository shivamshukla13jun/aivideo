'use client';

import React, { useCallback, useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Scissors, Loader2, Check, ChevronRight } from 'lucide-react';

const pageImage = (p: any) => p.editedUrl || p.originalUrl;

type Region = { start: number; end: number };

/** Row-blankness profile of a page image — used to snap cut edges into the blank gutters between panels. */
async function analyzeBlankRows(src: string): Promise<{ blank: boolean[]; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.referrerPolicy = 'no-referrer';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image failed to load'));
    el.src = src;
  });
  const W = 120;
  const H = Math.min(8000, Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
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
    blank[y] = deviating <= W * 0.01;
  }
  return { blank, height: H };
}

/** Snap an edge (fraction 0..1) to the nearest blank row within ±range, or leave it if none found. */
function snapEdge(blank: boolean[], H: number, frac: number, range = 0.05): number {
  const row = Math.round(frac * H);
  const span = Math.round(range * H);
  for (let d = 0; d <= span; d++) {
    const a = row - d;
    const b = row + d;
    if (a >= 0 && a < H && blank[a]) return a / H;
    if (b >= 0 && b < H && blank[b]) return b / H;
  }
  return frac;
}

/**
 * Dedicated page splitter — pick a page, drag to mark the parts you want as
 * separate pages; unmarked parts are discarded. Each part becomes a new page
 * in sequence (OCR re-runs on them via the extract stage).
 */
export default function PageSplitterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chapterId } = use(params);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draft, setDraft] = useState<Region | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [message, setMessage] = useState('');
  const [snapping, setSnapping] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const rowsRef = useRef<{ key: string; blank: boolean[]; height: number } | null>(null);

  /** Snap a marked region's edges into blank gaps between panels so cuts never tear artwork. */
  const snapRegion = useCallback(async (src: string, region: Region): Promise<Region> => {
    if (rowsRef.current?.key !== src) {
      rowsRef.current = { key: src, blank: [], height: 0 };
      rowsRef.current = { key: src, ...(await analyzeBlankRows(src)) };
    }
    const { blank, height } = rowsRef.current;
    const start = snapEdge(blank, height, region.start);
    const end = snapEdge(blank, height, region.end);
    return end - start >= 0.02 ? { start, end } : region;
  }, []);

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
    rowsRef.current = null;
  };

  const addRegion = async (r: Region) => {
    if (!active) return;
    setSnapping(true);
    try {
      const snapped = await snapRegion(pageImage(active), r);
      setRegions((prev) => [...prev, snapped].sort((a, b) => a.start - b.start));
    } finally {
      setSnapping(false);
    }
  };

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
      // Continue on the page right after the last new part (fast batch splitting)
      const next = list.find((p: any) => p.order === order + regions.length) || list[0];
      setActiveId(next?._id || null);
      setRegions([]);
      setDraft(null);
      setMessage(`Split into ${regions.length} page${regions.length === 1 ? '' : 's'}`);
      setTimeout(() => setMessage(''), 4000);
    } catch (e: any) {
      alert(e.message || 'Split failed');
    } finally {
      setSplitting(false);
    }
  };

  const markY = (e: React.MouseEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  };

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
          Select a page → drag over the parts to keep — edges snap to blank gaps so cuts stay clean
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
                const y = markY(e);
                const hit = regions.findIndex((r) => y >= r.start && y <= r.end);
                if (hit >= 0) {
                  setRegions((prev) => prev.filter((_, i) => i !== hit));
                  return;
                }
                setDraft({ start: y, end: y });
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
                const y = markY(e);
                setDraft({ start: Math.min(draft.start, y), end: Math.max(draft.start, y) });
              }}
              onMouseUp={() => {
                if (draft && draft.end - draft.start >= 0.02) {
                  const r = draft;
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
                className="w-full block rounded-lg"
              />
              {regions.map((r, i) => (
                <div
                  key={`${r.start}-${r.end}`}
                  className="absolute left-0 right-0 border-2 border-indigo-400 bg-indigo-500/25 pointer-events-none"
                  style={{ top: `${r.start * 100}%`, height: `${(r.end - r.start) * 100}%` }}
                >
                  <span className="absolute top-0.5 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    Part {i + 1} → #{active.order + i}
                  </span>
                </div>
              ))}
              {draft && draft.end - draft.start >= 0.005 && (
                <div
                  className="absolute left-0 right-0 border-2 border-dashed border-rose-400 bg-rose-500/20 pointer-events-none"
                  style={{ top: `${draft.start * 100}%`, height: `${(draft.end - draft.start) * 100}%` }}
                />
              )}
            </div>
          )}
        </main>

        {/* Parts preview + confirm */}
        <aside className="w-52 shrink-0 border-l border-neutral-800 p-3 space-y-3 overflow-y-auto">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase">New pages</p>
          {snapping && (
            <p className="text-[10px] text-indigo-400 flex items-center space-x-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Snapping edges to panel gaps…</span>
            </p>
          )}
          {regions.length === 0 && !draft && !snapping && (
            <p className="text-[10px] text-neutral-600">
              Drag down the image to mark each part you want as its own page. Click a band to remove it.
            </p>
          )}
          {regions.map((r, i) => (
            <div key={`${r.start}-${r.end}`}>
              <p className="text-[10px] text-neutral-500 mb-1 flex items-center">
                Part {i + 1} <ChevronRight className="w-2.5 h-2.5 mx-0.5" /> page #{active ? active.order + i : '?'}
              </p>
              <div className="relative bg-black rounded-lg overflow-hidden border border-neutral-800 aspect-[3/4]">
                <img
                  src={active ? pageImage(active) : ''}
                  alt={`Part ${i + 1}`}
                  className="w-full h-full object-contain"
                  style={{ clipPath: `inset(${r.start * 100}% 0 ${(1 - r.end) * 100}% 0)` }}
                />
              </div>
            </div>
          ))}
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
            Marked parts replace the page — unmarked parts are discarded. Later pages shift order automatically. New
            pages get cleared text so the Extract stage OCRs them.
          </p>
        </aside>
      </div>
    </div>
  );
}
