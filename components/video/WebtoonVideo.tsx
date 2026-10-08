import React from 'react';
import { AbsoluteFill, Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { dissolve } from '@remotion/transitions/dissolve';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { pushCut } from '@remotion/transitions/push-cut';
import { blurSlide } from '@remotion/transitions/blur-slide';
import { linearBlur } from '@remotion/transitions/linear-blur';
import { crossZoom } from '@remotion/transitions/cross-zoom';
import { zoomInOut } from '@remotion/transitions/zoom-in-out';
import { iris } from '@remotion/transitions/iris';
import { flip } from '@remotion/transitions/flip';
import { FPS, TRANSITION_FRAMES, interpolateCamera } from '@/lib/video/camera';
import { chunkAt, subtitleChunks } from '@/lib/video/subtitles';
import CleanedImage from './CleanedImage';

const subtitleText: React.CSSProperties = {
  fontFamily: 'Arial, "Nirmala UI", "Noto Sans Devanagari", Mangal, sans-serif',
  fontWeight: 700,
  lineHeight: 1.35,
  textAlign: 'center',
};
import { hasTransitionIn, type SceneTransition, type VideoScene, type WebtoonVideoProps } from '@/lib/video/project';

function presentationFor(t: SceneTransition, width: number, height: number): TransitionPresentation<any> {
  switch (t) {
    case 'dissolve': return dissolve({});
    case 'slide': return slide({ direction: 'from-right' });
    case 'wipe': return wipe({ direction: 'from-right' });
    case 'push-cut': return pushCut();
    case 'blur-slide': return blurSlide({ direction: 'from-right' });
    case 'linear-blur': return linearBlur({ intensity: 0.6 });
    case 'cross-zoom': return crossZoom({ strength: 0.4 });
    case 'zoom-in-out': return zoomInOut({});
    case 'iris': return iris({ width, height });
    case 'flip': return flip({ direction: 'from-right' });
    default: return fade();
  }
}

const Vignette: React.FC = () => {
  const edge = 'rgba(0,0,0,0.78)';
  const clear = 'rgba(0,0,0,0)';
  return (
    <>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(to bottom, ${edge}, ${clear} 28%)` }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(to top, ${edge}, ${clear} 28%)` }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(to right, ${edge}, ${clear} 22%)` }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(to left, ${edge}, ${clear} 22%)` }} />
    </>
  );
};

const SpeedLines: React.FC<{ frame: number }> = ({ frame }) => {
  const rot = (frame * 0.6 * Math.PI) / 180;
  return (
    <AbsoluteFill style={{ opacity: 0.4 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i * 7.5 * Math.PI) / 180 + rot;
          const inner = 34 + (i % 3) * 4;
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * inner}
              y1={50 + Math.sin(a) * inner}
              x2={50 + Math.cos(a) * 90}
              y2={50 + Math.sin(a) * 90}
              stroke="white"
              strokeWidth={i % 2 === 0 ? 0.6 : 0.3}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

const Letterbox: React.FC<{ barHeight: number }> = ({ barHeight }) => (
  <>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: barHeight, backgroundColor: '#000' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: barHeight, backgroundColor: '#000' }} />
  </>
);

const FilmGrain: React.FC<{ frame: number; w: number; h: number }> = ({ frame, w, h }) => {
  const seed = frame * 7 + 31;
  return (
    <AbsoluteFill style={{ opacity: 0.12 }}>
      <svg width={w} height={h}>
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

const RainOverlay: React.FC<{ frame: number; w: number; h: number }> = ({ frame, w, h }) => {
  const drops = 80;
  return (
    <AbsoluteFill style={{ opacity: 0.35 }}>
      <svg width={w} height={h}>
        {Array.from({ length: drops }, (_, i) => {
          const x = ((i * 37 + 13) % 100) * w / 100;
          const speed = 4 + (i % 5) * 1.5;
          const y = ((frame * speed + i * 41) % (h + 60)) - 30;
          const len = 12 + (i % 4) * 6;
          return (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x - 2}
              y2={y + len}
              stroke="rgba(180,200,255,0.7)"
              strokeWidth={0.8 + (i % 3) * 0.3}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

const ParticlesOverlay: React.FC<{ frame: number; w: number; h: number }> = ({ frame, w, h }) => {
  const count = 30;
  return (
    <AbsoluteFill style={{ opacity: 0.4 }}>
      <svg width={w} height={h}>
        {Array.from({ length: count }, (_, i) => {
          const baseX = ((i * 53 + 17) % 100) * w / 100;
          const phase = i * 0.8;
          const x = baseX + Math.sin((frame * 0.02 + phase) * Math.PI) * 20;
          const y = ((h + 20) - ((frame * (0.3 + (i % 5) * 0.15) + i * 47) % (h + 40)));
          const r = 1.5 + (i % 4) * 0.8;
          return (
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.8)" />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

const MangaTone: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <AbsoluteFill style={{ opacity: 0.08 }}>
    <svg width={w} height={h}>
      <pattern id="halftone" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.2" fill="#000" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#halftone)" />
    </svg>
  </AbsoluteFill>
);

const SceneView: React.FC<{ scene: VideoScene; showSubtitles: boolean }> = ({ scene, showSubtitles }) => {
  const frame = useCurrentFrame();
  const { width: FW, height: FH } = useVideoConfig();

  const progress = scene.durationInFrames > 1 ? frame / (scene.durationInFrames - 1) : 0;
  const k = interpolateCamera(scene.camera, progress);

  let zoom = k.zoom;
  let dx = 0;
  let dy = 0;
  const t = frame / FPS;
  if (scene.cameraFx === 'pulse') zoom *= 1 + 0.025 * Math.sin(t * Math.PI * 1.6);
  if (scene.cameraFx === 'shake') {
    const amp = Math.min(FW, FH) * 0.008;
    dx = (random(`${scene.id}-x-${frame}`) - 0.5) * 2 * amp;
    dy = (random(`${scene.id}-y-${frame}`) - 0.5) * 2 * amp;
  }
  if (scene.cameraFx === 'float') {
    const amp = Math.min(FW, FH) * 0.004;
    dx = Math.sin(t * 0.7) * amp;
    dy = Math.cos(t * 0.5) * amp * 0.6;
  }
  if (scene.cameraFx === 'heartbeat') {
    const beat = (t * 1.2) % 1;
    const pulse = beat < 0.15 ? Math.sin(beat / 0.15 * Math.PI) * 0.04
      : beat < 0.35 ? Math.sin((beat - 0.2) / 0.15 * Math.PI) * 0.025 : 0;
    zoom *= 1 + pulse;
  }
  if (scene.cameraFx === 'zoom-pulse') {
    zoom *= 1 + 0.035 * Math.sin(t * Math.PI * 1.2);
  }
  if (scene.cameraFx === 'breathe') {
    zoom *= 1 + 0.018 * Math.sin(t * Math.PI * 0.6);
    dy += Math.sin(t * Math.PI * 0.6) * Math.min(FW, FH) * 0.002;
  }

  const imgW = zoom * FW;
  const imgH = (imgW * scene.imageHeight) / scene.imageWidth;
  const left = FW / 2 - k.cx * imgW + dx;
  const top = FH / 2 - k.cy * imgH + dy;
  const coversFrame = left <= 0.5 && top <= 0.5 && left + imgW >= FW - 0.5 && top + imgH >= FH - 0.5;
  // Stacked bilingual captions: English on top, Hindi below, each advancing through its own chunks
  const subtitleEn = showSubtitles ? chunkAt(subtitleChunks(scene.narration), progress) : '';
  const subtitleHi = showSubtitles ? chunkAt(subtitleChunks(scene.narrationHi), progress) : '';
  const subtitleSize = Math.round(Math.min(FW, FH) * 0.036);

  const imageFilter = (() => {
    switch (scene.visualFx) {
      case 'bloom': return 'brightness(1.08) saturate(1.25) contrast(1.05)';
      case 'sepia': return 'sepia(0.7) saturate(1.1) brightness(1.05)';
      case 'high-contrast': return 'contrast(1.5) saturate(1.2) brightness(0.95)';
      case 'noir': return 'grayscale(1) contrast(1.6) brightness(0.9)';
      case 'color-wash-warm': return 'sepia(0.25) saturate(1.3) brightness(1.05) hue-rotate(-10deg)';
      case 'color-wash-cool': return 'saturate(0.9) brightness(1.0) hue-rotate(20deg)';
      case 'focus-blur': return 'contrast(1.05) saturate(1.1)';
      default: return undefined;
    }
  })();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {!coversFrame && (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img
            src={scene.src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(48px) brightness(0.38)',
              transform: 'scale(1.2)',
            }}
          />
        </AbsoluteFill>
      )}

      <div style={{ position: 'absolute', left, top, width: imgW, height: imgH }}>
        <CleanedImage
          segments={scene.segments}
          hideBoxes={scene.hideBoxes}
          blurPx={Math.max(8, imgW * 0.015)}
          imageFilter={imageFilter}
          renderImg={(style) => <Img src={scene.src} style={style} />}
        />
      </div>

      {scene.visualFx === 'vignette' && <Vignette />}
      {scene.visualFx === 'speed-lines' && <SpeedLines frame={frame} />}
      {scene.visualFx === 'bloom' && <AbsoluteFill style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />}
      {scene.visualFx === 'flash' && (
        <AbsoluteFill
          style={{
            backgroundColor: '#fff',
            opacity: interpolate(frame, [0, 10], [0.95, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        />
      )}
      {scene.visualFx === 'letterbox' && <Letterbox barHeight={Math.round(FH * 0.1)} />}
      {scene.visualFx === 'film-grain' && <FilmGrain frame={frame} w={FW} h={FH} />}
      {scene.visualFx === 'rain' && <RainOverlay frame={frame} w={FW} h={FH} />}
      {scene.visualFx === 'particles' && <ParticlesOverlay frame={frame} w={FW} h={FH} />}
      {scene.visualFx === 'manga-tone' && <MangaTone w={FW} h={FH} />}
      {scene.visualFx === 'color-wash-warm' && (
        <AbsoluteFill style={{ backgroundColor: 'rgba(255, 140, 50, 0.08)' }} />
      )}
      {scene.visualFx === 'color-wash-cool' && (
        <AbsoluteFill style={{ backgroundColor: 'rgba(50, 100, 255, 0.08)' }} />
      )}
      {scene.visualFx === 'focus-blur' && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: FH * 0.15, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: FH * 0.15, background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: FW * 0.08, background: 'linear-gradient(to right, rgba(0,0,0,0.25), transparent)' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: FW * 0.08, background: 'linear-gradient(to left, rgba(0,0,0,0.25), transparent)' }} />
        </>
      )}

      {showSubtitles && (subtitleEn || subtitleHi) && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: FH * 0.06 }}>
          <div
            style={{
              maxWidth: FW * 0.86,
              backgroundColor: 'rgba(0,0,0,0.72)',
              textAlign: 'center',
              padding: `${Math.round(FH * 0.012)}px ${Math.round(FW * 0.022)}px`,
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {subtitleEn && (
              <div style={{ ...subtitleText, fontSize: subtitleSize, color: '#ffffff' }}>{subtitleEn}</div>
            )}
            {subtitleHi && (
              <div
                style={{
                  ...subtitleText,
                  fontSize: Math.round(subtitleSize * 0.95),
                  color: '#fde68a',
                  marginTop: subtitleEn ? Math.round(subtitleSize * 0.25) : 0,
                }}
              >
                {subtitleHi}
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {scene.audioUrl && <Audio src={scene.audioUrl} />}
    </AbsoluteFill>
  );
};

export const WebtoonVideo: React.FC<WebtoonVideoProps> = ({ scenes, showSubtitles }) => {
  const { width, height } = useVideoConfig();
  if (scenes.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: '#000' }} />;
  }

  const children: React.ReactNode[] = [];
  scenes.forEach((scene, i) => {
    if (hasTransitionIn(scenes, i)) {
      children.push(
        <TransitionSeries.Transition
          key={`t-${scene.id}`}
          presentation={presentationFor(scene.transition, width, height)}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
      );
    }
    children.push(
      <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationInFrames} premountFor={FPS}>
        <SceneView scene={scene} showSubtitles={showSubtitles} />
      </TransitionSeries.Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
};
