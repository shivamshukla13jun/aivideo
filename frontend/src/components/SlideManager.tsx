import React, { useRef } from 'react';
import { Plus, Trash2, Copy, ChevronLeft, ChevronRight, Upload, Sparkles, Clock, Move, BookOpen, Sliders, Crop, Maximize2, Minimize2 } from 'lucide-react';
import { Scene, TransitionEffect, DEFAULT_SUBTITLE_STYLE, ImageFitMode } from '../types/video';

interface SlideManagerProps {
  scenes: Scene[];
  selectedSceneIndex: number;
  onSelectScene: (index: number) => void;
  onUpdateScene: (index: number, updated: Partial<Scene>) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
  onDuplicateSlide: (index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onOpenAnimeLibrary?: () => void;
  onOpenCropModal?: (index: number) => void;
}

const EFFECTS: Array<{ value: TransitionEffect; label: string; icon: string }> = [
  { value: 'kenburns', label: 'Ken Burns', icon: '🌟' },
  { value: 'zoom-in', label: 'Zoom In', icon: '🔍' },
  { value: 'zoom-out', label: 'Zoom Out', icon: '🔎' },
  { value: 'pan-left', label: 'Pan Left', icon: '⬅️' },
  { value: 'pan-right', label: 'Pan Right', icon: '➡️' },
  { value: 'fade', label: 'Fade In/Out', icon: '🌫️' },
  { value: 'crossfade', label: 'Crossfade', icon: '🔀' },
  { value: 'wipe', label: 'Wipe', icon: '✂️' },
  { value: 'none', label: 'Still', icon: '⏹️' },
];

export const SlideManager: React.FC<SlideManagerProps> = ({
  scenes,
  selectedSceneIndex,
  onSelectScene,
  onUpdateScene,
  onAddSlide,
  onDeleteSlide,
  onDuplicateSlide,
  onMoveSlide,
  onOpenAnimeLibrary,
  onOpenCropModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeScene = scenes[selectedSceneIndex];

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activeScene) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      onUpdateScene(selectedSceneIndex, { imageUrl: url });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Slide Thumbnails Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        overflowX: 'auto',
        padding: '8px 4px 14px 4px',
      }}>
        {scenes.map((scene, idx) => {
          const isSelected = idx === selectedSceneIndex;
          const effectObj = EFFECTS.find((e) => e.value === scene.effect);

          return (
            <div
              key={scene.id || idx}
              onClick={() => onSelectScene(idx)}
              style={{
                flexShrink: 0,
                width: '150px',
                height: '110px',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
                border: isSelected
                  ? '2px solid var(--primary-cyan)'
                  : '1px solid var(--border-color)',
                boxShadow: isSelected
                  ? '0 0 16px rgba(6, 182, 212, 0.4)'
                  : '0 4px 12px rgba(0, 0, 0, 0.3)',
                background: '#111827',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {/* Image Preview */}
              <img
                src={scene.imageUrl}
                alt={scene.title || `Slide ${idx + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />

              {/* Number Badge */}
              <div style={{
                position: 'absolute',
                top: '6px',
                left: '6px',
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
                borderRadius: '6px',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#ffffff',
              }}>
                #{idx + 1}
              </div>

              {/* Fit Mode Badge */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectScene(idx);
                  onOpenCropModal?.(idx);
                }}
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color:
                    scene.imageCrop?.fitMode === 'cover'
                      ? '#38bdf8'
                      : scene.imageCrop?.fitMode === 'custom'
                      ? '#c084fc'
                      : '#4ade80',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                }}
                title="इमेज साइज़ / क्रॉप एडिट करें"
              >
                {scene.imageCrop?.fitMode === 'cover'
                  ? '🔲 भरें'
                  : scene.imageCrop?.fitMode === 'custom'
                  ? `🎛️ ${Math.round((scene.imageCrop.scale || 1) * 100)}%`
                  : '🖼️ पूरी'}
              </div>

              {/* Effect & Duration Badge */}
              <div style={{
                position: 'absolute',
                bottom: '6px',
                left: '6px',
                right: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
                borderRadius: '6px',
                padding: '2px 6px',
                fontSize: '10px',
                color: '#ffffff',
              }}>
                <span>{effectObj?.icon} {effectObj?.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {scene.audioClips && scene.audioClips.length > 0 && (
                    <span style={{ color: '#4ade80' }} title="वॉइसओवर जुड़ा हुआ है">🎙️</span>
                  )}
                  <span>{scene.duration}s</span>
                </span>
              </div>
            </div>
          );
        })}

        {/* Add Slide Button */}
        <button
          onClick={onAddSlide}
          style={{
            flexShrink: 0,
            width: '100px',
            height: '110px',
            borderRadius: '12px',
            border: '2px dashed var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          className="glow-hover"
        >
          <Plus size={24} color="var(--primary-cyan)" />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>Add Slide</span>
        </button>

        {/* Import Anime Panels */}
        {onOpenAnimeLibrary && (
          <button
            onClick={onOpenAnimeLibrary}
            style={{
              flexShrink: 0,
              width: '110px',
              height: '110px',
              borderRadius: '12px',
              border: '2px dashed rgba(6, 182, 212, 0.4)',
              background: 'rgba(6, 182, 212, 0.04)',
              color: '#38bdf8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            className="glow-hover"
            title="Import Anime Chapter Panels"
          >
            <BookOpen size={24} color="var(--primary-cyan)" />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Anime Panels</span>
          </button>
        )}
      </div>

      {/* Selected Slide Quick Actions Bar */}
      {activeScene && (
        <div className="glass-panel" style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}>
          {/* Left: Move & Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-cyan)' }}>
              Slide #{selectedSceneIndex + 1}
            </span>

            <button
              className="btn-icon"
              disabled={selectedSceneIndex === 0}
              onClick={() => onMoveSlide(selectedSceneIndex, selectedSceneIndex - 1)}
              title="Move Slide Left"
              style={{ opacity: selectedSceneIndex === 0 ? 0.3 : 1 }}
            >
              <ChevronLeft size={16} />
            </button>

            <button
              className="btn-icon"
              disabled={selectedSceneIndex === scenes.length - 1}
              onClick={() => onMoveSlide(selectedSceneIndex, selectedSceneIndex + 1)}
              title="Move Slide Right"
              style={{ opacity: selectedSceneIndex === scenes.length - 1 ? 0.3 : 1 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Center: Camera Motion Effect & Duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Motion Effect:</span>
              <select
                value={activeScene.effect}
                onChange={(e) => onUpdateScene(selectedSceneIndex, { effect: e.target.value as TransitionEffect })}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {EFFECTS.map((eff) => (
                  <option key={eff.value} value={eff.value} style={{ background: '#111827' }}>
                    {eff.icon} {eff.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} color="var(--primary-cyan)" />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Duration:</span>
              <input
                type="range"
                min="2"
                max="15"
                step="0.5"
                value={activeScene.duration}
                onChange={(e) => onUpdateScene(selectedSceneIndex, { duration: parseFloat(e.target.value) })}
                style={{ width: '80px', accentColor: 'var(--primary-cyan)' }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, width: '32px' }}>
                {activeScene.duration}s
              </span>
            </div>
          </div>

          {/* Right: Replace Image, Duplicate, Delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Image Size & Free Crop Editor Button */}
            <button
              className="btn-secondary"
              onClick={() => onOpenCropModal?.(selectedSceneIndex)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="पूरी इमेज दिखाएं, स्क्रीन भरें, या फ्री-साइज़ ज़ूम व पैन करें"
            >
              <Sliders size={14} color="var(--primary-cyan)" />
              <span>
                साइज़: {activeScene.imageCrop?.fitMode === 'cover' ? 'भरें' : activeScene.imageCrop?.fitMode === 'custom' ? `${Math.round((activeScene.imageCrop.scale || 1) * 100)}%` : 'पूरी'}
              </span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageFileChange}
            />

            <button
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <Upload size={14} />
              <span>Replace Image</span>
            </button>

            <button
              className="btn-icon"
              onClick={() => onDuplicateSlide(selectedSceneIndex)}
              title="Duplicate Slide"
            >
              <Copy size={16} />
            </button>

            <button
              className="btn-icon"
              disabled={scenes.length <= 1}
              onClick={() => onDeleteSlide(selectedSceneIndex)}
              title="Delete Slide"
              style={{
                opacity: scenes.length <= 1 ? 0.3 : 1,
                color: '#f87171',
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
