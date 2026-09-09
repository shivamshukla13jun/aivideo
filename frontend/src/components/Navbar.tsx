import React from 'react';
import { Sparkles, Video, Download, Settings, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface NavbarProps {
  aspectRatio: '16:9' | '9:16' | '1:1';
  onAspectRatioChange: (ratio: '16:9' | '9:16' | '1:1') => void;
  onOpenAIGenerator: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  backendStatus: { status: string; geminiConfigured: boolean; ffmpegAvailable: boolean };
}

export const Navbar: React.FC<NavbarProps> = ({
  aspectRatio,
  onAspectRatioChange,
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
        {/* Status Badge */}
        <div
          onClick={onOpenSettings}
          title={isOnline ? 'Backend Connected' : 'Click to configure Gemini API Key'}
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
          <span>{isOnline ? 'AI Connected' : 'Set Gemini Key'}</span>
        </div>

        {/* Settings button */}
        <button
          className="btn-icon"
          onClick={onOpenSettings}
          title="API Key & Settings"
        >
          <Settings size={18} />
        </button>

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
