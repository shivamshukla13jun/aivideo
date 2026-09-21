'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import {
  Crop,
  Scissors,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Film,
  BookOpen,
  Move,
  Hand,
  Maximize2,
  RotateCcw,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function WebtoonEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chapterId = resolvedParams.id;

  const [chapter, setChapter] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<any>(null);

  // Gallery Cropper Modal State
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const [splitBoxes, setSplitBoxes] = useState<{ id: string; x: number; y: number; width: number; height: number }[]>([
    { id: '1', x: 5, y: 5, width: 90, height: 30 },
    { id: '2', x: 5, y: 40, width: 90, height: 30 },
    { id: '3', x: 5, y: 75, width: 90, height: 22 },
  ]);
  const [activeCropMode, setActiveCropMode] = useState<'crop' | 'split'>('crop');
  const [saving, setSaving] = useState(false);

  // Hand Crop Interaction Refs & State
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const dragActionRef = useRef<string | null>(null);
  const dragStartPosRef = useRef<{ xPct: number; yPct: number }>({ xPct: 0, yPct: 0 });
  const initialBoxRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    async function loadEditorData() {
      try {
        const [chapRes, pagesRes] = await Promise.all([
          fetch(`/api/chapters/${chapterId}`),
          fetch(`/api/chapters/${chapterId}/pages`),
        ]);
        const cData = await chapRes.json();
        const pData = await pagesRes.json();

        if (cData.success) setChapter(cData.data);
        if (pData.success) {
          setPages(pData.data);
          if (pData.data.length > 0) setSelectedPage(pData.data[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadEditorData();
  }, [chapterId]);

  // Hand Crop Pointer Down Handler (Move, 8-Handle Resize, or Draw New Box)
  const handlePointerDown = (
    e: React.PointerEvent,
    action: 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'draw'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    dragActionRef.current = action;
    dragStartPosRef.current = { xPct, yPct };
    initialBoxRef.current = { ...cropBox };
    setIsInteracting(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragActionRef.current || !imageContainerRef.current) return;
      const currentRect = imageContainerRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(100, ((moveEvent.clientX - currentRect.left) / currentRect.width) * 100));
      const currentY = Math.max(0, Math.min(100, ((moveEvent.clientY - currentRect.top) / currentRect.height) * 100));

      const act = dragActionRef.current;
      const init = initialBoxRef.current;
      const start = dragStartPosRef.current;

      if (act === 'move') {
        const dx = currentX - start.xPct;
        const dy = currentY - start.yPct;
        const newX = Math.max(0, Math.min(100 - init.width, init.x + dx));
        const newY = Math.max(0, Math.min(100 - init.height, init.y + dy));
        setCropBox({
          ...init,
          x: Math.round(newX),
          y: Math.round(newY),
        });
      } else if (act === 'draw') {
        const left = Math.min(start.xPct, currentX);
        const top = Math.min(start.yPct, currentY);
        const width = Math.max(5, Math.abs(currentX - start.xPct));
        const height = Math.max(5, Math.abs(currentY - start.yPct));
        setCropBox({
          x: Math.round(left),
          y: Math.round(top),
          width: Math.round(Math.min(100 - left, width)),
          height: Math.round(Math.min(100 - top, height)),
        });
      } else {
        // 8-Direction Handle Resize
        let x = init.x;
        let y = init.y;
        let right = init.x + init.width;
        let bottom = init.y + init.height;

        if (act.includes('w')) {
          x = Math.max(0, Math.min(right - 5, currentX));
        }
        if (act.includes('e')) {
          right = Math.max(x + 5, Math.min(100, currentX));
        }
        if (act.includes('n')) {
          y = Math.max(0, Math.min(bottom - 5, currentY));
        }
        if (act.includes('s')) {
          bottom = Math.max(y + 5, Math.min(100, currentY));
        }

        setCropBox({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(right - x),
          height: Math.round(bottom - y),
        });
      }
    };

    const onPointerUp = () => {
      dragActionRef.current = null;
      setIsInteracting(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleConfirmCrop = async () => {
    if (!selectedPage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/chapters/${chapterId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: selectedPage._id,
          cropBox,
          action: 'crop',
        }),
      });
      const data = await res.json();
      if (data.success) {
        const pRes = await fetch(`/api/chapters/${chapterId}/pages`);
        const pData = await pRes.json();
        if (pData.success) {
          setPages(pData.data);
          const updated = pData.data.find((p: any) => p._id === selectedPage._id || p.order === selectedPage.order);
          if (updated) setSelectedPage(updated);
        }
        setIsCropModalOpen(false);
      } else {
        alert(data.error || 'Failed to crop page');
      }
    } catch (e) {
      console.error(e);
      alert('Crop request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSplit = async () => {
    if (!selectedPage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/chapters/${chapterId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: selectedPage._id,
          splitBoxes,
          action: 'split',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPages(data.data);
        setIsCropModalOpen(false);
      } else {
        alert(data.error || 'Failed to split panels');
      }
    } catch (e) {
      console.error(e);
      alert('Split request failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <Link
            href={chapter ? `/series/${chapter.seriesId}` : '/'}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white leading-tight">
                {chapter?.title || `Chapter ${chapter?.chapterNumber}`} - Panel & Crop Studio
              </h1>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                Suwayomi Chapter #{chapter?.chapterNumber}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Direct hand cropping and panel splitting synced from your Suwayomi server.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href={`/chapters/${chapterId}/reader`}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-neutral-700"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Reader Mode</span>
          </Link>
          <Link
            href={`/chapters/${chapterId}/studio`}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
          >
            <Film className="w-4 h-4" />
            <span>Video Studio</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Suwayomi Pages ({pages.length})</h2>
            <p className="text-xs text-neutral-400">Click any page to crop with hand gestures or split into panels.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {pages.map((page, idx) => (
            <div
              key={page._id}
              onClick={() => setSelectedPage(page)}
              className={`group relative bg-neutral-900 border rounded-2xl overflow-hidden cursor-pointer transition-all shadow-md ${
                selectedPage?._id === page._id
                  ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="relative aspect-[3/4] w-full bg-neutral-950">
                <img
                  src={page.editedUrl || page.originalUrl}
                  alt={`Page ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-2.5 flex items-center justify-between bg-neutral-900 border-t border-neutral-800">
                <span className="text-xs font-bold text-neutral-300">Page {idx + 1}</span>
                <span className="text-[10px] bg-neutral-800 text-indigo-400 px-2 py-0.5 rounded">
                  {page.panels?.length || 0} panels
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Page Action Bar */}
        {selectedPage && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center space-x-4">
              <div className="relative w-20 h-28 rounded-xl overflow-hidden shadow bg-neutral-950 flex-shrink-0">
                <img
                  src={selectedPage.editedUrl || selectedPage.originalUrl}
                  alt="Selected"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Selected Page #{selectedPage.order}</h3>
                <p className="text-xs text-neutral-400 mt-1">Configured Panels: {selectedPage.panels?.length || 0}</p>
                {selectedPage.editedUrl && selectedPage.editedUrl !== selectedPage.originalUrl && (
                  <span className="inline-block mt-1 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Cropped Version Active
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setActiveCropMode('crop');
                  setIsCropModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center space-x-2 shadow transition-all"
              >
                <Crop className="w-4 h-4" />
                <span>Hand Crop Page</span>
              </button>
              <button
                onClick={() => {
                  setActiveCropMode('split');
                  setIsCropModalOpen(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center space-x-2 shadow transition-all"
              >
                <Scissors className="w-4 h-4" />
                <span>Split Into Panels</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Gallery-Style Cropper / Multi-Panel Modal with Hand Crop */}
      {isCropModalOpen && selectedPage && (
        <div className="fixed inset-0 z-50 bg-neutral-950/95 backdrop-blur-md flex flex-col select-none">
          <header className="px-6 py-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Crop className="w-5 h-5 text-indigo-400" />
                <span>{activeCropMode === 'crop' ? 'Page Hand Cropper' : 'Multi-Panel Split Editor'}</span>
              </h3>
              <span className="text-xs text-neutral-400 hidden sm:inline">
                Page #{selectedPage.order}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsCropModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={activeCropMode === 'crop' ? handleConfirmCrop : handleConfirmSplit}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Save</span>
                  </>
                )}
              </button>
            </div>
          </header>

          <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 gap-8 relative overflow-y-auto">
            {/* Left: Hand Crop Interactive Canvas */}
            <div className="flex flex-col items-center max-w-2xl w-full">
              {/* Hand Mode Info Banner */}
              <div className="mb-3 flex items-center space-x-2 text-xs text-indigo-300 bg-indigo-950/70 border border-indigo-500/40 px-3.5 py-1.5 rounded-full shadow">
                <Hand className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>
                  <strong>Hand Crop:</strong> Drag inside box to move • Drag 8 points to resize • Click & drag outside to draw new area
                </span>
              </div>

              {/* Canvas Frame */}
              <div className="relative max-h-[72vh] max-w-full overflow-hidden bg-neutral-950 rounded-2xl shadow-2xl border border-neutral-800 flex items-center justify-center select-none">
                <div
                  ref={imageContainerRef}
                  onPointerDown={(e) => handlePointerDown(e, 'draw')}
                  className="relative inline-block max-h-[72vh] cursor-crosshair select-none"
                >
                  <img
                    src={selectedPage.originalUrl}
                    alt="Crop Target"
                    referrerPolicy="no-referrer"
                    className="max-h-[72vh] w-auto max-w-full object-contain block select-none pointer-events-none"
                  />

                  {activeCropMode === 'crop' ? (
                    <div
                      className="absolute border-2 border-indigo-400 rounded-lg select-none"
                      style={{
                        top: `${cropBox.y}%`,
                        left: `${cropBox.x}%`,
                        width: `${cropBox.width}%`,
                        height: `${cropBox.height}%`,
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                      }}
                    >
                      {/* Rule of Thirds Grid Overlay */}
                      <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
                        <div className="border-r border-b border-white/60"></div>
                        <div className="border-r border-b border-white/60"></div>
                        <div className="border-b border-white/60"></div>
                        <div className="border-r border-b border-white/60"></div>
                        <div className="border-r border-b border-white/60"></div>
                        <div className="border-b border-white/60"></div>
                        <div className="border-r border-white/60"></div>
                        <div className="border-r border-white/60"></div>
                        <div></div>
                      </div>

                      {/* Move Area (Center Draggable Body) */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 'move')}
                        className="absolute inset-0 cursor-move flex flex-col items-center justify-center p-2 group"
                      >
                        <span className="bg-indigo-600/90 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center space-x-1.5 backdrop-blur-sm pointer-events-none select-none border border-indigo-400/40">
                          <Move className="w-3.5 h-3.5" />
                          <span>Crop Area ({Math.round(cropBox.width)}% × {Math.round(cropBox.height)}%)</span>
                        </span>
                        <span className="text-[10px] text-indigo-200 mt-1 font-medium select-none pointer-events-none bg-black/60 px-2 py-0.5 rounded shadow">
                          🖐 Drag to move
                        </span>
                      </div>

                      {/* 8 Hand-Resize Handles */}
                      {/* Top Left */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 'nw')}
                        className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-lg cursor-nwse-resize hover:scale-125 transition-transform z-30 flex items-center justify-center"
                        title="Resize Top-Left"
                      >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                      {/* Top Center */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 'n')}
                        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-lg cursor-ns-resize hover:scale-125 transition-transform z-30 flex items-center justify-center"
                        title="Resize Top"
                      >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                      {/* Top Right */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 'ne')}
                        className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-lg cursor-nesw-resize hover:scale-125 transition-transform z-30 flex items-center justify-center"
                        title="Resize Top-Right"
                      >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                      {/* Right Center */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 'e')}
                        className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-lg cursor-ew-resize hover:scale-125 transition-transform z-30 flex items-center justify-center"
                        title="Resize Right"
                      >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                      {/* Bottom Right */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 'se')}
                        className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-lg cursor-nwse-resize hover:scale-125 transition-transform z-30 flex items-center justify-center"
                        title="Resize Bottom-Right"
                      >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                      {/* Bottom Center */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 's')}
                        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-lg cursor-ns-resize hover:scale-125 transition-transform z-30 flex items-center justify-center"
                        title="Resize Bottom"
                      >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                      {/* Bottom Left */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 'sw')}
                        className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-lg cursor-nesw-resize hover:scale-125 transition-transform z-30 flex items-center justify-center"
                        title="Resize Bottom-Left"
                      >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                      {/* Left Center */}
                      <div
                        onPointerDown={(e) => handlePointerDown(e, 'w')}
                        className="absolute top-1/2 -left-2.5 -translate-y-1/2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-lg cursor-ew-resize hover:scale-125 transition-transform z-30 flex items-center justify-center"
                        title="Resize Left"
                      >
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                    </div>
                  ) : (
                    splitBoxes.map((box, index) => (
                      <div
                        key={box.id}
                        className="absolute border-2 border-purple-500 bg-purple-500/25 backdrop-blur-[1px] rounded-lg flex items-center justify-center shadow-lg"
                        style={{ top: `${box.y}%`, left: `${box.x}%`, width: `${box.width}%`, height: `${box.height}%` }}
                      >
                        <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                          Panel {index + 1}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right: Crop Control Panel & Fine-Tune Sliders */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-xl">
              <div>
                <h4 className="font-bold text-white text-sm">Select & Adjust Crop Region (%)</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Adjust by dragging directly on the image, using presets, or fine-tuning sliders below.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 0, y: 0, width: 100, height: 100 })}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs rounded-xl font-medium text-neutral-200 transition-colors flex items-center justify-center space-x-1"
                >
                  <Maximize2 className="w-3 h-3 text-indigo-400" />
                  <span>Full Page</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 10, y: 10, width: 80, height: 80 })}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs rounded-xl font-medium text-neutral-200 transition-colors flex items-center justify-center space-x-1"
                >
                  <RotateCcw className="w-3 h-3 text-purple-400" />
                  <span>Center Box</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 0, y: 0, width: 100, height: 50 })}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs rounded-xl font-medium text-neutral-200 transition-colors"
                >
                  Top Half
                </button>
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 0, y: 50, width: 100, height: 50 })}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs rounded-xl font-medium text-neutral-200 transition-colors"
                >
                  Bottom Half
                </button>
              </div>

              {/* Sliders (Bidirectionally Synced with Hand Crop) */}
              <div className="space-y-3.5 text-xs bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800/80">
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1.5 font-medium">
                    <span>X Position</span>
                    <span className="text-indigo-400 font-bold">{cropBox.x}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={100 - cropBox.width}
                    value={cropBox.x}
                    onChange={(e) => setCropBox((prev) => ({ ...prev, x: Number(e.target.value) }))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1.5 font-medium">
                    <span>Y Position</span>
                    <span className="text-indigo-400 font-bold">{cropBox.y}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={100 - cropBox.height}
                    value={cropBox.y}
                    onChange={(e) => setCropBox((prev) => ({ ...prev, y: Number(e.target.value) }))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1.5 font-medium">
                    <span>Width</span>
                    <span className="text-indigo-400 font-bold">{cropBox.width}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max={100 - cropBox.x}
                    value={cropBox.width}
                    onChange={(e) => setCropBox((prev) => ({ ...prev, width: Number(e.target.value) }))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1.5 font-medium">
                    <span>Height</span>
                    <span className="text-indigo-400 font-bold">{cropBox.height}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max={100 - cropBox.y}
                    value={cropBox.height}
                    onChange={(e) => setCropBox((prev) => ({ ...prev, height: Number(e.target.value) }))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Hand Crop Tips */}
              <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                <div className="font-semibold text-neutral-200 flex items-center space-x-1">
                  <Hand className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Hand Gestures</span>
                </div>
                <p>• Click & drag anywhere inside the blue box to move it.</p>
                <p>• Drag any of the 8 white dots to resize in any direction.</p>
                <p>• Click and drag anywhere on the uncropped image to draw a new box.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
