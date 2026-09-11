import React, { useState, useRef } from 'react';
import { X, Download, Film, CheckCircle2, Loader2, Sparkles, Monitor } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Scene, VideoProject, ASPECT_RATIOS } from '../types/video';
import { api } from '../services/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: VideoProject;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, project }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [resolution, setResolution] = useState<'1080p' | '720p'>('1080p');
  const [exportMode, setExportMode] = useState<'browser' | 'server'>('browser');
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!isOpen) return null;

  const handleExportClientSide = async () => {
    setIsExporting(true);
    setProgress(0);
    setProgressText('Preparing slideshow frames & effects...');
    setError(null);
    setExportedVideoUrl(null);

    const baseDim = ASPECT_RATIOS[project.aspectRatio] || ASPECT_RATIOS['16:9'];
    const scaleFactor = resolution === '720p' ? 0.666 : 1.0;
    const width = Math.round(baseDim.width * scaleFactor);
    const height = Math.round(baseDim.height * scaleFactor);
    const fps = 30;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setError('Could not initialize 2D rendering canvas.');
      setIsExporting(false);
      return;
    }

    try {
      // Step 1: Preload all images
      setProgressText('Preloading scene media...');
      const loadedImages: HTMLImageElement[] = await Promise.all(
        project.scenes.map((scene, i) => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => {
              // Fallback placeholder canvas
              const fallbackCanvas = document.createElement('canvas');
              fallbackCanvas.width = width;
              fallbackCanvas.height = height;
              const fctx = fallbackCanvas.getContext('2d')!;
              fctx.fillStyle = '#1e293b';
              fctx.fillRect(0, 0, width, height);
              fctx.fillStyle = '#06b6d4';
              fctx.font = 'bold 36px Outfit, sans-serif';
              fctx.textAlign = 'center';
              fctx.fillText(`Slide ${i + 1}`, width / 2, height / 2);
              const fallbackImg = new Image();
              fallbackImg.src = fallbackCanvas.toDataURL();
              fallbackImg.onload = () => resolve(fallbackImg);
            };
            img.src = scene.imageUrl;
          });
        })
      );

      // Step 2: Setup MediaRecorder & Web Audio mixing
      const canvasStream = canvas.captureStream(fps);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const hasAudio = project.scenes.some((s) => s.audioClips && s.audioClips.length > 0) || Boolean(project.bgMusicUrl);
      let audioCtx: AudioContext | null = null;
      let audioDest: MediaStreamAudioDestinationNode | null = null;
      let combinedStream = canvasStream;

      if (hasAudio && typeof AudioContext !== 'undefined') {
        try {
          setProgressText('ऑडियो ट्रैक्स व वॉइसओवर मिक्स किए जा रहे हैं...');
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioDest = audioCtx.createMediaStreamDestination();

          // Pre-fetch and schedule all scene audio clips and bgMusic
          let sceneOffset = 0;
          for (const s of project.scenes) {
            if (s.audioClips && s.audioClips.length > 0) {
              for (const clip of s.audioClips) {
                try {
                  const resp = await fetch(clip.url);
                  const arrayBuffer = await resp.arrayBuffer();
                  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                  const source = audioCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  const gainNode = audioCtx.createGain();
                  gainNode.gain.value = clip.volume ?? 1.0;
                  source.connect(gainNode);
                  gainNode.connect(audioDest);
                  const startDelay = Math.max(0, sceneOffset + (clip.startTime || 0));
                  source.start(audioCtx.currentTime + startDelay);
                } catch (audioLoadErr) {
                  console.warn('Could not load audio clip for export:', clip.name, audioLoadErr);
                }
              }
            }
            sceneOffset += s.duration;
          }

          if (project.bgMusicUrl) {
            try {
              const bgResp = await fetch(project.bgMusicUrl);
              const bgArr = await bgResp.arrayBuffer();
              const bgBuffer = await audioCtx.decodeAudioData(bgArr);
              const bgSource = audioCtx.createBufferSource();
              bgSource.buffer = bgBuffer;
              const bgGain = audioCtx.createGain();
              bgGain.gain.value = 0.5;
              bgSource.connect(bgGain);
              bgGain.connect(audioDest);
              bgSource.start(audioCtx.currentTime);
            } catch (bgErr) {
              console.warn('Could not load bg music for export:', bgErr);
            }
          }

          const audioTracks = audioDest.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            combinedStream = new MediaStream([
              ...combinedStream.getVideoTracks(),
              ...audioTracks,
            ]);
          }
        } catch (audioInitErr) {
          console.warn('Web Audio initialization error:', audioInitErr);
        }
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: resolution === '1080p' ? 8000000 : 4000000,
      });

      const recordedChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      const recordPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(recordedChunks, { type: mimeType }));
        };
      });

      recorder.start();

      // Step 3: Render frame by frame
      const totalFrames = project.scenes.reduce(
        (sum, s) => sum + Math.round(s.duration * fps),
        0
      );
      let renderedFrames = 0;

      for (let sIdx = 0; sIdx < project.scenes.length; sIdx++) {
        const scene = project.scenes[sIdx];
        const img = loadedImages[sIdx];
        const sceneFrames = Math.max(1, Math.round(scene.duration * fps));

        for (let f = 0; f < sceneFrames; f++) {
          const progressInScene = f / sceneFrames;
          const currentTimeInScene = f / fps;

          // Crop & Free-size settings for this scene
          const crop = scene.imageCrop || {
            fitMode: 'contain',
            scale: 1,
            positionX: 0,
            positionY: 0,
            rotate: 0,
            backgroundBlur: true,
            backgroundColor: '#000000',
          };
          const fitMode = crop.fitMode || 'contain';
          const userScale = crop.scale ?? 1;
          const posX = crop.positionX ?? 0;
          const posY = crop.positionY ?? 0;
          const rotateDeg = crop.rotate ?? 0;
          const showBlur = crop.backgroundBlur !== false;
          const bgColor = crop.backgroundColor || '#000000';

          // Clear with background color
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, width, height);

          // Blurred background for aesthetic full image framing
          if (showBlur) {
            ctx.save();
            ctx.filter = 'blur(28px) brightness(45%)';
            const bgHRatio = width / img.width;
            const bgVRatio = height / img.height;
            const bgRatio = Math.max(bgHRatio, bgVRatio) * 1.3;
            const bgShiftX = (width - img.width * bgRatio) / 2;
            const bgShiftY = (height - img.height * bgRatio) / 2;
            ctx.drawImage(img, bgShiftX, bgShiftY, img.width * bgRatio, img.height * bgRatio);
            ctx.restore();
          }

          // Calculate Ken Burns / Motion transform
          ctx.save();
          let scale = 1.0;
          let translateX = 0;
          let translateY = 0;
          let alpha = 1.0;

          switch (scene.effect) {
            case 'kenburns':
              scale = 1.0 + progressInScene * 0.18;
              translateX = -progressInScene * 40;
              translateY = -progressInScene * 20;
              break;
            case 'zoom-in':
              scale = 1.0 + progressInScene * 0.22;
              break;
            case 'zoom-out':
              scale = 1.22 - progressInScene * 0.22;
              break;
            case 'pan-left':
              scale = 1.15;
              translateX = (0.5 - progressInScene) * 80;
              break;
            case 'pan-right':
              scale = 1.15;
              translateX = (progressInScene - 0.5) * 80;
              break;
            case 'fade':
              if (progressInScene < 0.15) alpha = progressInScene / 0.15;
              else if (progressInScene > 0.85) alpha = (1 - progressInScene) / 0.15;
              break;
            default:
              break;
          }

          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.translate(width / 2 + translateX, height / 2 + translateY);
          ctx.scale(scale, scale);
          ctx.translate(-width / 2, -height / 2);

          // Calculate Image placement based on fitMode (cover vs contain) and user's free size crop
          const hRatio = width / img.width;
          const vRatio = height / img.height;
          const baseRatio = fitMode === 'cover' ? Math.max(hRatio, vRatio) : Math.min(hRatio, vRatio);
          const finalRatio = baseRatio * userScale;

          const centerShiftX = (width - img.width * finalRatio) / 2;
          const centerShiftY = (height - img.height * finalRatio) / 2;
          const userOffsetX = (posX / 100) * width;
          const userOffsetY = (posY / 100) * height;

          ctx.save();
          if (rotateDeg !== 0) {
            ctx.translate(width / 2, height / 2);
            ctx.rotate((rotateDeg * Math.PI) / 180);
            ctx.translate(-width / 2, -height / 2);
          }

          ctx.drawImage(
            img,
            0,
            0,
            img.width,
            img.height,
            centerShiftX + userOffsetX,
            centerShiftY + userOffsetY,
            img.width * finalRatio,
            img.height * finalRatio
          );
          ctx.restore();
          ctx.restore();

          // Subtitles
          const activeSub = (scene.subtitles || []).find(
            (sub) => currentTimeInScene >= sub.startTime && currentTimeInScene <= sub.endTime
          );

          if (activeSub) {
            ctx.save();
            ctx.font = `bold ${Math.round(28 * scaleFactor)}px Outfit, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const text = activeSub.text;
            const textMetrics = ctx.measureText(text);
            const textWidth = textMetrics.width;
            const paddingX = 20 * scaleFactor;
            const paddingY = 10 * scaleFactor;
            const boxWidth = textWidth + paddingX * 2;
            const boxHeight = 44 * scaleFactor;

            let posY = height - 80 * scaleFactor;
            if (activeSub.style?.position === 'top') posY = 80 * scaleFactor;
            if (activeSub.style?.position === 'center') posY = height / 2;

            // Draw Background Badge
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            ctx.roundRect(
              width / 2 - boxWidth / 2,
              posY - boxHeight / 2,
              boxWidth,
              boxHeight,
              8 * scaleFactor
            );
            ctx.fill();

            // Draw Text
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 6;
            ctx.fillText(text, width / 2, posY);
            ctx.restore();
          }

          renderedFrames++;
          if (hasAudio) {
            // Keep frame rendering paced with real-time audio playback
            await new Promise((r) => setTimeout(r, Math.max(1, Math.round(1000 / fps))));
            if (renderedFrames % 15 === 0) {
              setProgress(Math.round((renderedFrames / totalFrames) * 100));
              setProgressText(
                `एक्सपोर्ट हो रहा है: सीन ${sIdx + 1}/${project.scenes.length} (ऑडियो सिंक: ${Math.round(renderedFrames / fps)}s / ${Math.round(project.totalDuration)}s)...`
              );
            }
          } else {
            if (renderedFrames % 10 === 0) {
              setProgress(Math.round((renderedFrames / totalFrames) * 100));
              setProgressText(
                `Rendering Scene ${sIdx + 1}/${project.scenes.length} (Frame ${renderedFrames}/${totalFrames})...`
              );
              await new Promise((r) => setTimeout(r, 4));
            }
          }
        }
      }

      setProgress(98);
      setProgressText('Finalizing video file...');
      recorder.stop();
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      const videoBlob = await recordPromise;

      const url = URL.createObjectURL(videoBlob);
      setExportedVideoUrl(url);
      setProgress(100);
      setProgressText('Video rendered successfully!');

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error(err);
      setError(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportedVideoUrl) return;
    const a = document.createElement('a');
    a.href = exportedVideoUrl;
    const cleanTitle = (project.title || 'gemini_slideshow').toLowerCase().replace(/[^a-z0-9]/gi, '_');
    a.download = `${cleanTitle}_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '560px',
        padding: '28px',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.2)',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--grad-cyan-violet)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Film size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
              Export <span className="grad-text">Slideshow Video</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {project.scenes.length} scenes &bull; {project.totalDuration}s total duration &bull; {project.aspectRatio}
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            color: '#fca5a5',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Video Preview if rendered */}
        {exportedVideoUrl ? (
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '16px',
              border: '1px solid var(--border-color-glow)',
              boxShadow: 'var(--shadow-glow)',
              background: '#000',
            }}>
              <video
                src={exportedVideoUrl}
                controls
                autoPlay
                style={{ width: '100%', maxHeight: '280px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                className="btn-primary"
                onClick={handleDownload}
                style={{ padding: '12px 24px', fontSize: '14px' }}
              >
                <Download size={18} />
                <span>Download Video File</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => setExportedVideoUrl(null)}
              >
                Render Again
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Resolution Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Resolution Quality:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setResolution('1080p')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: resolution === '1080p' ? '2px solid var(--primary-cyan)' : '1px solid var(--border-color)',
                    background: resolution === '1080p' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(0,0,0,0.3)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <div>1080p Full HD</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Best clarity & effects</div>
                </button>

                <button
                  type="button"
                  onClick={() => setResolution('720p')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: resolution === '720p' ? '2px solid var(--primary-cyan)' : '1px solid var(--border-color)',
                    background: resolution === '720p' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(0,0,0,0.3)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <div>720p HD</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fast rendering</div>
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {isExporting && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--primary-cyan)' }}>{progressText}</span>
                  <span style={{ fontWeight: 700 }}>{progress}%</span>
                </div>
                <div style={{
                  height: '8px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'var(--grad-cyan-violet)',
                    transition: 'width 0.2s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Start Export Button */}
            <button
              className="btn-primary"
              onClick={handleExportClientSide}
              disabled={isExporting}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '14px',
                fontSize: '15px',
                opacity: isExporting ? 0.7 : 1,
              }}
            >
              {isExporting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Processing Video...</span>
                </>
              ) : (
                <>
                  <Film size={18} />
                  <span>Render & Export Now</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
