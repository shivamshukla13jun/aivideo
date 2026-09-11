import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  Volume2,
  Play,
  Pause,
  Upload,
  Sparkles,
  CheckCircle2,
  Loader2,
  Music,
  Trash2,
  RefreshCw,
  Layers,
  FileAudio,
} from 'lucide-react';
import { Scene } from '../types/video';
import { api } from '../services/api';

interface VoiceoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  selectedSceneIndex: number;
  onUpdateScenes: (updatedScenes: Scene[]) => void;
  onUpdateSingleScene?: (index: number, updated: Partial<Scene>) => void;
}

export interface VoiceItem {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  description: string;
}

const DEFAULT_VOICES: VoiceItem[] = [
  {
    id: 'hi-IN-MadhurNeural',
    name: 'Madhur (मधुर)',
    language: 'hi-IN (हिंदी)',
    gender: 'male',
    description: 'गंभीर, शक्तिशाली और स्पष्ट कथावाचक (एनीमे नरेटर)',
  },
  {
    id: 'hi-IN-SwaraNeural',
    name: 'Swara (स्वरा)',
    language: 'hi-IN (हिंदी)',
    gender: 'female',
    description: 'मधुर, संवेदनशील और प्रभावशाली महिला आवाज़',
  },
  {
    id: 'en-US-ChristopherNeural',
    name: 'Christopher (Anime Narrator)',
    language: 'en-US (English)',
    gender: 'male',
    description: 'Deep, cinematic anime narrator voice (Epic Fantasy)',
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy (Shonen Hero)',
    language: 'en-US (English)',
    gender: 'male',
    description: 'Energetic, brave protagonist voice (Action / Adventure)',
  },
  {
    id: 'en-US-JennyNeural',
    name: 'Jenny (Warm Heroine)',
    language: 'en-US (English)',
    gender: 'female',
    description: 'Warm, expressive female voice (Anime / Drama)',
  },
  {
    id: 'en-US-AriaNeural',
    name: 'Aria (Storyteller)',
    language: 'en-US (English)',
    gender: 'female',
    description: 'Dynamic storytelling voice',
  },
  {
    id: 'ja-JP-KeitaNeural',
    name: 'Keita (けいた)',
    language: 'ja-JP (Japanese)',
    gender: 'male',
    description: 'Classic Japanese anime male voice',
  },
  {
    id: 'ja-JP-NanamiNeural',
    name: 'Nanami (ななみ)',
    language: 'ja-JP (Japanese)',
    gender: 'female',
    description: 'Classic Japanese anime female voice',
  },
];

export const VoiceoverModal: React.FC<VoiceoverModalProps> = ({
  isOpen,
  onClose,
  scenes,
  selectedSceneIndex,
  onUpdateScenes,
  onUpdateSingleScene,
}) => {
  const [voices, setVoices] = useState<VoiceItem[]>(DEFAULT_VOICES);
  const [selectedVoice, setSelectedVoice] = useState<string>('hi-IN-MadhurNeural');
  const [targetScope, setTargetScope] = useState<'all' | 'single'>('all');

  // Sample audio upload & voice cloning
  const [sampleAudioUrl, setSampleAudioUrl] = useState<string>('');
  const [sampleAudioName, setSampleAudioName] = useState<string>('');
  const [isUploadingSample, setIsUploadingSample] = useState<boolean>(false);

  // Generation state & progress
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Audio preview player
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const sampleFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getTtsVoices().then((res) => {
        if (res && res.length > 0) setVoices(res);
      }).catch(() => {});
    }
  }, [isOpen]);

  const handleTogglePlay = (url: string) => {
    if (playingAudioUrl === url) {
      audioPlayerRef.current?.pause();
      setPlayingAudioUrl(null);
    } else {
      setPlayingAudioUrl(url);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play().catch(() => setPlayingAudioUrl(null));
      }
    }
  };

  const handleSampleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingSample(true);
    setError(null);
    try {
      const res = await api.uploadSampleAudio(file);
      if (res && res.sampleAudioUrl) {
        setSampleAudioUrl(res.sampleAudioUrl);
        setSampleAudioName(file.name);
        setSuccessMsg(`सैंपल ऑडियो "${file.name}" सफलतापूर्वक अपलोड हो गया!`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'सैंपल ऑडियो अपलोड करने में त्रुटि हुई');
    } finally {
      setIsUploadingSample(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccessMsg(null);
    setProgressPercent(5);
    setProgressMsg('टेक्स्ट-टू-स्पीच इंजन शुरू हो रहा है...');

    try {
      if (targetScope === 'single') {
        const scene = scenes[selectedSceneIndex];
        if (!scene) throw new Error('कोई स्लाइड चुनी नहीं गई है');

        setProgressMsg(`स्लाइड #${selectedSceneIndex + 1} के लिए वॉइसओवर तैयार हो रहा है... 🎙️`);
        setProgressPercent(50);

        const updated = await api.generateSceneVoice({
          scene,
          voice: selectedVoice,
          sampleAudioUrl: sampleAudioUrl || undefined,
        });

        if (updated) {
          if (onUpdateSingleScene) {
            onUpdateSingleScene(selectedSceneIndex, updated);
          } else {
            const copy = [...scenes];
            copy[selectedSceneIndex] = updated;
            onUpdateScenes(copy);
          }
          setSuccessMsg(`स्लाइड #${selectedSceneIndex + 1} का वॉइसओवर सफलतापूर्वक तैयार हुआ! ✅`);
        }
      } else {
        // Generate for all scenes
        setProgressMsg(`सभी ${scenes.length} स्लाइड्स के लिए वॉइसओवर तैयार किया जा रहा है... 🎙️`);
        setProgressPercent(15);

        const result = await api.generateAllScenesVoice({
          scenes,
          voice: selectedVoice,
          sampleAudioUrl: sampleAudioUrl || undefined,
        });

        if (result && result.scenes) {
          onUpdateScenes(result.scenes);
          setSuccessMsg(`सभी ${result.scenes.length} स्लाइड्स में वॉइसओवर सफलतापूर्वक जुड़ गया! ✅`);
        }
      }
    } catch (err: any) {
      console.error('[Voiceover Generation Error]', err);
      setError(err.message || 'वॉइसओवर जनरेट करने में त्रुटि हुई');
    } finally {
      setIsGenerating(false);
      setProgressPercent(100);
      setTimeout(() => setProgressPercent(0), 1000);
    }
  };

  const handleDeleteSceneAudio = (index: number) => {
    const copy = [...scenes];
    copy[index] = { ...copy[index], audioClips: [] };
    onUpdateScenes(copy);
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
      <audio
        ref={audioPlayerRef}
        onEnded={() => setPlayingAudioUrl(null)}
        style={{ display: 'none' }}
      />

      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(139, 92, 246, 0.25)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          background: '#0a0e17',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(6, 182, 212, 0.25))',
                border: '1px solid var(--primary-violet)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mic size={22} color="var(--primary-violet)" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                ऑटो वॉइसओवर व टेक्स्ट-टू-स्पीच इंजन (TTS Engine)
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                सर्वश्रेष्ठ न्यूरल मॉडल्स या अपने सैंपल ऑडियो से प्रत्येक सीन के लिए सजीव आवाज़ जनरेट करें
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: '34px', height: '34px' }}
            title="बंद करें"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Target Scope Selection */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              आवाज़ कहाँ जोड़ें? (Generation Scope)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setTargetScope('all')}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: targetScope === 'all' ? '2px solid var(--primary-violet)' : '1px solid var(--border-color)',
                  background: targetScope === 'all' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  color: targetScope === 'all' ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Layers size={20} color={targetScope === 'all' ? 'var(--primary-violet)' : 'currentColor'} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>सभी सीन्स ({scenes.length} Slides)</div>
                  <div style={{ fontSize: '11px', opacity: 0.75 }}>सभी सबटाइटल्स को ऑटोमैटिक आवाज़ में बदलें</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope('single')}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: targetScope === 'single' ? '2px solid var(--primary-cyan)' : '1px solid var(--border-color)',
                  background: targetScope === 'single' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  color: targetScope === 'single' ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Mic size={20} color={targetScope === 'single' ? 'var(--primary-cyan)' : 'currentColor'} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>केवल स्लाइड #{selectedSceneIndex + 1}</div>
                  <div style={{ fontSize: '11px', opacity: 0.75 }}>वर्तमान चयनित सीन के लिए आवाज़ बनाएं</div>
                </div>
              </button>
            </div>
          </div>

          {/* Neural Voice Model Selection */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              सर्वश्रेष्ठ न्यूरल आवाज़ चुनें (Best AI Voice Model)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              {voices.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoice(v.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid var(--primary-violet)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                        {v.name}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: v.language.includes('hi') ? 'rgba(234, 88, 12, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                          color: v.language.includes('hi') ? '#fb923c' : '#38bdf8',
                          fontWeight: 600,
                        }}
                      >
                        {v.language.split(' ')[0]}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      {v.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sample Audio Upload / Voice Cloning Card */}
          <div
            className="glass-panel"
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: sampleAudioUrl ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid var(--border-color)',
              background: 'rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--primary-violet)" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  अपना वॉइस सैंपल जोड़ें (Voice Cloning with Your Sample Audio)
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                वैकल्पिक (Optional)
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              यदि आपके पास अपनी या किसी पात्र की 5-30 सेकंड की आवाज़ का ऑडियो है, तो उसे यहाँ अपलोड करें। AI आपकी आवाज़ के स्टाइल और टोन को क्लोन करके सभी सीन्स में बोलेगा!
            </p>

            {/* Hidden file input */}
            <input
              type="file"
              ref={sampleFileInputRef}
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={handleSampleAudioUpload}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isUploadingSample}
                onClick={() => sampleFileInputRef.current?.click()}
                style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isUploadingSample ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                <span>{sampleAudioUrl ? 'दूसरा सैंपल बदलें' : '📁 ऑडियो सैंपल अपलोड करें (.mp3 / .wav)'}</span>
              </button>

              {sampleAudioUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(139, 92, 246, 0.15)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <FileAudio size={16} color="var(--primary-violet)" />
                  <span style={{ fontSize: '12px', color: '#c4b5fd', fontWeight: 600 }}>
                    {sampleAudioName || 'sample_voice.mp3'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePlay(sampleAudioUrl)}
                    className="btn-icon"
                    style={{ width: '26px', height: '26px' }}
                    title="सुनें"
                  >
                    {playingAudioUrl === sampleAudioUrl ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSampleAudioUrl('');
                      setSampleAudioName('');
                    }}
                    className="btn-icon"
                    style={{ width: '26px', height: '26px', color: '#f87171' }}
                    title="हटाएं"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* .env Voice Cloning Info Note */}
            {sampleAudioUrl && (
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  💡 <strong>नोट:</strong> ElevenLabs वॉइस क्लोनिंग API Key को सर्वर की <code>backend/.env</code> फ़ाइल में <code>ELEVENLABS_API_KEY</code> के तहत सुरक्षित किया जाता है। यदि यह खाली है, तो सिस्टम स्वतः सर्वोत्तम न्यूरल TTS का उपयोग करता है।
                </p>
              </div>
            )}
          </div>

          {/* Current Scenes Audio Status Overview */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                वर्तमान सीन्स ऑडियो स्थिति ({scenes.filter((s) => s.audioClips && s.audioClips.length > 0).length}/{scenes.length} में आवाज़ मौजूद)
              </span>
            </div>

            <div
              style={{
                maxHeight: '150px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '4px',
              }}
            >
              {scenes.map((scene, idx) => {
                const hasAudio = scene.audioClips && scene.audioClips.length > 0;
                const audio = hasAudio ? scene.audioClips[0] : null;
                const subText = scene.subtitles?.map((s) => s.text).join(' ') || scene.narration || '';

                return (
                  <div
                    key={scene.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: hasAudio ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-cyan)', width: '32px' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '12px', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '380px' }}>
                        {subText ? `"${subText}"` : '(कोई सबटाइटल नहीं)'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {hasAudio && audio ? (
                        <>
                          <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600 }}>
                            {audio.duration}s
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTogglePlay(audio.url)}
                            className="btn-icon"
                            style={{ width: '26px', height: '26px' }}
                            title="सुनें"
                          >
                            {playingAudioUrl === audio.url ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSceneAudio(idx)}
                            className="btn-icon"
                            style={{ width: '26px', height: '26px', color: '#f87171' }}
                            title="ऑडियो हटाएं"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          कोई आवाज़ नहीं
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress / Success / Error Alerts */}
          {isGenerating && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid var(--primary-violet)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Loader2 size={18} color="var(--primary-violet)" className="spin" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  {progressMsg}
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary-cyan), var(--primary-violet))',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(74, 222, 128, 0.15)',
                border: '1px solid #4ade80',
                color: '#4ade80',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#f87171',
                fontSize: '13px',
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
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
            <span>जनरेट किया गया ऑडियो स्वचालित रूप से MongoDB में सुरक्षित होगा ✅</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              रद्द करें
            </button>

            <button
              type="button"
              className="btn-primary"
              disabled={isGenerating}
              onClick={handleGenerate}
              style={{
                padding: '8px 24px',
                fontSize: '13px',
                background: 'linear-gradient(135deg, var(--primary-violet), var(--primary-cyan))',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>वॉइस तैयार हो रही है...</span>
                </>
              ) : (
                <>
                  <Mic size={16} />
                  <span>
                    {targetScope === 'all'
                      ? `सभी ${scenes.length} सीन्स के लिए ऑडियो बनाएं`
                      : `स्लाइड #${selectedSceneIndex + 1} के लिए ऑडियो बनाएं`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
