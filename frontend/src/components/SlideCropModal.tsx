import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Check,
  Layers,
  Sparkles,
  Sliders,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Scene, ImageFitMode, ImageCropSettings, DEFAULT_IMAGE_CROP, ASPECT_RATIOS } from '../types/video';

interface SlideCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  onUpdateScene: (updated: Partial<Scene>) => void;
  onApplyToAllScenes?: (cropSettings: ImageCropSettings) => void;
}

export const SlideCropModal: React.FC<SlideCropModalProps> = ({
  isOpen,
  onClose,
  scene,
  sceneIndex,
  totalScenes,
  aspectRatio,
  onUpdateScene,
  onApplyToAllScenes,
}) => {
  const currentCrop = scene.imageCrop || DEFAULT_IMAGE_CROP;

  const [fitMode, setFitMode] = useState<ImageFitMode>(currentCrop.fitMode || 'contain');
  const [scale, setScale] = useState<number>(currentCrop.scale ?? 1.0);
  const [positionX, setPositionX] = useState<number>(currentCrop.positionX ?? 0);
  const [positionY, setPositionY] = useState<number>(currentCrop.positionY ?? 0);
  const [rotate, setRotate] = useState<number>(currentCrop.rotate ?? 0);
  const [backgroundBlur, setBackgroundBlur] = useState<boolean>(currentCrop.backgroundBlur ?? true);
  const [backgroundColor, setBackgroundColor] = useState<string>(currentCrop.backgroundColor || '#000000');

  const [appliedAllNotice, setAppliedAllNotice] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number }>({
    x: 0,
    y: 0,
    startPosX: 0,
    startPosY: 0,
  });

  // Sync state when scene changes
  useEffect(() => {
    if (scene) {
      const c = scene.imageCrop || DEFAULT_IMAGE_CROP;
      setFitMode(c.fitMode || 'contain');
      setScale(c.scale ?? 1.0);
      setPositionX(c.positionX ?? 0);
      setPositionY(c.positionY ?? 0);
      setRotate(c.rotate ?? 0);
      setBackgroundBlur(c.backgroundBlur ?? true);
      setBackgroundColor(c.backgroundColor || '#000000');
    }
  }, [scene]);

  // Propagate changes to scene in real-time
  const emitUpdate = (newSettings: Partial<ImageCropSettings>) => {
    const updated: ImageCropSettings = {
      fitMode: newSettings.fitMode ?? fitMode,
      scale: newSettings.scale ?? scale,
      positionX: newSettings.positionX ?? positionX,
      positionY: newSettings.positionY ?? positionY,
      rotate: newSettings.rotate ?? rotate,
      backgroundBlur: newSettings.backgroundBlur ?? backgroundBlur,
      backgroundColor: newSettings.backgroundColor ?? backgroundColor,
    };
    onUpdateScene({ imageCrop: updated });
  };

  const handleFitModeChange = (mode: ImageFitMode) => {
    setFitMode(mode);
    if (mode === 'contain') {
      setScale(1.0);
      setPositionX(0);
      setPositionY(0);
      setBackgroundBlur(true);
      emitUpdate({ fitMode: mode, scale: 1.0, positionX: 0, positionY: 0, backgroundBlur: true });
    } else if (mode === 'cover') {
      setScale(1.0);
      setPositionX(0);
      setPositionY(0);
      emitUpdate({ fitMode: mode, scale: 1.0, positionX: 0, positionY: 0 });
    } else {
      emitUpdate({ fitMode: mode });
    }
  };

  const handleScaleChange = (val: number) => {
    const newScale = Math.max(0.5, Math.min(3.0, parseFloat(val.toFixed(2))));
    setScale(newScale);
    if (fitMode !== 'custom' && newScale !== 1.0) {
      setFitMode('custom');
      emitUpdate({ scale: newScale, fitMode: 'custom' });
    } else {
      emitUpdate({ scale: newScale });
    }
  };

  const handlePositionXChange = (val: number) => {
    setPositionX(val);
    if (fitMode !== 'custom') {
      setFitMode('custom');
      emitUpdate({ positionX: val, fitMode: 'custom' });
    } else {
      emitUpdate({ positionX: val });
    }
  };

  const handlePositionYChange = (val: number) => {
    setPositionY(val);
    if (fitMode !== 'custom') {
      setFitMode('custom');
      emitUpdate({ positionY: val, fitMode: 'custom' });
    } else {
      emitUpdate({ positionY: val });
    }
  };

  const handleRotate = () => {
    const nextRotate = (rotate + 90) % 360;
    setRotate(nextRotate);
    emitUpdate({ rotate: nextRotate });
  };

  const handleToggleBlur = () => {
    const next = !backgroundBlur;
    setBackgroundBlur(next);
    emitUpdate({ backgroundBlur: next });
  };

  const handleReset = () => {
    setFitMode('contain');
    setScale(1.0);
    setPositionX(0);
    setPositionY(0);
    setRotate(0);
    setBackgroundBlur(true);
    setBackgroundColor('#000000');
    emitUpdate(DEFAULT_IMAGE_CROP);
  };

  // Preset alignments
  const applyPreset = (preset: 'top' | 'center' | 'bottom' | 'left' | 'right') => {
    let px = 0;
    let py = 0;
    let s = 1.4;

    switch (preset) {
      case 'top':
        py = 25; // Shifts image down so top panel is framed
        break;
      case 'bottom':
        py = -25; // Shifts image up so bottom panel is framed
        break;
      case 'left':
        px = 25;
        break;
      case 'right':
        px = -25;
        break;
      case 'center':
        px = 0;
        py = 0;
        s = 1.0;
        break;
    }

    setPositionX(px);
    setPositionY(py);
    setScale(s);
    setFitMode('custom');
    emitUpdate({ positionX: px, positionY: py, scale: s, fitMode: 'custom' });
  };

  // Mouse Dragging on Preview Canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPosX: positionX,
      startPosY: positionY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // Convert pixel delta to percentage offset
    const sens = 0.25;
    const newX = Math.max(-100, Math.min(100, Math.round(dragStartRef.current.startPosX + dx * sens)));
    const newY = Math.max(-100, Math.min(100, Math.round(dragStartRef.current.startPosY + dy * sens)));

    setPositionX(newX);
    setPositionY(newY);
    if (fitMode !== 'custom') setFitMode('custom');
    emitUpdate({ positionX: newX, positionY: newY, fitMode: 'custom' });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    handleScaleChange(scale + delta);
  };

  const handleApplyAll = () => {
    if (onApplyToAllScenes) {
      onApplyToAllScenes({
        fitMode,
        scale,
        positionX,
        positionY,
        rotate,
        backgroundBlur,
        backgroundColor,
      });
      setAppliedAllNotice(true);
      setTimeout(() => setAppliedAllNotice(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1050px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(6, 182, 212, 0.25)',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          background: '#0a0e17',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.2))',
                border: '1px solid var(--primary-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sliders size={20} color="var(--primary-cyan)" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                स्लाइड #{sceneIndex + 1} इमेज व साइज़ एडिटर (Free Size)
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                पूरी इमेज दिखाएं, स्क्रीन भरें, या कस्टम ज़ूम व पैन करके किसी भी मंगा पैनल पर फोकस करें
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                color: 'var(--primary-cyan)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {aspectRatio} Frame
            </span>

            <button
              onClick={onClose}
              className="btn-icon"
              style={{ width: '34px', height: '34px' }}
              title="बंद करें"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Canvas Preview, Right Controls */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            overflowY: 'auto',
            gap: '20px',
            padding: '20px',
          }}
        >
          {/* Left Column: Interactive Visual Canvas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={15} color="var(--primary-cyan)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  लाइव पूर्वावलोकन (Live Drag & Pan Canvas)
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                माउस से ड्रैग करें या व्हील घुमाएं
              </span>
            </div>

            {/* Interactive Preview Box */}
            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              style={{
                width: '100%',
                aspectRatio: aspectRatio === '9:16' ? '9 / 16' : aspectRatio === '1:1' ? '1 / 1' : '16 / 9',
                maxHeight: '440px',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: backgroundColor,
                position: 'relative',
                boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
            >
              {/* Blurred Background if enabled */}
              {backgroundBlur && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}
                >
                  <img
                    src={scene.imageUrl}
                    alt="Blurred Background"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'blur(24px) brightness(0.4)',
                      transform: 'scale(1.25)',
                    }}
                  />
                </div>
              )}

              {/* Foreground Image Layer with Transform */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={scene.imageUrl}
                  alt={scene.title || 'Slide Scene'}
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: fitMode === 'cover' ? 'cover' : 'contain',
                    transform: `translate(${positionX}%, ${positionY}%) scale(${scale}) rotate(${rotate}deg)`,
                    transformOrigin: 'center center',
                    filter: backgroundBlur && fitMode !== 'cover' ? 'drop-shadow(0 10px 30px rgba(0,0,0,0.85))' : undefined,
                    transition: isDragging ? 'none' : 'transform 0.15s ease',
                  }}
                />
              </div>

              {/* Subtle Canvas Overlay Grid Guides */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  border: '1px dashed rgba(6, 182, 212, 0.3)',
                  boxSizing: 'border-box',
                }}
              />

              {/* Floating Canvas Indicator */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(6px)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  pointerEvents: 'none',
                }}
              >
                <span>🔍 {Math.round(scale * 100)}%</span>
                <span>•</span>
                <span>X: {positionX}%</span>
                <span>Y: {positionY}%</span>
              </div>
            </div>

            {/* Canvas Quick Actions & Preset Alignments */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>पैनल फोकस:</span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => applyPreset('top')}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  title="मंगा के शीर्ष हिस्से पर फोकस"
                >
                  ⬆️ टॉप
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => applyPreset('center')}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  title="मध्य में केंद्रित"
                >
                  ⏺️ सेंटर
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => applyPreset('bottom')}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  title="निचले डायलॉग या पैनल पर फोकस"
                >
                  ⬇️ बॉटम
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRotate}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  title="90° घुमाएं"
                >
                  <RotateCw size={12} />
                  <span>{rotate}°</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleReset}
                  style={{ padding: '4px 8px', fontSize: '11px', color: '#f87171' }}
                  title="डिफ़ॉल्ट रीसेट करें"
                >
                  <RefreshCw size={12} />
                  <span>रीसेट</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Controls, Sliders & Modes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Mode Selection */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                इमेज डिस्प्ले मोड (Display Mode)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {/* Contain (Full Image) */}
                <button
                  type="button"
                  onClick={() => handleFitModeChange('contain')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: fitMode === 'contain' ? '2px solid var(--primary-cyan)' : '1px solid var(--border-color)',
                    background: fitMode === 'contain' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    color: fitMode === 'contain' ? '#ffffff' : 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Minimize2 size={18} color={fitMode === 'contain' ? 'var(--primary-cyan)' : 'currentColor'} />
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>पूरी इमेज</span>
                  <span style={{ fontSize: '10px', opacity: 0.75 }}>बिना कटे (Fit)</span>
                </button>

                {/* Cover (Fill) */}
                <button
                  type="button"
                  onClick={() => handleFitModeChange('cover')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: fitMode === 'cover' ? '2px solid var(--primary-cyan)' : '1px solid var(--border-color)',
                    background: fitMode === 'cover' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    color: fitMode === 'cover' ? '#ffffff' : 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Maximize2 size={18} color={fitMode === 'cover' ? 'var(--primary-cyan)' : 'currentColor'} />
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>स्क्रीन भरें</span>
                  <span style={{ fontSize: '10px', opacity: 0.75 }}>पूरा फ्रेम (Cover)</span>
                </button>

                {/* Custom (Free Size) */}
                <button
                  type="button"
                  onClick={() => handleFitModeChange('custom')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: fitMode === 'custom' ? '2px solid var(--primary-cyan)' : '1px solid var(--border-color)',
                    background: fitMode === 'custom' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    color: fitMode === 'custom' ? '#ffffff' : 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Sliders size={18} color={fitMode === 'custom' ? 'var(--primary-cyan)' : 'currentColor'} />
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>फ्री-साइज़</span>
                  <span style={{ fontSize: '10px', opacity: 0.75 }}>कस्टम क्रॉप (Free)</span>
                </button>
              </div>
            </div>

            {/* 2. Free Size Sliders */}
            <div
              className="glass-panel"
              style={{
                padding: '14px',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                background: 'rgba(0, 0, 0, 0.35)',
              }}
            >
              {/* Scale / Zoom Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ZoomIn size={14} color="var(--primary-cyan)" />
                    ज़ूम / स्केल (Scale):
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-cyan)', fontFamily: 'monospace' }}>
                    {Math.round(scale * 100)}% ({scale.toFixed(2)}x)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.05"
                    value={scale}
                    onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--primary-cyan)' }}
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1.0, 1.5, 2.0].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleScaleChange(s)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '10px',
                          background: scale === s ? 'var(--primary-cyan)' : undefined,
                          color: scale === s ? '#000000' : undefined,
                          fontWeight: 700,
                        }}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pan X (Horizontal) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Move size={14} color="var(--primary-cyan)" />
                    क्षैतिज स्थिति (Pan X - बाएं / दाएं):
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {positionX}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={positionX}
                  onChange={(e) => handlePositionXChange(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--primary-cyan)' }}
                />
              </div>

              {/* Pan Y (Vertical) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Move size={14} color="var(--primary-cyan)" />
                    ऊर्ध्वाधर स्थिति (Pan Y - ऊपर / नीचे):
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {positionY}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={positionY}
                  onChange={(e) => handlePositionYChange(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--primary-cyan)' }}
                />
              </div>
            </div>

            {/* 3. Blurred Background & Aesthetics */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={18} color="var(--primary-violet)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                    एस्थेटिक ब्लर बैकग्राउंड (Blurred Canvas)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    पूरी इमेज के पीछे सुंदर ब्लर इफ़ेक्ट (यूट्यूब/रील्स की तरह)
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={backgroundBlur}
                onChange={handleToggleBlur}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--primary-cyan)',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* 4. Apply to All Slides Button */}
            {onApplyToAllScenes && totalScenes > 1 && (
              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleApplyAll}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.15))',
                    color: '#c4b5fd',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  className="glow-hover"
                >
                  <Layers size={16} />
                  <span>सभी {totalScenes} स्लाइड्स पर यही सेटिंग लागू करें</span>
                </button>

                {appliedAllNotice && (
                  <p style={{ fontSize: '11px', color: '#4ade80', textAlign: 'center', margin: '6px 0 0 0', fontWeight: 600 }}>
                    ✅ सभी {totalScenes} स्लाइड्स पर सेटिंग लागू कर दी गई है!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💾</span>
            <span>परिवर्तन स्वचालित रूप से MongoDB डेटाबेस में सुरक्षित हो रहे हैं ✅</span>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ padding: '8px 24px', fontSize: '13px' }}
          >
            <Check size={16} />
            <span>सम्पन्न (Done)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
