import React, { useState } from 'react';
import { Sparkles, X, Upload, Film, Wand2, Loader2, Image as ImageIcon } from 'lucide-react';
import { api } from '../services/api';
import { Scene, DEFAULT_SUBTITLE_STYLE } from '../types/video';

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (scenes: Scene[], title: string, description: string) => void;
  aspectRatio: '16:9' | '9:16' | '1:1';
  apiKey: string;
}

const STYLES = [
  'Cinematic Documentary',
  'Fast-Paced Action & Suspense',
  'Anime & Webtoon Explainer',
  'Inspirational & Motivational',
  'Modern Minimalist Tech',
];

const MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Ultra Fast & Balanced)' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Flagship Multimodal)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Deep Reasoning)' },
];

export const AIGenerateModal: React.FC<AIGenerateModalProps> = ({
  isOpen,
  onClose,
  onGenerated,
  aspectRatio,
  apiKey,
}) => {
  const [tab, setTab] = useState<'prompt' | 'images'>('prompt');
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [style, setStyle] = useState(STYLES[0]);
  const [model, setModel] = useState(MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vision files
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [storyContext, setStoryContext] = useState('');

  if (!isOpen) return null;

  const handleGeneratePrompt = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic or concept for your video.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.generateSlideshow({
        topic: topic.trim(),
        slideCount,
        style,
        aspectRatio,
        model,
        apiKey,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate slideshow');
      }

      const { scenes: rawScenes, title, description } = response.data;

      const convertedScenes: Scene[] = rawScenes.map((s: any, idx: number) => ({
        id: s.id || `scene_${idx}_${Date.now()}`,
        slideNumber: s.slideNumber || idx + 1,
        title: s.title || `Scene ${idx + 1}`,
        imageUrl: s.imageUrl || `https://images.unsplash.com/featured/?cinematic,${encodeURIComponent(topic)}&sig=${idx}`,
        duration: s.duration || 5,
        effect: s.effect || 'kenburns',
        narration: s.narration || '',
        subtitles: (s.subtitles || []).map((sub: any, subIdx: number) => ({
          id: sub.id || `sub_${idx}_${subIdx}`,
          text: sub.text,
          startTime: sub.startTime,
          endTime: sub.endTime,
          style: { ...DEFAULT_SUBTITLE_STYLE },
        })),
        audioClips: [],
      }));

      onGenerated(convertedScenes, title || topic, description || '');
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Generation failed. Check your Gemini API Key.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImages = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least 1 image for analysis.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('images', file));
      formData.append('storyContext', storyContext || 'Visual slideshow');
      formData.append('model', model);

      const response = await api.analyzeImages(formData, apiKey);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to analyze images');
      }

      const { scenes: rawScenes, title, description } = response.data;

      const convertedScenes: Scene[] = rawScenes.map((s: any, idx: number) => ({
        id: s.id || `scene_${idx}_${Date.now()}`,
        slideNumber: s.slideNumber || idx + 1,
        title: s.title || `Scene ${idx + 1}`,
        imageUrl: s.imageUrl || URL.createObjectURL(selectedFiles[idx]),
        duration: s.duration || 5,
        effect: s.effect || 'kenburns',
        narration: s.narration || '',
        subtitles: (s.subtitles || []).map((sub: any, subIdx: number) => ({
          id: sub.id || `sub_${idx}_${subIdx}`,
          text: sub.text,
          startTime: sub.startTime,
          endTime: sub.endTime,
          style: { ...DEFAULT_SUBTITLE_STYLE },
        })),
        audioClips: [],
      }));

      onGenerated(convertedScenes, title || 'Vision Slideshow', description || '');
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Image analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        overflowY: 'auto',
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
            <Sparkles size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
              Generate with <span className="grad-text">Gemini AI</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              AI-driven slideshow storyboard, synchronized subtitles & motion effects
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '20px',
        }}>
          <button
            onClick={() => setTab('prompt')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'prompt' ? 'var(--grad-cyan-violet)' : 'transparent',
              color: tab === 'prompt' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Wand2 size={16} />
            <span>From Topic / Idea</span>
          </button>
          <button
            onClick={() => setTab('images')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'images' ? 'var(--grad-cyan-violet)' : 'transparent',
              color: tab === 'images' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ImageIcon size={16} />
            <span>From Images / Panels (Vision)</span>
          </button>
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

        {tab === 'prompt' ? (
          <div>
            {/* Topic Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Video Topic / Script Idea:
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. The Untold Mystery of Deep Sea Bioluminescence, or Samurai Warriors in Edo Japan"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Try:</span>
                {[
                  'Deep Sea Creatures',
                  'Cyberpunk Tokyo 2099',
                  'Cosmic Black Holes',
                  'Ancient Rome Glories',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTopic(tag)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--primary-cyan)',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Slide Count & Style */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Slides Count:
                </label>
                <select
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                >
                  {[3, 4, 5, 6, 7, 8, 10].map((num) => (
                    <option key={num} value={num} style={{ background: '#111827' }}>
                      {num} Slides
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Narrative Style:
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                >
                  {STYLES.map((s) => (
                    <option key={s} value={s} style={{ background: '#111827' }}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Gemini Model */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                AI Model:
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '13px',
                }}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id} style={{ background: '#111827' }}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              className="btn-primary"
              onClick={handleGeneratePrompt}
              disabled={loading}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '14px',
                fontSize: '15px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Directing Storyboard with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generate Slideshow Storyboard</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div>
            {/* Vision Upload */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Upload Slides / Panels (JPG, PNG):
              </label>
              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.25)',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('vision-file-input')?.click()}
              >
                <Upload size={32} color="var(--primary-cyan)" style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '13px', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  Click to select multiple images or manga panels
                </p>
                <p style={{ fontSize: '11px', margin: 0, color: 'var(--text-muted)' }}>
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : 'Gemini will examine visual actions and write scripts automatically'}
                </p>
                <input
                  id="vision-file-input"
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles(Array.from(e.target.files));
                    }
                  }}
                />
              </div>
            </div>

            {/* Story Context */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Context or Direction (Optional):
              </label>
              <input
                type="text"
                value={storyContext}
                onChange={(e) => setStoryContext(e.target.value)}
                placeholder="e.g. Manga battle scene between heroes, or Vacation trip in Switzerland"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '13px',
                }}
              />
            </div>

            {/* Submit */}
            <button
              className="btn-primary"
              onClick={handleGenerateImages}
              disabled={loading || selectedFiles.length === 0}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '14px',
                fontSize: '15px',
                opacity: loading || selectedFiles.length === 0 ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Analyzing Images & Motion with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Analyze {selectedFiles.length} Images & Generate Video</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
