import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { voiceService } from '../services/voiceService';
import { setReferenceVoice, removeReferenceVoice } from '../redux/slices/referenceVoiceSlice';
import { updateUserReferenceVoice } from '../redux/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import { showNotification } from '../redux/slices/uiSlice';
import { Mic, CheckCircle2, Upload, Trash2, Play, Volume2, Sparkles, AlertCircle } from 'lucide-react';

export const VoiceView: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { voice } = useAppSelector((state) => state.referenceVoice);
  const { user } = useAppSelector((state) => state.auth);

  const [voiceName, setVoiceName] = useState('Deep Cinematic Narrator');
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    voiceService.getReferenceVoice().then((res) => {
      dispatch(setReferenceVoice(res.referenceVoice));
    }).catch(console.error);
  }, [dispatch]);

  const handleSetVoice = async () => {
    if (!voiceFile) {
      dispatch(showNotification({ message: 'Please choose an audio file for your reference voice.', type: 'error' }));
      return;
    }
    setIsUploading(true);
    try {
      const res = await voiceService.setReferenceVoice({
        file: voiceFile,
        name: voiceName,
        provider: 'Custom / Cloudinary'
      });
      dispatch(setReferenceVoice(res.referenceVoice));
      dispatch(updateUserReferenceVoice(res.referenceVoice));
      dispatch(showNotification({
        message: 'Reference Voice set! Old reference voice replaced as per 1-voice constraint.',
        type: 'success'
      }));
    } catch (err: any) {
      dispatch(showNotification({ message: 'Error: ' + err.message, type: 'error' }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVoice = async () => {
    if (confirm('Delete your single storytelling reference voice?')) {
      await voiceService.deleteReferenceVoice();
      dispatch(removeReferenceVoice());
      dispatch(updateUserReferenceVoice(null));
      dispatch(showNotification({ message: 'Reference Voice removed.', type: 'info' }));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Title & One-Voice Constraint Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">Reference Storytelling Voice Manager</h1>
            <p className="text-xs text-zinc-400">
              System enforces <span className="text-pink-400 font-bold uppercase">ONE and ONLY ONE</span> reference voice per user account.
            </p>
          </div>
        </div>

        <div className="p-3 bg-pink-950/20 border border-pink-500/30 rounded-xl text-xs text-pink-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-pink-400 mt-0.5" />
          <p>
            When you register or replace your voice, the previous reference audio file will be automatically purged from Cloudinary and database records. All chapter narrations generated thereafter will use this single reference voice for 100% consistent storytelling tone.
          </p>
        </div>
      </div>

      {/* Active Voice Card or Empty State */}
      {voice ? (
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">{voice.name}</h3>
                <p className="text-xs text-zinc-400">Provider: {voice.provider || 'Cloudinary TTS'}</p>
              </div>
            </div>

            <button
              onClick={handleDeleteVoice}
              className="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900 text-rose-300 text-xs font-semibold flex items-center gap-1.5 border border-rose-500/30"
            >
              <Trash2 className="w-3.5 h-3.5" /> Purge Reference Voice
            </button>
          </div>

          {/* Audio Player */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-300">Reference Sample Audio Player</span>
            <audio controls src={voice.audioUrl} className="w-full h-10 rounded-lg" />
          </div>

          <div className="pt-3 flex justify-end">
            <button
              onClick={() => navigate('/story-studio')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Continue to Story Studio
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-zinc-100">Upload / Configure Reference Voice</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Voice Name</label>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Voice Audio Sample File</label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setVoiceFile(e.target.files?.[0] || null)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-pink-600 file:text-white file:text-xs file:font-semibold file:cursor-pointer"
              />
              {voiceFile && (
                <p className="mt-1.5 text-[10px] text-zinc-400 font-mono truncate">
                  Selected: {voiceFile.name} ({(voiceFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <button
              onClick={handleSetVoice}
              disabled={isUploading || !voiceFile}
              className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-pink-600/30"
            >
              <Upload className="w-4 h-4" /> Save Reference Voice (Enforce 1-Voice Rule)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
