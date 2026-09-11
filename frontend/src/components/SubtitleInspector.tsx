import React, { useState, useRef } from 'react';
import { Type, Plus, Trash2, AlignCenter, AlignJustify, Palette, Mic, Music, Upload, Volume2, Sparkles } from 'lucide-react';
import { Scene, Subtitle, DEFAULT_SUBTITLE_STYLE, AudioClip } from '../types/video';
import { api } from '../services/api';

interface SubtitleInspectorProps {
  scene: Scene;
  onUpdateScene: (updated: Partial<Scene>) => void;
}

export const SubtitleInspector: React.FC<SubtitleInspectorProps> = ({ scene, onUpdateScene }) => {
  const subtitles = scene.subtitles || [];
  const audioClips = scene.audioClips || [];

  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordDurationRef = useRef<number>(0);

  const handleGenerateAIVoice = async () => {
    const text = (subtitles.map((s) => s.text).join(' ').trim()) || scene.narration || scene.title;
    if (!text) {
      alert('कृपया पहले सबटाइटल या नरेशन लिखें');
      return;
    }
    try {
      setIsGeneratingTts(true);
      const updatedScene = await api.generateSceneVoice({
        scene,
        voice: 'hi-IN-MadhurNeural',
        text,
      });
      if (updatedScene) {
        onUpdateScene(updatedScene);
      }
    } catch (err: any) {
      alert(`AI वॉइस जनरेशन विफल: ${err.message}`);
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.uploadMedia(file);
      const newClip: AudioClip = {
        id: `audio_${Date.now()}`,
        url: res.url,
        name: file.name,
        duration: scene.duration,
        startTime: 0,
        volume: 1,
        type: 'voiceover',
      };
      onUpdateScene({ audioClips: [...audioClips, newClip] });
    } catch (err: any) {
      alert(`Audio upload failed: ${err.message}`);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordDurationRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const recordedSecs = Math.max(1, recordDurationRef.current);
        const newSlideDuration = Math.max(scene.duration, recordedSecs + 0.5);

        // Also extend subtitles to cover recording duration
        const adjustedSubs = subtitles.map((sub) => ({
          ...sub,
          endTime: Math.max(sub.endTime, Math.min(newSlideDuration - 0.2, recordedSecs)),
        }));

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

        try {
          const res = await api.uploadMedia(file);
          const newClip: AudioClip = {
            id: `audio_${Date.now()}`,
            url: res.url,
            name: `My Voiceover (${recordedSecs}s)`,
            duration: recordedSecs,
            startTime: 0,
            volume: 1,
            type: 'voiceover',
          };
          onUpdateScene({
            audioClips: [...audioClips, newClip],
            duration: Math.round(newSlideDuration * 10) / 10,
            subtitles: adjustedSubs.length ? adjustedSubs : undefined,
          });
        } catch {
          const localUrl = URL.createObjectURL(blob);
          const newClip: AudioClip = {
            id: `audio_${Date.now()}`,
            url: localUrl,
            name: `My Voiceover (${recordedSecs}s)`,
            duration: recordedSecs,
            startTime: 0,
            volume: 1,
            type: 'voiceover',
          };
          onUpdateScene({
            audioClips: [...audioClips, newClip],
            duration: Math.round(newSlideDuration * 10) / 10,
            subtitles: adjustedSubs.length ? adjustedSubs : undefined,
          });
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = window.setInterval(() => {
        recordDurationRef.current += 1;
        setRecordDuration(recordDurationRef.current);
      }, 1000);
    } catch (err: any) {
      alert(`Microphone error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleDeleteAudio = (clipId: string) => {
    onUpdateScene({ audioClips: audioClips.filter((c) => c.id !== clipId) });
  };

  const handleAddSubtitle = () => {
    const newSub: Subtitle = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: 'New Subtitle Caption',
      startTime: 0,
      endTime: Math.min(3, scene.duration),
      style: { ...DEFAULT_SUBTITLE_STYLE },
    };
    onUpdateScene({ subtitles: [...subtitles, newSub] });
  };

  const handleUpdateSubtitle = (index: number, updated: Partial<Subtitle>) => {
    const next = [...subtitles];
    next[index] = { ...next[index], ...updated };
    onUpdateScene({ subtitles: next });
  };

  const handleDeleteSubtitle = (index: number) => {
    onUpdateScene({ subtitles: subtitles.filter((_, i) => i !== index) });
  };

  return (
    <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Type size={18} color="var(--primary-cyan)" />
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
            Subtitles & Narration
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-secondary"
            onClick={handleAddSubtitle}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            <Plus size={14} />
            <span>Add Caption</span>
          </button>
        </div>
      </div>

      {/* Voiceover / Narration Script preview */}
      {scene.narration && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          borderRadius: '8px',
          padding: '10px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Mic size={14} color="#c084fc" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase' }}>
              Gemini Voiceover Script
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#e2e8f0', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
            "{scene.narration}"
          </p>
        </div>
      )}

      {/* Subtitles List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
        {subtitles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: 'var(--text-muted)',
            fontSize: '13px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
          }}>
            No subtitles on this slide. Click "+ Add Caption" to create one.
          </div>
        ) : (
          subtitles.map((sub, idx) => (
            <div
              key={sub.id || idx}
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Text Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={sub.text}
                  onChange={(e) => handleUpdateSubtitle(idx, { text: e.target.value })}
                  placeholder="Enter caption text..."
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
                <button
                  className="btn-icon"
                  onClick={() => handleDeleteSubtitle(idx)}
                  title="Delete Caption"
                  style={{ color: '#f87171' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Timing & Position Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                {/* Timing */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>Time:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={scene.duration}
                    value={sub.startTime}
                    onChange={(e) => handleUpdateSubtitle(idx, { startTime: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '46px',
                      padding: '3px 4px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}
                  />
                  <span>s to</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={scene.duration}
                    value={sub.endTime}
                    onChange={(e) => handleUpdateSubtitle(idx, { endTime: parseFloat(e.target.value) || scene.duration })}
                    style={{
                      width: '46px',
                      padding: '3px 4px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-color)',
                      color: '#fff',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}
                  />
                  <span>s</span>
                </div>

                {/* Position */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {(['top', 'center', 'bottom'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => handleUpdateSubtitle(idx, { style: { ...sub.style, position: pos } })}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        border: 'none',
                        background: sub.style?.position === pos ? 'var(--primary-cyan)' : 'rgba(255, 255, 255, 0.08)',
                        color: sub.style?.position === pos ? '#000000' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Voiceover & Audio for Scene */}
      <div style={{
        marginTop: '8px',
        paddingTop: '14px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Music size={16} color="var(--primary-cyan)" />
            <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Slide Audio & Voiceover</h4>
          </div>
          <label style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--primary-cyan)',
          }}>
            <Upload size={12} />
            <span>Upload</span>
            <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAudioUpload} />
          </label>
        </div>

        {/* AI Generate Voice Button & Record button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className="btn-secondary glow-hover"
            onClick={handleGenerateAIVoice}
            disabled={isGeneratingTts}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderColor: 'rgba(6, 182, 212, 0.45)',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.15))',
              color: '#38bdf8',
              fontWeight: 600,
            }}
            title="Madhur (हिंदी पुरुष) न्यूरल वॉइस से इस सीन का डायलॉग बोलें"
          >
            <Sparkles size={14} color="var(--primary-cyan)" className={isGeneratingTts ? 'animate-spin' : ''} />
            <span>{isGeneratingTts ? 'न्यूरल वॉइस तैयार हो रही है... 🎙️' : '⚡ AI न्यूरल वॉइस बनाएं (Madhur Hindi)'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isRecording ? (
              <button
                className="btn-secondary"
                onClick={startRecording}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                }}
              >
                <Mic size={15} color="#f87171" />
                <span>अपनी आवाज़ में रिकॉर्ड करें (Mic)</span>
              </button>
            ) : (
            <button
              className="btn-secondary"
              onClick={stopRecording}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                borderColor: '#ef4444',
                color: '#fca5a5',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span>Stop Recording ({recordDuration}s)</span>
            </button>
          )}
          </div>
        </div>

        {/* Live Teleprompter when Recording */}
        {isRecording && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                Live Teleprompter — Read Aloud Now ({recordDuration}s):
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', lineHeight: 1.5, background: 'rgba(0,0,0,0.4)', padding: '10px 12px', borderRadius: '6px' }}>
              {subtitles.length > 0
                ? subtitles.map((s) => s.text).join(' ')
                : (scene.narration || 'Speak your narration now!')}
            </div>
          </div>
        )}


        {/* Attached Audio Clips list */}
        {audioClips.map((clip) => (
          <div
            key={clip.id}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <Volume2 size={14} color="var(--primary-cyan)" />
              <span style={{ fontSize: '11px', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {clip.name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <audio controls src={clip.url} style={{ height: '26px', width: '130px' }} />
              <button
                onClick={() => handleDeleteAudio(clip.id)}
                style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                title="Remove Audio"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
