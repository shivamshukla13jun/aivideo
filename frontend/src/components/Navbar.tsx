import React from 'react';
import {
  Sparkles,
  Video,
  Download,
  Settings,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Mic,
} from 'lucide-react';

interface NavbarProps {
  aspectRatio: '16:9' | '9:16' | '1:1';
  onAspectRatioChange: (ratio: '16:9' | '9:16' | '1:1') => void;
  onOpenAnimeLibrary: () => void;
  onOpenVoiceover?: () => void;
  onOpenAIGenerator: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  backendStatus: {
    status: string;
    suwayomiConnected?: boolean;
    mongoConnected?: boolean;
    geminiConfigured: boolean;
    ffmpegAvailable: boolean;
    aiProvider?: 'gemini' | 'ollama';
    ollamaConnected?: boolean;
  };
}

export const Navbar: React.FC<NavbarProps> = ({
  aspectRatio,
  onAspectRatioChange,
  onOpenAnimeLibrary,
  onOpenVoiceover,
  onOpenAIGenerator,
  onOpenExport,
  onOpenSettings,
  backendStatus,
}) => {
  const isOnline = backendStatus.status === 'ok';

  return (
    <header className="glass-panel" style={{
      margin: '12px 16px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      zIndex: 40,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'var(--grad-cyan-violet)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(6, 182, 212, 0.4)',
        }}>
          <Video size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              Gemini <span className="grad-text">Video Studio</span>
            </h1>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#c084fc',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}>
              AI PRO
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Cinematic Slideshow & Effects Engine
          </p>
        </div>
      </div>

      {/* Center Controls: Aspect Ratio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.3)', padding: '4px 6px', borderRadius: '10px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '0 8px' }}>Aspect:</span>
        {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
          <button
            key={ratio}
            onClick={() => onAspectRatioChange(ratio)}
            style={{
              background: aspectRatio === ratio ? 'var(--grad-cyan-violet)' : 'transparent',
              color: aspectRatio === ratio ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {ratio}
          </button>
        ))}
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* AI Provider Indicator Badge (.env) */}
        <button
          onClick={onOpenSettings}
          title="सिस्टम व AI स्थिति देखें (.env द्वारा कॉन्फ़िगर)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: '9999px',
            background:
              backendStatus.aiProvider === 'ollama'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(6, 182, 212, 0.15)',
            border: `1px solid ${
              backendStatus.aiProvider === 'ollama'
                ? 'rgba(16, 185, 129, 0.4)'
                : 'rgba(6, 182, 212, 0.4)'
            }`,
            color: backendStatus.aiProvider === 'ollama' ? '#34d399' : '#38bdf8',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span>
            {backendStatus.aiProvider === 'ollama'
              ? backendStatus.ollamaConnected === false
                ? '🦙 Ollama (ऑफलाइन)'
                : '🦙 Ollama (.env)'
              : '⚡ Gemini (.env)'}
          </span>
        </button>

        {/* System Status Badge */}
        <div
          onClick={onOpenSettings}
          title="सिस्टम स्थिति विवरण देखें"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            padding: '6px 12px',
            borderRadius: '9999px',
            background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            color: isOnline ? '#34d399' : '#fbbf24',
            cursor: 'pointer',
          }}
        >
          {isOnline ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{isOnline ? 'Backend Online' : 'Backend Offline'}</span>
        </div>

        {/* Settings button */}
        <button
          className="btn-icon"
          onClick={onOpenSettings}
          title="सिस्टम व पर्यावरण चर (.env) विवरण"
        >
          <Settings size={18} />
        </button>

        {/* Anime / Manga Library */}
        <button
          className="btn-secondary glow-hover"
          onClick={onOpenAnimeLibrary}
          style={{
            borderColor: 'rgba(6, 182, 212, 0.4)',
            color: '#38bdf8',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BookOpen size={16} color="var(--primary-cyan)" />
          <span>Anime Library</span>
        </button>

        {/* AI Voiceover Generator */}
        {onOpenVoiceover && (
          <button
            className="btn-secondary glow-hover"
            onClick={onOpenVoiceover}
            style={{
              borderColor: 'rgba(139, 92, 246, 0.45)',
              background: 'rgba(139, 92, 246, 0.12)',
              color: '#c084fc',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            title="न्यूरल आवाज़ या अपनी सैंपल आवाज़ से सभी सीन्स में वॉइसओवर जोड़ें"
          >
            <Mic size={16} color="#c084fc" />
            <span>ऑटो वॉइसओवर</span>
          </button>
        )}

        {/* Generate with Gemini AI */}
        <button
          className="btn-primary"
          onClick={onOpenAIGenerator}
          style={{
            background: 'var(--grad-cyan-violet)',
          }}
        >
          <Sparkles size={16} />
          <span>Generate with Gemini</span>
        </button>

        {/* Export Video */}
        <button
          className="btn-secondary glow-hover"
          onClick={onOpenExport}
        >
          <Download size={16} />
          <span>Export Video</span>
        </button>
      </div>
    </header>
  );
};
