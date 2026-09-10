import React, { useState } from 'react';
import { X, Key, Check, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  backendStatus: { status: string; geminiConfigured: boolean; ffmpegAvailable: boolean };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  backendStatus,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(inputKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
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
        maxWidth: '480px',
        padding: '28px',
        position: 'relative',
      }}>
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
            <Key size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              Gemini AI Settings
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Configure your Google Gemini API subscription key
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>
              Gemini API Key:
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '11px',
                color: '#38bdf8',
                textDecoration: 'underline',
                fontWeight: 600,
              }}
            >
              फ्री API Key प्राप्त करें (Google AI Studio) ↗
            </a>
          </div>
          <input
            type="text"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="AIzaSy..."
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: inputKey.startsWith('AQ.')
                ? '1px solid #ef4444'
                : '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
            }}
          />

          {inputKey.startsWith('AQ.') && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '11px',
              lineHeight: 1.4,
            }}>
              ⚠️ <strong>अमान्य क्रेडेंशियल प्रकार (ACCESS_TOKEN_TYPE_UNSUPPORTED):</strong>
              <br />
              यह कुंजी (जो <code>AQ.</code> से शुरू हो रही है) एक आंतरिक IDE टोकन है। Google Gemini API के लिए आधिकारिक Key हमेशा <code>AIzaSy...</code> से शुरू होती है। कृपया ऊपर दिए गए लिंक से फ्री API Key बनाकर यहाँ पेस्ट करें।
            </div>
          )}

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
            💡 <strong>नोट:</strong> Google Gemini API Key <code>AIzaSy...</code> से शुरू होती है। यह सीधे Google AI Studio से 100% मुफ़्त मिलती है।
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Backend Server:</span>
            <span style={{ color: backendStatus.status === 'ok' ? '#34d399' : '#f87171', fontWeight: 600 }}>
              {backendStatus.status === 'ok' ? 'Online (localhost:5000)' : 'Offline'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Client Video Exporter:</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>
              Active (Canvas + WebCodecs)
            </span>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleSave}
          style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
        >
          {saved ? (
            <>
              <Check size={18} />
              <span>Saved!</span>
            </>
          ) : (
            <span>Save API Key</span>
          )}
        </button>
      </div>
    </div>
  );
};
