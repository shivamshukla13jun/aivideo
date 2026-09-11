import React, { useState, useEffect } from 'react';
import { X, Server, Cpu, RefreshCw, Terminal, CheckCircle2, AlertCircle, Database, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendStatus: {
    status: string;
    geminiConfigured: boolean;
    ffmpegAvailable: boolean;
    suwayomiConnected?: boolean;
    mongoConnected?: boolean;
    aiProvider?: 'gemini' | 'ollama';
    configuredInEnv?: string;
    ollamaConnected?: boolean;
    ollamaBaseUrl?: string;
    ollamaModels?: string[];
    ollamaDefaultModel?: string;
    ollamaVisionModel?: string;
  };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  backendStatus,
}) => {
  // Live Ollama query state
  const [ollamaStatus, setOllamaStatus] = useState<{
    connected: boolean;
    models: string[];
    error?: string;
    checking: boolean;
  }>({
    connected: backendStatus.ollamaConnected ?? false,
    models: backendStatus.ollamaModels ?? [],
    checking: false,
  });

  useEffect(() => {
    if (isOpen) {
      checkOllama();
    }
  }, [isOpen]);

  const checkOllama = async () => {
    setOllamaStatus((prev) => ({ ...prev, checking: true }));
    try {
      const res = await api.getOllamaModels();
      setOllamaStatus({
        connected: res.connected ?? false,
        models: res.models ?? [],
        error: res.error,
        checking: false,
      });
    } catch (err: any) {
      setOllamaStatus({
        connected: false,
        models: [],
        error: err.message,
        checking: false,
      });
    }
  };

  if (!isOpen) return null;

  const isGemini = backendStatus.aiProvider !== 'ollama';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          position: 'relative',
        }}
      >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--grad-cyan-violet)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(139, 92, 246, 0.35)',
            }}
          >
            <Cpu size={24} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>
              सिस्टम व AI पर्यावरण स्थिति (.env)
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              सभी AI प्रोवाइडर्स एवं क्रेडेंशियल्स सर्वर .env फ़ाइल द्वारा प्रबंधित हैं
            </p>
          </div>
        </div>

        {/* Active AI Provider Banner (Strictly from .env) */}
        <div
          style={{
            background: isGemini ? 'rgba(6, 182, 212, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            border: `1px solid ${isGemini ? 'rgba(6, 182, 212, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              सक्रिय AI प्रोवाइडर (.env):
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '8px',
                background: isGemini ? 'rgba(6, 182, 212, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: isGemini ? '#38bdf8' : '#34d399',
                border: `1px solid ${isGemini ? 'rgba(6, 182, 212, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              }}
            >
              {isGemini ? '⚡ Google Gemini AI (क्लाउड)' : '🦙 Ollama AI (लोकल / ऑफलाइन)'}
            </span>
          </div>

          <div
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              lineHeight: 1.5,
              color: '#e2e8f0',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px', color: '#93c5fd' }}>
              ⚙️ AI प्रोवाइडर कैसे बदलें:
            </div>
            <div>
              1. <code>backend/.env</code> फ़ाइल खोलें।
            </div>
            <div>
              2. <code>AI_PROVIDER=gemini</code> या <code>AI_PROVIDER=ollama</code> सेट करके सेव करें।
            </div>
          </div>
        </div>

        {/* Gemini Configuration Card */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
              ⚡ Google Gemini API स्थिति:
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                background: backendStatus.geminiConfigured
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(245, 158, 11, 0.2)',
                color: backendStatus.geminiConfigured ? '#34d399' : '#fbbf24',
              }}
            >
              {backendStatus.geminiConfigured ? 'कॉन्फ़िगर है ✅' : '.env में अनुपस्थित'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Google Gemini API Key को केवल <code>backend/.env</code> फ़ाइल में <code>GEMINI_API_KEY</code> के तहत रखा जाता है।
          </div>
        </div>

        {/* Ollama Configuration Card */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                🦙 Ollama लोकल सर्वर:
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: ollamaStatus.connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: ollamaStatus.connected ? '#34d399' : '#f87171',
                }}
              >
                {ollamaStatus.checking
                  ? 'जाँच हो रही है...'
                  : ollamaStatus.connected
                  ? 'ऑनलाइन (Online)'
                  : 'ऑफ़लाइन (Offline)'}
              </span>
            </div>

            <button
              type="button"
              onClick={checkOllama}
              disabled={ollamaStatus.checking}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-color)',
                color: '#e2e8f0',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} className={ollamaStatus.checking ? 'animate-spin' : ''} />
              <span>पुनः जाँचें</span>
            </button>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            लोकल URL: <code style={{ color: '#38bdf8' }}>{backendStatus.ollamaBaseUrl || 'http://127.0.0.1:11434'}</code>
          </div>

          {ollamaStatus.connected ? (
            <div>
              <div style={{ fontSize: '11px', color: '#a7f3d0', marginBottom: '4px' }}>
                ✓ उपलब्ध मॉडल्स ({ollamaStatus.models.length}): {ollamaStatus.models.join(', ') || 'None'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                डिफ़ॉल्ट टेक्स्ट: <code>{backendStatus.ollamaDefaultModel || 'llama3'}</code> | विजन:{' '}
                <code>{backendStatus.ollamaVisionModel || 'llava'}</code>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                color: '#fef3c7',
                lineHeight: 1.4,
              }}
            >
              टर्मिनल में <code>ollama serve</code> चलाएं तथा मॉडल डाउनलोड करें:{' '}
              <code>ollama pull llama3</code> व <code>ollama pull llava</code>
            </div>
          )}
        </div>

        {/* Database & System Infrastructure Status */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Node.js बैकएंड सर्वर:</span>
            <span style={{ color: backendStatus.status === 'ok' ? '#34d399' : '#f87171', fontWeight: 600 }}>
              {backendStatus.status === 'ok' ? 'ऑनलाइन (Port 5000)' : 'ऑफ़लाइन'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>MongoDB डेटाबेस:</span>
            <span style={{ color: backendStatus.mongoConnected ? '#34d399' : '#f87171', fontWeight: 600 }}>
              {backendStatus.mongoConnected ? 'कनेक्टेड ✅ (साइलेंट ऑटो-सेव)' : 'डिस्कनेक्टेड'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Suwayomi एनीमे/मंगा सर्वर:</span>
            <span style={{ color: backendStatus.suwayomiConnected ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
              {backendStatus.suwayomiConnected ? 'कनेक्टेड (Port 4567) ✅' : 'लोकल पोर्ट 4567'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>FFmpeg वीडियो रेंडरर:</span>
            <span style={{ color: backendStatus.ffmpegAvailable ? '#34d399' : '#38bdf8', fontWeight: 600 }}>
              {backendStatus.ffmpegAvailable ? 'सक्रिय (Active)' : 'ब्राउज़र कैनवास रेंडरर'}
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          className="btn-primary"
          onClick={onClose}
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '13px' }}
        >
          <span>बंद करें (Close)</span>
        </button>
      </div>
    </div>
  );
};
