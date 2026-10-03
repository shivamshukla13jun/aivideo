import React from 'react';
import { AbsoluteFill, Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
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

function presentationFor(t: SceneTransition): TransitionPresentation<any> {
  if (t === 'slide') return slide({ direction: 'from-right' });
  if (t === 'wipe') return wipe({ direction: 'from-right' });
  return fade();
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

const SceneView: React.FC<{ scene: VideoScene; showSubtitles: boolean }> = ({ scene, showSubtitles }) => {
  const frame = useCurrentFrame();
  const { width: FW, height: FH } = useVideoConfig();

  const progress = scene.durationInFrames > 1 ? frame / (scene.durationInFrames - 1) : 0;
  const k = interpolateCamera(scene.camera, progress);

  let zoom = k.zoom;
  let dx = 0;
  let dy = 0;
  if (scene.cameraFx === 'pulse') zoom *= 1 + 0.025 * Math.sin((frame / FPS) * Math.PI * 1.6);
  if (scene.cameraFx === 'shake') {
    const amp = Math.min(FW, FH) * 0.008;
    dx = (random(`${scene.id}-x-${frame}`) - 0.5) * 2 * amp;
    dy = (random(`${scene.id}-y-${frame}`) - 0.5) * 2 * amp;
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

  const imageFilter = scene.visualFx === 'bloom' ? 'brightness(1.08) saturate(1.25) contrast(1.05)' : undefined;

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

export const WebtoonVideo: React.FC<WebtoonVideoProps> = ({
  scenes,
  showSubtitles,
  globalAudioUrl,
  globalAudioVolume = 1,
}) => {
  if (scenes.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: '#000' }} />;
  }

  const children: React.ReactNode[] = [];
  scenes.forEach((scene, i) => {
    if (hasTransitionIn(scenes, i)) {
      children.push(
        <TransitionSeries.Transition
          key={`t-${scene.id}`}
          presentation={presentationFor(scene.transition)}
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
      {globalAudioUrl && (
        <Audio src={globalAudioUrl} volume={typeof globalAudioVolume === 'number' ? globalAudioVolume : 1} />
      )}
    </AbsoluteFill>
  );
};
