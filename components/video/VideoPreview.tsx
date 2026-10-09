'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Play, Pause, Maximize2 } from 'lucide-react';
import { FPS, FRAME_SIZE, type Aspect } from '@/lib/video/camera';
import { computeTimeline, sceneIndexAtFrame } from '@/lib/video/project';
import type { VideoScene } from '@/lib/video/project';
import { drawCompositionFrame } from '@/lib/video/canvasRender';

/**
 * Canvas player that replaces the Remotion Player — same frame-accurate model
 * (seekTo/getCurrentFrame + timeupdate/seeked/play/pause events) so the studio
 * wiring stays identical.
 */
export class PreviewPlayer extends EventTarget {
  frame = 0;
  durationInFrames = 1;
  playing = false;

  private emit(type: string, detail?: any) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  seekTo(f: number) {
    this.frame = Math.max(0, Math.min(this.durationInFrames - 1, Math.round(f)));
    this.emit('seeked', { frame: this.frame });
    this.emit('timeupdate', { frame: this.frame });
  }

  getCurrentFrame() {
    return this.frame;
  }

  play() {
    if (this.playing) return;
    if (this.frame >= this.durationInFrames - 1) this.frame = 0;
    this.playing = true;
    this.emit('play');
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.emit('pause');
    this.emit('timeupdate', { frame: this.frame });
  }

  isPlaying() {
    return this.playing;
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }
}

interface Props {
  scenes: VideoScene[];
  aspect: Aspect;
  showSubtitles: boolean;
  player: PreviewPlayer;
  style?: React.CSSProperties;
}

const VideoPreview = forwardRef<HTMLDivElement, Props>(function VideoPreview(
  { scenes, aspect, showSubtitles, player, style },
  ref
) {
  const { width: FW, height: FH } = FRAME_SIZE[aspect];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const scratchRef = useRef({});
  const audioRef = useRef(new Map<string, HTMLAudioElement>());
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const propsRef = useRef({ scenes, aspect, showSubtitles });
  propsRef.current = { scenes, aspect, showSubtitles };
  const [playing, setPlaying] = useState(false);
  const [curFrame, setCurFrame] = useState(0);

  const { durationInFrames } = computeTimeline(scenes);
  player.durationInFrames = Math.max(1, durationInFrames);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawCompositionFrame(
      ctx,
      { scenes: propsRef.current.scenes, aspect: propsRef.current.aspect, showSubtitles: propsRef.current.showSubtitles },
      player.frame,
      imagesRef.current,
      scratchRef.current
    );
  }, [player]);

  /* Scene images — lazy load into the cache, redraw once ready */
  useEffect(() => {
    for (const s of scenes) {
      if (!imagesRef.current.has(s.src)) {
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.onload = draw;
        img.src = s.src;
        imagesRef.current.set(s.src, img);
      }
    }
    draw();
  }, [scenes, draw]);

  /* Scene audio elements */
  useEffect(() => {
    for (const s of scenes) {
      if (s.audioUrl && !audioRef.current.has(s.id)) {
        const el = new Audio(s.audioUrl);
        el.preload = 'auto';
        audioRef.current.set(s.id, el);
      }
    }
  }, [scenes]);

  /* Keep scene audio aligned with the playhead */
  const syncAudio = useCallback(
    (frame: number) => {
      const { scenes: sc } = propsRef.current;
      const { starts: st } = computeTimeline(sc);
      const idx = sceneIndexAtFrame(sc, st, frame);
      sc.forEach((s, i) => {
        const el = audioRef.current.get(s.id);
        if (!el) return;
        const localSec = (frame - st[i]) / FPS;
        const active = i === idx && player.playing && localSec >= 0 && localSec <= s.durationInFrames / FPS;
        if (active) {
          if (Math.abs(el.currentTime - localSec) > 0.3) el.currentTime = localSec;
          if (el.paused) el.play().catch(() => {});
        } else if (!el.paused) {
          el.pause();
        }
      });
    },
    [player]
  );

  /* Player events → local state + audio sync */
  useEffect(() => {
    const onTime = (e: Event) => {
      const f = (e as CustomEvent).detail.frame;
      setCurFrame(f);
      syncAudio(f);
      draw();
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener('timeupdate', onTime);
    player.addEventListener('seeked', onTime);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('timeupdate', onTime);
      player.removeEventListener('seeked', onTime);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [player, syncAudio, draw]);

  /* Playback loop */
  useEffect(() => {
    if (!playing) return;
    let alive = true;
    lastTsRef.current = 0;
    const step = (ts: number) => {
      if (!alive || !player.playing) return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const next = player.frame + dt * FPS;
      if (next >= player.durationInFrames - 0.5) {
        player.frame = player.durationInFrames - 1;
        player.pause();
      } else {
        player.frame = Math.floor(next);
        player.dispatchEvent(new CustomEvent('timeupdate', { detail: { frame: player.frame } }));
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing, player]);

  /* Pause audio + player on unmount */
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current.forEach((el) => el.pause());
    },
    []
  );

  const fmt = (f: number) => `${(f / FPS).toFixed(1)}s`;

  return (
    <div ref={ref} className="absolute inset-0 flex flex-col bg-black" style={style}>
      <div ref={boxRef} className="relative flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          width={FW}
          height={FH}
          className="absolute inset-0 w-full h-full cursor-pointer"
          onClick={() => player.toggle()}
          onDoubleClick={() => boxRef.current?.requestFullscreen?.()}
        />
      </div>
      {/* Minimal player controls */}
      <div className="flex items-center space-x-2 bg-neutral-950/95 px-3 py-1.5 select-none">
        <button
          type="button"
          onClick={() => player.toggle()}
          className="text-white hover:text-indigo-400 transition-colors"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(1, durationInFrames - 1)}
          value={curFrame}
          onChange={(e) => player.seekTo(Number(e.target.value))}
          className="flex-1 h-1 accent-indigo-500 cursor-pointer"
        />
        <span className="text-[10px] text-neutral-400 font-mono whitespace-nowrap">
          {fmt(curFrame)} / {fmt(durationInFrames)}
        </span>
        <button
          type="button"
          onClick={() => boxRef.current?.requestFullscreen?.()}
          className="text-neutral-400 hover:text-white transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

export default VideoPreview;
