import React, { useState } from 'react';
import {
  Sparkles,
  Video,
  Download,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Server,
  Database,
  Globe,
  ChevronDown,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  aspectRatio: '16:9' | '9:16' | '1:1';
  onAspectRatioChange: (ratio: '16:9' | '9:16' | '1:1') => void;
  onOpenAnimeLibrary: () => void;
  onOpenAIGenerator: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  backendStatus: {
    status: string;
    environment?: 'production' | 'development';
    environmentLabelHindi?: string;
    backendApiUrl?: string;
    suwayomiApiUrl?: string;
    suwayomiConnected?: boolean;
    mongoConnected?: boolean;
    geminiConfigured: boolean;
    ffmpegAvailable: boolean;
  };
}

export const Navbar: React.FC<NavbarProps> = ({
  aspectRatio,
  onAspectRatioChange,
  onOpenAnimeLibrary,
  onOpenAIGenerator,
  onOpenExport,
  onOpenSettings,
  backendStatus,
}) => {
  const isOnline = backendStatus.status === 'ok';
  const isProd = backendStatus.environment === 'production';
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        {/* Environment & APIs Status Badge */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowEnvDropdown((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '9999px',
              background: isProd
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.2))',
              border: `1px solid ${isProd ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              color: isProd ? '#34d399' : '#fbbf24',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="वातावरण और API एंडपॉइंट्स की जानकारी देखें"
          >
            <Globe size={13} />
            <span>{isProd ? '🚀 Production Mode' : '🛠️ Development Mode'}</span>
            <ChevronDown size={12} style={{ opacity: 0.7 }} />
          </button>

          {/* Detailed Environment Dropdown */}
          {showEnvDropdown && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '320px',
                padding: '16px',
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(16px)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                zIndex: 100,
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={14} color="#38bdf8" /> वातावरण और API स्थिति
                </span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isProd ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                  color: isProd ? '#34d399' : '#fbbf24',
                  fontWeight: 600,
                }}>
                  {isProd ? 'PRODUCTION' : 'DEVELOPMENT'}
                </span>
              </div>

              {/* Backend API info */}
              <div style={{ marginBottom: '10px', background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>बैकएंड API (Backend):</span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>● एक्टिव</span>
                </div>
                <code style={{ fontSize: '11px', color: '#38bdf8', wordBreak: 'break-all' }}>
                  {backendStatus.backendApiUrl || (isProd ? '/api/video' : 'http://localhost:5000/api/video')}
                </code>
              </div>

              {/* Suwayomi API info */}
              <div style={{ marginBottom: '10px', background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Suwayomi सर्वर API:</span>
                  <span style={{ color: backendStatus.suwayomiConnected ? '#34d399' : '#f87171', fontWeight: 600 }}>
                    {backendStatus.suwayomiConnected ? '🟢 कनेक्टेड' : '🔴 डिस्कनेक्टेड'}
                  </span>
                </div>
                <code style={{ fontSize: '11px', color: '#c084fc', wordBreak: 'break-all' }}>
                  {backendStatus.suwayomiApiUrl || (isProd ? '/suwayomi' : 'http://127.0.0.1:4567')}
                </code>
              </div>

              {/* Database & AI status */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '2px' }}>MongoDB</div>
                  <div style={{ color: backendStatus.mongoConnected ? '#34d399' : '#f87171', fontWeight: 600, fontSize: '11px' }}>
                    {backendStatus.mongoConnected ? '✅ कनेक्टेड' : '⚠️ डिस्कनेक्ट'}
                  </div>
                </div>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '2px' }}>Gemini AI</div>
                  <div style={{ color: backendStatus.geminiConfigured ? '#34d399' : '#fbbf24', fontWeight: 600, fontSize: '11px' }}>
                    {backendStatus.geminiConfigured ? '✅ तैयार' : '⚠️ की आवश्यक'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowEnvDropdown(false)}
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                बंद करें (Close)
              </button>
            </div>
          )}
        </div>

        {/* Gemini Status Badge */}
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
