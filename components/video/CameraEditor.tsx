'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDownRight,
  ArrowDownLeft,
  Copy,
  Focus,
  GalleryVertical,
  Maximize2,
  Move,
  MoveHorizontal,
  Orbit,
  Pause,
  Wind,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Aspect,
  Camera,
  CameraPreset,
  Easing,
  Keyframe,
  MAX_ZOOM,
  MIN_ZOOM,
  clampKeyframe,
  presetCamera,
  visibleHalf,
} from '@/lib/video/camera';
import type { HideBox, Segment } from '@/lib/video/cleanup';
import CleanedImage from './CleanedImage';

type Key = 'start' | 'end';

interface Props {
  src: string;
  imageWidth: number;
  /** Cleaned image height (after cut bands are removed). */
  imageHeight: number;
  segments: Segment[];
  hideBoxes: HideBox[];
  aspect: Aspect;
  camera: Camera;
  liveKeyframe?: Keyframe | null;
  onChange: (camera: Camera) => void;
  /** Total scene count — enables the "apply to all scenes" toggle. */
  totalScenes?: number;
  /** Called when a preset is clicked while "apply to all" is on. */
  onApplyPresetToAll?: (preset: CameraPreset) => void;
}

const KEY_STYLE: Record<Key, { border: string; bg: string; label: string }> = {
  start: { border: 'border-emerald-400', bg: 'bg-emerald-500', label: 'START' },
  end: { border: 'border-rose-400', bg: 'bg-rose-500', label: 'END' },
};

const PRESETS: { id: CameraPreset; label: string; icon: React.ReactNode; group: string }[] = [
  // Basic
  { id: 'read-down', label: 'Read ↓', icon: <ArrowDown className="w-3 h-3" />, group: 'Basic' },
  { id: 'read-up', label: 'Read ↑', icon: <ArrowUp className="w-3 h-3" />, group: 'Basic' },
  { id: 'slideshow', label: 'Slides', icon: <GalleryVertical className="w-3 h-3" />, group: 'Basic' },
  { id: 'hold', label: 'Hold', icon: <Pause className="w-3 h-3" />, group: 'Basic' },
  { id: 'zoom-in', label: 'Zoom In', icon: <ZoomIn className="w-3 h-3" />, group: 'Basic' },
  { id: 'zoom-out', label: 'Zoom Out', icon: <ZoomOut className="w-3 h-3" />, group: 'Basic' },
  { id: 'full-page', label: 'Full Page', icon: <Maximize2 className="w-3 h-3" />, group: 'Basic' },
  // Cinematic
  { id: 'pan-left', label: 'Pan ←', icon: <ArrowLeft className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'pan-right', label: 'Pan →', icon: <ArrowRight className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'diagonal-dr', label: 'Diagonal ↘', icon: <ArrowDownRight className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'diagonal-dl', label: 'Diagonal ↙', icon: <ArrowDownLeft className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'dolly-in', label: 'Dolly In', icon: <Move className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'crane-down', label: 'Crane ↓', icon: <MoveHorizontal className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'focus-pull', label: 'Focus Pull', icon: <Focus className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'orbit', label: 'Orbit', icon: <Orbit className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'whip-pan', label: 'Whip Pan', icon: <Zap className="w-3 h-3" />, group: 'Cinematic' },
  { id: 'drift', label: 'Drift', icon: <Wind className="w-3 h-3" />, group: 'Cinematic' },
];

export default function CameraEditor({
  src,
  imageWidth: iw,
  imageHeight: ih,
  segments,
  hideBoxes,
  aspect,
  camera,
  liveKeyframe,
  onChange,
  totalScenes = 0,
  onApplyPresetToAll,
}: Props) {
  const [activeKey, setActiveKey] = useState<Key>('start');
  const [applyToAll, setApplyToAll] = useState(false);
  const [frozenWidthFrac, setFrozenWidthFrac] = useState<number | null>(null);
  const imgBoxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rectOf = (k: Keyframe) => {
    const { hw, hh } = visibleHalf(k, aspect, iw, ih);
    return { left: k.cx - hw, top: k.cy - hh, width: hw * 2, height: hh * 2 };
  };

  // Shrink the page preview when a view is wider than the page (zoomed-out column), but never mid-drag
  const neededWidth = Math.max(1, rectOf(camera.start).width, rectOf(camera.end).width);
  const pageWidthFrac = frozenWidthFrac ?? 1 / neededWidth;

  useEffect(() => {
    const box = imgBoxRef.current;
    const scroller = scrollRef.current;
    if (!box || !scroller) return;
    const r = rectOf(camera[activeKey]);
    const h = box.getBoundingClientRect().height;
    const top = r.top * h;
    const bottom = (r.top + r.height) * h;
    if (top < scroller.scrollTop || bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTo({ top: Math.max(0, top - 24), behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const update = (key: Key, k: Keyframe) => onChange({ ...camera, [key]: clampKeyframe(k, aspect, iw, ih) });

  const toImageFrac = (clientX: number, clientY: number) => {
    const rect = imgBoxRef.current!.getBoundingClientRect();
    return { fx: (clientX - rect.left) / rect.width, fy: (clientY - rect.top) / rect.height };
  };

  const startDrag = (e: React.PointerEvent, key: Key, mode: 'move' | 'resize' | 'jump') => {
    e.preventDefault();
    e.stopPropagation();
    if (!imgBoxRef.current) return;
    setActiveKey(key);
    setFrozenWidthFrac(pageWidthFrac);

    const origin = toImageFrac(e.clientX, e.clientY);
    const init = camera[key];
    const { hw, hh } = visibleHalf(init, aspect, iw, ih);
    const ratio = hw / hh;
    let latest = camera;

    const apply = (clientX: number, clientY: number) => {
      const { fx, fy } = toImageFrac(clientX, clientY);
      let next: Keyframe;
      if (mode === 'move') next = { ...init, cx: init.cx + fx - origin.fx, cy: init.cy + fy - origin.fy };
      else if (mode === 'jump') next = { ...init, cx: fx, cy: fy };
      else {
        const newHw = Math.max(Math.abs(fx - init.cx), Math.abs(fy - init.cy) * ratio, 0.01);
        next = { ...init, zoom: 0.5 / newHw };
      }
      latest = { ...latest, [key]: clampKeyframe(next, aspect, iw, ih) };
      onChange(latest);
    };
    if (mode === 'jump') apply(e.clientX, e.clientY);

    const onMove = (ev: PointerEvent) => apply(ev.clientX, ev.clientY);
    const onUp = () => {
      setFrozenWidthFrac(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const active = camera[activeKey];
  const renderRect = (key: Key) => {
    const r = rectOf(camera[key]);
    const s = KEY_STYLE[key];
    const isActive = key === activeKey;
    return (
      <div
        key={key}
        onPointerDown={(e) => startDrag(e, key, 'move')}
        className={`absolute border-2 ${s.border} cursor-move ${isActive ? 'z-20' : 'z-10 opacity-70'}`}
        style={{
          left: `${r.left * 100}%`,
          top: `${r.top * 100}%`,
          width: `${r.width * 100}%`,
          height: `${r.height * 100}%`,
          boxShadow: isActive ? '0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.4)' : undefined,
        }}
      >
        <span className={`absolute top-0 left-0 ${s.bg} text-white text-[9px] font-bold px-1.5 py-0.5 select-none`}>
          {s.label} · {camera[key].zoom.toFixed(2)}x
        </span>
        {(['-top-1.5 -left-1.5', '-top-1.5 -right-1.5', '-bottom-1.5 -left-1.5', '-bottom-1.5 -right-1.5'] as const).map((pos) => (
          <div
            key={pos}
            onPointerDown={(e) => startDrag(e, key, 'resize')}
            className={`absolute ${pos} w-3 h-3 bg-white border-2 ${s.border} rounded-full cursor-nwse-resize`}
          />
        ))}
      </div>
    );
  };

  const liveRect = liveKeyframe ? rectOf(clampKeyframe(liveKeyframe, aspect, iw, ih)) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
          {(['start', 'end'] as Key[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setActiveKey(k)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                activeKey === k ? `${KEY_STYLE[k].bg} text-white` : 'text-neutral-400 hover:text-white'
              }`}
            >
              {KEY_STYLE[k].label}
            </button>
          ))}
        </div>
        <select
          value={camera.easing}
          onChange={(e) => onChange({ ...camera, easing: e.target.value as Easing })}
          className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="linear">Linear (steady scroll)</option>
          <option value="ease-in-out">Ease In-Out (cinematic)</option>
          <option value="ease-out">Ease Out (fast → slow)</option>
          <option value="ease-in">Ease In (slow → fast)</option>
          <option value="steps">Steps (slideshow)</option>
        </select>
      </div>

      <div ref={scrollRef} className="relative h-[420px] overflow-y-auto overflow-x-hidden bg-neutral-950 rounded-xl border border-neutral-800">
        <div className="relative mx-auto py-3" style={{ width: `${pageWidthFrac * 100}%` }}>
          <div
            ref={imgBoxRef}
            onPointerDown={(e) => startDrag(e, activeKey, 'jump')}
            className="relative cursor-crosshair select-none"
            style={{ aspectRatio: `${iw} / ${ih}` }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <CleanedImage
                segments={segments}
                hideBoxes={hideBoxes}
                blurPx={4}
                renderImg={(style) => (
                  <img src={src} alt="" referrerPolicy="no-referrer" draggable={false} style={style} className="select-none" />
                )}
              />
            </div>
            {liveRect && (
              <div
                className="absolute border-2 border-dashed border-white/80 pointer-events-none z-30"
                style={{
                  left: `${liveRect.left * 100}%`,
                  top: `${liveRect.top * 100}%`,
                  width: `${liveRect.width * 100}%`,
                  height: `${liveRect.height * 100}%`,
                }}
              />
            )}
            {(['start', 'end'] as Key[]).filter((k) => k !== activeKey).map(renderRect)}
            {renderRect(activeKey)}
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
          <span>{KEY_STYLE[activeKey].label} zoom (how much is visible)</span>
          <span className="font-mono text-indigo-300">{active.zoom.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={active.zoom}
          onChange={(e) => update(activeKey, { ...active, zoom: Number(e.target.value) })}
          className="w-full accent-indigo-500"
        />
      </div>

      {onApplyPresetToAll && totalScenes > 1 && (
        <label className={`flex items-center space-x-2 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
          applyToAll
            ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600'
        }`}>
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="accent-indigo-500"
          />
          <span>Apply presets to all {totalScenes} scenes</span>
        </label>
      )}

      {(['Basic', 'Cinematic'] as const).map((group) => (
        <div key={group} className="space-y-1.5">
          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{group}</span>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.filter((p) => p.group === group).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  applyToAll && onApplyPresetToAll
                    ? onApplyPresetToAll(p.id)
                    : onChange(presetCamera(p.id, aspect, iw, ih, camera))
                }
                className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[11px] text-neutral-200 flex items-center justify-center space-x-1"
              >
                {p.icon}
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ ...camera, start: camera.end, end: camera.start })}
          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[11px] text-neutral-200 flex items-center justify-center space-x-1"
        >
          <ArrowLeftRight className="w-3 h-3" />
          <span>Swap</span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...camera, end: camera.start })}
          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[11px] text-neutral-200 flex items-center justify-center space-x-1"
        >
          <Copy className="w-3 h-3" />
          <span>End = Start</span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...camera, start: camera.end })}
          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[11px] text-neutral-200 flex items-center justify-center space-x-1"
        >
          <Copy className="w-3 h-3" />
          <span>Start = End</span>
        </button>
      </div>

      <p className="text-[10px] text-neutral-500 leading-relaxed">
        Drag a box to choose what is on screen, drag its corner dots to zoom, or click the page to jump the selected
        box there. The camera moves from START to END over the scene. Dashed box = playhead position.
      </p>
    </div>
  );
}
