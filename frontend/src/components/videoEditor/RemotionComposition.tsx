import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { Scene, Subtitle, DEFAULT_SUBTITLE_STYLE } from './types';

export interface RemotionCompositionProps extends Record<string, unknown> {
  scenes: Scene[];
}

export const RemotionComposition: React.FC<RemotionCompositionProps> = ({ scenes }) => {
  const { fps } = useVideoConfig();
  const safeScenes = scenes || [];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
      {safeScenes.map((scene, index) => {
        const durationInFrames = Math.max(1, Math.round(scene.duration * fps));
        const startInFrames = safeScenes
          .slice(0, index)
          .reduce((sum, s) => sum + Math.max(1, Math.round(s.duration * fps)), 0);

        return (
          <Sequence key={scene.id || index} from={startInFrames} durationInFrames={durationInFrames}>
            <SceneRenderer scene={scene} />
            <SubtitleRenderer subtitles={scene.subtitles} />
            <AudioRenderer scene={scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const SceneRenderer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalFrames = Math.max(1, scene.duration * fps);

  const getEffectStyle = (): React.CSSProperties => {
    switch (scene.effect) {
      case 'kenburns': {
        const scale = interpolate(frame, [0, totalFrames], [1.0, 1.2], {
          extrapolateRight: 'clamp',
        });
        const x = interpolate(frame, [0, totalFrames], [0, -4], {
          extrapolateRight: 'clamp',
        });
        const y = interpolate(frame, [0, totalFrames], [0, -2], {
          extrapolateRight: 'clamp',
        });
        return {
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
          transformOrigin: 'center center',
        };
      }
      case 'zoom-in': {
        const scale = interpolate(frame, [0, totalFrames], [1.0, 1.25], {
          extrapolateRight: 'clamp',
        });
        return {
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        };
      }
      case 'zoom-out': {
        const scale = interpolate(frame, [0, totalFrames], [1.25, 1.0], {
          extrapolateRight: 'clamp',
        });
        return {
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        };
      }
      case 'pan-left': {
        const x = interpolate(frame, [0, totalFrames], [4, -4], {
          extrapolateRight: 'clamp',
        });
        return {
          transform: `scale(1.15) translateX(${x}%)`,
          transformOrigin: 'center center',
        };
      }
      case 'pan-right': {
        const x = interpolate(frame, [0, totalFrames], [-4, 4], {
          extrapolateRight: 'clamp',
        });
        return {
          transform: `scale(1.15) translateX(${x}%)`,
          transformOrigin: 'center center',
        };
      }
      case 'fade': {
        const fadeInFrames = Math.min(15, totalFrames * 0.2);
        const fadeOutFrames = Math.min(15, totalFrames * 0.2);
        const opacity = interpolate(
          frame,
          [0, fadeInFrames, totalFrames - fadeOutFrames, totalFrames],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        return { opacity };
      }
      case 'crossfade': {
        const opacity = interpolate(frame, [0, Math.min(20, totalFrames * 0.3)], [0, 1], {
          extrapolateRight: 'clamp',
        });
        return { opacity };
      }
      case 'wipe': {
        const clipPercent = interpolate(frame, [0, Math.min(20, totalFrames * 0.3)], [0, 100], {
          extrapolateRight: 'clamp',
        });
        return {
          clipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
        };
      }
      default:
        return {};
    }
  };

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <Img
        src={scene.imageUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          ...getEffectStyle(),
        }}
      />
    </AbsoluteFill>
  );
};

const SubtitleRenderer: React.FC<{ subtitles?: Subtitle[] }> = ({ subtitles = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeInSeconds = frame / fps;

  const activeSubtitles = subtitles.filter(
    (sub) => currentTimeInSeconds >= sub.startTime && currentTimeInSeconds <= sub.endTime
  );

  if (activeSubtitles.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {activeSubtitles.map((sub) => {
        const style = { ...DEFAULT_SUBTITLE_STYLE, ...(sub.style || {}) };
        const fadeIn = interpolate(
          currentTimeInSeconds,
          [sub.startTime, sub.startTime + 0.25],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        const fadeOut = interpolate(
          currentTimeInSeconds,
          [sub.endTime - 0.25, sub.endTime],
          [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        const opacity = Math.min(fadeIn, fadeOut);

        const pos = style.position || 'bottom';
        let posStyle: React.CSSProperties = { bottom: '8%' };
        if (pos === 'top') posStyle = { top: '8%' };
        if (pos === 'center') posStyle = { top: '50%', transform: 'translateY(-50%)' };

        return (
          <div
            key={sub.id}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              ...posStyle,
              display: 'flex',
              justifyContent: 'center',
              padding: '0 40px',
              opacity,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div
              style={{
                fontSize: style.fontSize || 32,
                fontFamily: style.fontFamily || 'Outfit, sans-serif',
                color: style.color || '#ffffff',
                backgroundColor: style.backgroundColor || 'rgba(0, 0, 0, 0.75)',
                fontWeight: style.bold !== false ? 700 : 400,
                fontStyle: style.italic ? 'italic' : 'normal',
                padding: '10px 24px',
                borderRadius: '12px',
                textAlign: 'center',
                maxWidth: '85%',
                lineHeight: 1.4,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                textShadow: style.outline !== false ? '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)' : 'none',
                backdropFilter: 'blur(8px)',
              }}
            >
              {sub.text}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const AudioRenderer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { fps } = useVideoConfig();
  const clips = scene.audioClips || [];

  return (
    <>
      {clips.map((audio) => (
        <Sequence
          key={audio.id}
          from={Math.round((audio.startTime || 0) * fps)}
          durationInFrames={Math.max(1, Math.round((audio.duration || scene.duration) * fps))}
        >
          <Audio src={audio.url} volume={audio.volume ?? 1} />
        </Sequence>
      ))}
    </>
  );
};
