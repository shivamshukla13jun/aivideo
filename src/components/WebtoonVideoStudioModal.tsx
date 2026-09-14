import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Users,
  Video,
  FileText,
  Music,
  Zap,
  Clock,
  Download,
  Edit3,
  Check,
  RefreshCw,
  Film,
  MessageSquare,
  Crop,
  Eye,
  EyeOff,
  Mic,
  Upload,
  Trash2,
  Scissors,
  Square,
  Circle,
  Plus,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Filter,
  Layers,
  Gauge,
} from 'lucide-react';
import { Manga, Chapter, WebtoonScript, WebtoonPanel, WebtoonCharacter, WebtoonCropRect, WebtoonIncident } from '../types.js';

export interface WebtoonFlatScene {
  sceneId: string;
  globalIndex: number;
  panelIndex: number;
  incidentIndex?: number;
  sceneTitle: string;
  pageUrl: string;
  cropRect: { topPct: number; heightPct: number };
  speaker: string;
  dialogueHindi: string;
  dialogueEnglish?: string;
  characterAction?: string;
  characterSays?: string;
  userAudioUrl?: string;
  userAudioDuration?: number;
  sfx: string;
  bgmSuggestion: string;
  actionDescription: string;
  estimatedDurationSec: number;
}

/**
 * Calculates recommended scene duration (in seconds) dynamically from subtitle dialogue
 * and speed multiplier. Clamped between 2.5s and 20s.
 */
export function calculateDurationFromSubtitle(
  dialogue?: string,
  speedMultiplier: number = 1.0
): number {
  if (!dialogue || !dialogue.trim()) {
    return Math.max(2, Math.round(3.5 / speedMultiplier));
  }
  const clean = dialogue.trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  const chars = clean.length;

  // Natural speaking & reading pace: ~2.3 words/sec with 1.2s padding for pauses & visuals
  const timeFromWords = (words / 2.3) + 1.2;
  // Natural character pace: ~14 characters/sec with 1.0s padding
  const timeFromChars = (chars / 14) + 1.0;

  const baseDuration = Math.max(timeFromWords, timeFromChars);
  // Clamped between 2.5s and 20s
  const clampedBase = Math.min(20, Math.max(2.5, Math.round(baseDuration * 10) / 10));

  return Math.max(1.5, Math.round((clampedBase / speedMultiplier) * 10) / 10);
}

export function getFlatScenes(script: WebtoonScript | null, disableCropping = false): WebtoonFlatScene[] {
  if (!script || !script.panels) return [];

  const scenes: WebtoonFlatScene[] = [];
  let globalCount = 0;

  script.panels.forEach((panel) => {
    if (panel.skipped) return;

    if (panel.incidents && panel.incidents.length > 0) {
      panel.incidents.forEach((inc, iIdx) => {
        globalCount++;
        const dHindi = inc.dialogueHindi || panel.dialogueHindi || `वेबटून दृश्य ${iIdx + 1} संवाद`;
        const dEnglish = inc.dialogueEnglish || panel.dialogueEnglish || `Webtoon scene ${iIdx + 1} dialogue`;
        const autoDuration = calculateDurationFromSubtitle(dHindi || dEnglish);
        const finalDuration = inc.userAudioDuration ||
          panel.userAudioDuration ||
          (inc.estimatedDurationSec && inc.estimatedDurationSec !== 4 ? inc.estimatedDurationSec : autoDuration) ||
          autoDuration;

        scenes.push({
          sceneId: `p${panel.panelIndex}_i${inc.incidentIndex || iIdx + 1}`,
          globalIndex: globalCount,
          panelIndex: panel.panelIndex,
          incidentIndex: inc.incidentIndex || iIdx + 1,
          sceneTitle: inc.incidentTitle || `पैनल ${panel.panelIndex} - दृश्य ${iIdx + 1}`,
          pageUrl: panel.pageUrl,
          cropRect: disableCropping ? { topPct: 0, heightPct: 100 } : (inc.cropRect || { topPct: Math.min(iIdx * 25, 75), heightPct: 25 }),
          speaker: inc.speaker || panel.speaker || 'सूत्रधार',
          dialogueHindi: dHindi,
          dialogueEnglish: dEnglish,
          characterAction: inc.characterAction || panel.characterAction,
          characterSays: inc.characterSays || panel.characterSays,
          userAudioUrl: inc.userAudioUrl || panel.userAudioUrl,
          userAudioDuration: inc.userAudioDuration || panel.userAudioDuration,
          sfx: inc.sfx || panel.sfx || 'सरसराहट',
          bgmSuggestion: panel.bgmSuggestion || 'सिनेमैटिक BGM',
          actionDescription: inc.actionDescription || panel.actionDescription || 'वेबटून कैमरा ज़ूम',
          estimatedDurationSec: finalDuration,
        });
      });
    } else {
      const cropRect = disableCropping ? { topPct: 0, heightPct: 100 } : (panel.cropRect || { topPct: 0, heightPct: 100 });
      globalCount++;
      const dHindi = panel.dialogueHindi || 'वेबटून दृश्य संवाद';
      const dEnglish = panel.dialogueEnglish || 'Webtoon scene dialogue';
      const autoDuration = calculateDurationFromSubtitle(dHindi || dEnglish);
      const finalDuration = panel.userAudioDuration ||
        (panel.estimatedDurationSec && panel.estimatedDurationSec !== 4 ? panel.estimatedDurationSec : autoDuration) ||
        autoDuration;

      scenes.push({
        sceneId: `p${panel.panelIndex}_i1`,
        globalIndex: globalCount,
        panelIndex: panel.panelIndex,
        incidentIndex: 1,
        sceneTitle: `पैनल ${panel.panelIndex} - संपूर्ण दृश्य`,
        pageUrl: panel.pageUrl,
        cropRect,
        speaker: panel.speaker || 'सूत्रधार',
        dialogueHindi: dHindi,
        dialogueEnglish: dEnglish,
        characterAction: panel.characterAction,
        characterSays: panel.characterSays,
        userAudioUrl: panel.userAudioUrl,
        userAudioDuration: panel.userAudioDuration,
        sfx: panel.sfx || 'सरसराहट',
        bgmSuggestion: panel.bgmSuggestion || 'सिनेमैटिक BGM',
        actionDescription: panel.actionDescription || 'वेबटून कैमरा ज़ूम',
        estimatedDurationSec: finalDuration,
      });
    }
  });

  return scenes;
}

export interface WebtoonVideoStudioModalProps {
  manga: Manga;
  chapter: Chapter;
  onClose: () => void;
  isPageMode?: boolean;
  onNavigateToLibrary?: () => void;
  allChapters?: Chapter[];
  onSelectChapter?: (chapter: Chapter) => void;
  onChangeManga?: () => void;
}

export const WebtoonVideoStudioModal: React.FC<WebtoonVideoStudioModalProps> = ({
  manga,
  chapter,
  onClose,
  isPageMode = false,
  onNavigateToLibrary,
  allChapters = [],
  onSelectChapter,
  onChangeManga,
}) => {
  const [activeTab, setActiveTab] = useState<'story' | 'editor' | 'player'>('story');
  const [script, setScript] = useState<WebtoonScript | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Audio Playback State
  const [selectedAiModel, setSelectedAiModel] = useState<string>('gemini-3.1-pro-preview');
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
  const [playingPanelIndex, setPlayingPanelIndex] = useState<number | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(false);
  const [currentVideoPanelIdx, setCurrentVideoPanelIdx] = useState<number>(0);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [studioVoiceMode, setStudioVoiceMode] = useState<'human' | 'sample_narrator'>('human');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0); // 0.5, 0.75, 1.0, 1.25, 1.5, 2.0

  // Clean Image, Incidents & Voice Sample Manager States
  const [hideSubtitlesVideo, setHideSubtitlesVideo] = useState<boolean>(false);
  const [disableCropping, setDisableCropping] = useState<boolean>(false);
  const [showVoiceManagerModal, setShowVoiceManagerModal] = useState<boolean>(false);
  const [hasVoiceSample, setHasVoiceSample] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [extractingPanelIdx, setExtractingPanelIdx] = useState<number | null>(null);

  // Timeline Video Editing States (Take/Exclude, Reorder, Duration, Subtitle Styling)
  const [sceneExclusions, setSceneExclusions] = useState<Record<string, boolean>>({});
  const [sceneDurations, setSceneDurations] = useState<Record<string, number>>({});
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'included' | 'excluded'>('all');
  const [subtitlePos, setSubtitlePos] = useState<'bottom' | 'center' | 'top'>('bottom');
  const [subtitleSize, setSubtitleSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [subtitleColor, setSubtitleColor] = useState<'yellow' | 'white' | 'cyan'>('yellow');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const triggerToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3200);
  };

  // Interactive Custom Crop & Multi-Scene Studio Modal State
  const [cropModalPanel, setCropModalPanel] = useState<WebtoonPanel | null>(null);
  const [customTopPct, setCustomTopPct] = useState<number>(0);
  const [customHeightPct, setCustomHeightPct] = useState<number>(25);
  const [customDialogue, setCustomDialogue] = useState<string>('दृश्य का संवाद...');
  const [customSpeaker, setCustomSpeaker] = useState<string>('सूत्रधार');

  // Interactive Mouse/Touch Cursor Hand Drag State
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeDragMode, setActiveDragMode] = useState<null | 'top' | 'bottom' | 'center' | 'draw'>(null);
  const dragStartYRef = useRef<number>(0);
  const dragStartTopRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);

  const handleCropDragStart = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    mode: 'top' | 'bottom' | 'center' | 'draw'
  ) => {
    e.stopPropagation();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartYRef.current = clientY;
    dragStartTopRef.current = customTopPct;
    dragStartHeightRef.current = customHeightPct;

    if (mode === 'draw' && cropContainerRef.current) {
      const rect = cropContainerRef.current.getBoundingClientRect();
      if (rect.height > 0) {
        const clickYPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        const roundedTop = Math.round(clickYPct);
        setCustomTopPct(roundedTop);
        setCustomHeightPct(20);
        dragStartTopRef.current = roundedTop;
        dragStartHeightRef.current = 20;
      }
    }

    setActiveDragMode(mode);
  };

  useEffect(() => {
    if (!activeDragMode) return;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (!cropContainerRef.current) return;
      const rect = cropContainerRef.current.getBoundingClientRect();
      if (rect.height <= 0) return;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - dragStartYRef.current;
      const deltaPct = (deltaY / rect.height) * 100;

      if (activeDragMode === 'top') {
        const maxTop = dragStartTopRef.current + dragStartHeightRef.current - 5;
        const newTop = Math.max(0, Math.min(maxTop, dragStartTopRef.current + deltaPct));
        const newHeight = (dragStartTopRef.current + dragStartHeightRef.current) - newTop;
        setCustomTopPct(Math.round(newTop));
        setCustomHeightPct(Math.round(newHeight));
      } else if (activeDragMode === 'bottom') {
        const maxH = 100 - dragStartTopRef.current;
        const newHeight = Math.max(5, Math.min(maxH, dragStartHeightRef.current + deltaPct));
        setCustomHeightPct(Math.round(newHeight));
      } else if (activeDragMode === 'center') {
        const maxTop = 100 - dragStartHeightRef.current;
        const newTop = Math.max(0, Math.min(maxTop, dragStartTopRef.current + deltaPct));
        setCustomTopPct(Math.round(newTop));
      } else if (activeDragMode === 'draw') {
        const currentYPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        const newTop = Math.min(dragStartTopRef.current, currentYPct);
        const newHeight = Math.max(5, Math.abs(currentYPct - dragStartTopRef.current));
        setCustomTopPct(Math.round(newTop));
        setCustomHeightPct(Math.round(newHeight));
      }
    };

    const handleGlobalEnd = () => {
      setActiveDragMode(null);
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [activeDragMode]);

  const handleAiVisionScanPanel = async () => {
    if (!script || !cropModalPanel) return;
    setExtractingPanelIdx(cropModalPanel.panelIndex);
    try {
      const res = await fetch('/api/v1/ai/extract-incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: cropModalPanel.pageUrl,
          mangaTitle: manga.title,
          panelIndex: cropModalPanel.panelIndex,
        }),
      });

      if (!res.ok) throw new Error('Failed to extract incidents');

      const data = await res.json();
      if (data && data.incidents && data.incidents.length > 0) {
        const updatedPanels = [...script.panels];
        const pIdx = updatedPanels.findIndex((p) => p.panelIndex === cropModalPanel.panelIndex);
        if (pIdx !== -1) {
          const panel = updatedPanels[pIdx];
          const updatedPanel = { ...panel, incidents: data.incidents };
          updatedPanels[pIdx] = updatedPanel;
          setCropModalPanel(updatedPanel);
          saveScriptEdits({ ...script, panels: updatedPanels });

          setCustomDialogue(data.incidents[0].dialogueHindi || 'दृश्य संवाद');
          setCustomSpeaker(data.incidents[0].speaker || 'सूत्रधार');
          if (data.incidents[0].cropRect) {
            setCustomTopPct(data.incidents[0].cropRect.topPct || 0);
            setCustomHeightPct(data.incidents[0].cropRect.heightPct || 25);
          }
        }
      }
    } catch (err) {
      console.error('Error scanning page story with AI Vision:', err);
    } finally {
      setExtractingPanelIdx(null);
    }
  };

  // Live Audio Recording State
  const [activeVoiceTab, setActiveVoiceTab] = useState<'record' | 'upload'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      setUploadStatus('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setUploadStatus('Microphone access denied or unassigned.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const uploadRecordedAudio = async () => {
    if (!recordedBlob) return;
    setUploadStatus('Saving live recorded voice sample...');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Audio = reader.result as string;
      try {
        const res = await fetch('/api/v1/ai/upload-voice-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Audio,
            fileName: 'sample_narrator.mp3',
          }),
        });

        if (res.ok) {
          setHasVoiceSample(true);
          setStudioVoiceMode('sample_narrator');
          setUploadStatus('Live recording saved as sample voice narration!');
        } else {
          setUploadStatus('Failed to save recorded voice.');
        }
      } catch (err) {
        setUploadStatus('Error saving live recorded audio.');
      }
    };
    reader.readAsDataURL(recordedBlob);
  };

  // Scene-by-Scene Voice Recording State
  const [sceneVoiceAudios, setSceneVoiceAudios] = useState<Record<string, { audioUrl: string; duration: number }>>({});
  const [recordingSceneId, setRecordingSceneId] = useState<string | null>(null);
  const [sceneRecordSeconds, setSceneRecordSeconds] = useState<number>(0);
  const [subtitleLanguage, setSubtitleLanguage] = useState<'English' | 'Hindi'>('English');
  const sceneMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sceneAudioChunksRef = useRef<Blob[]>([]);
  const sceneRecordTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startSceneVoiceRecording = async (sceneId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      sceneMediaRecorderRef.current = mediaRecorder;
      sceneAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          sceneAudioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(sceneAudioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const tempAudio = new Audio(dataUrl);
          tempAudio.onloadedmetadata = () => {
            const rawDur = tempAudio.duration || sceneRecordSeconds || 3;
            const finalDur = Math.max(2, Math.round(rawDur * 10) / 10);

            setSceneVoiceAudios((prev) => ({
              ...prev,
              [sceneId]: { audioUrl: dataUrl, duration: finalDur },
            }));

            // Sync screen time duration according to recorded voice!
            setSceneDurations((prev) => ({
              ...prev,
              [sceneId]: finalDur,
            }));
          };
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecordingSceneId(sceneId);
      setSceneRecordSeconds(0);

      if (sceneRecordTimerRef.current) clearInterval(sceneRecordTimerRef.current);
      sceneRecordTimerRef.current = setInterval(() => {
        setSceneRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone permission required to record scene voice narration.');
    }
  };

  const stopSceneVoiceRecording = () => {
    if (sceneMediaRecorderRef.current && recordingSceneId) {
      sceneMediaRecorderRef.current.stop();
      setRecordingSceneId(null);
      if (sceneRecordTimerRef.current) {
        clearInterval(sceneRecordTimerRef.current);
        sceneRecordTimerRef.current = null;
      }
    }
  };

  const deleteSceneVoiceAudio = (sceneId: string) => {
    setSceneVoiceAudios((prev) => {
      const copy = { ...prev };
      delete copy[sceneId];
      return copy;
    });
  };

  const handleExtractVisionIncidents = async (panelIdx: number, imageUrl: string) => {
    if (!script || !imageUrl) return;
    setExtractingPanelIdx(panelIdx);
    try {
      const res = await fetch('/api/v1/ai/extract-incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          mangaTitle: manga.title,
          panelIndex: panelIdx,
          model: selectedAiModel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.incidents) && data.incidents.length > 0) {
          const updatedPanels = script.panels.map((p) => {
            if (p.panelIndex === panelIdx) {
              return {
                ...p,
                incidents: data.incidents,
              };
            }
            return p;
          });
          const updatedScript = { ...script, panels: updatedPanels };
          saveScriptEdits(updatedScript);
        }
      }
    } catch (e) {
      console.error('[WebtoonStudio] Error extracting vision incidents:', e);
    } finally {
      setExtractingPanelIdx(null);
    }
  };

  const handleRegenerateSingleSceneSubtitle = async (scene: WebtoonFlatScene) => {
    if (!script || !scene.pageUrl) return;
    setRegeneratingSceneId(scene.sceneId);
    try {
      const res = await fetch('/api/v1/ai/extract-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: scene.pageUrl,
          mangaTitle: manga.title,
          panelIndex: scene.panelIndex,
          model: selectedAiModel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedPanels = [...script.panels];
        const pIdx = scene.panelIndex - 1;
        const panel = updatedPanels[pIdx];
        if (panel) {
          if (panel.incidents && scene.incidentIndex) {
            const incs = [...panel.incidents];
            const iIdx = scene.incidentIndex - 1;
            if (incs[iIdx]) {
              incs[iIdx] = {
                ...incs[iIdx],
                dialogueHindi: data.dialogueHindi || incs[iIdx].dialogueHindi,
                dialogueEnglish: data.dialogueEnglish || incs[iIdx].dialogueEnglish,
                speaker: data.speaker || incs[iIdx].speaker,
                characterAction: data.characterAction || incs[iIdx].characterAction,
                characterSays: data.characterSays || incs[iIdx].characterSays,
                sfx: data.sfx || incs[iIdx].sfx,
              };
              updatedPanels[pIdx] = { ...panel, incidents: incs };
            }
          } else {
            updatedPanels[pIdx] = {
              ...panel,
              dialogueHindi: data.dialogueHindi || panel.dialogueHindi,
              dialogueEnglish: data.dialogueEnglish || panel.dialogueEnglish,
              speaker: data.speaker || panel.speaker,
              characterAction: data.characterAction || panel.characterAction,
              characterSays: data.characterSays || panel.characterSays,
              sfx: data.sfx || panel.sfx,
            };
          }
          saveScriptEdits({ ...script, panels: updatedPanels });
        }
      }
    } catch (err) {
      console.error('Error regenerating scene subtitle with Best AI:', err);
    } finally {
      setRegeneratingSceneId(null);
    }
  };

  // Edit states
  const [isEditingStory, setIsEditingStory] = useState<boolean>(false);
  const [editedStoryText, setEditedStoryText] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoTimerRef = useRef<any>(null);

  useEffect(() => {
    fetchOrCreateScript();
    checkVoiceSample();
    return () => {
      stopAudio();
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    };
  }, [manga.id, chapter.id]);

  const checkVoiceSample = async () => {
    try {
      const res = await fetch('/api/v1/ai/voice-sample');
      setHasVoiceSample(res.ok);
    } catch (e) {
      setHasVoiceSample(false);
    }
  };

  const handleDeleteVoiceSample = async () => {
    try {
      const res = await fetch('/api/v1/ai/voice-sample', { method: 'DELETE' });
      if (res.ok) {
        setHasVoiceSample(false);
        setStudioVoiceMode('human');
        setUploadStatus('Deleted custom voice sample. Switched back to Human AI Voice.');
      }
    } catch (e) {
      setUploadStatus('Failed to delete sample audio file.');
    }
  };

  const handleUploadVoiceSample = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setUploadStatus('File is too large (max 15MB).');
      return;
    }

    setUploadStatus('Uploading & replacing voice sample...');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Audio = reader.result as string;
      try {
        const res = await fetch('/api/v1/ai/upload-voice-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Audio,
            fileName: 'sample_narrator.mp3',
          }),
        });

        if (res.ok) {
          setHasVoiceSample(true);
          setStudioVoiceMode('sample_narrator');
          setUploadStatus('Voice sample updated successfully! (Old voice replaced)');
        } else {
          setUploadStatus('Failed to save voice sample.');
        }
      } catch (err: any) {
        setUploadStatus('Error uploading file.');
      }
    };
    reader.readAsDataURL(file);
  };

  const fetchOrCreateScript = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/ai/webtoon-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mangaId: manga.id,
          chapterId: chapter.id,
          mangaTitle: manga.title,
          chapterName: chapter.name,
          pages: chapter.pages || [],
          forceRefresh,
          model: selectedAiModel,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate webtoon script.');
      }

      const data: WebtoonScript = await res.json();
      setScript(data);
      setEditedStoryText(data.overallStory);
    } catch (err: any) {
      console.error('Error fetching webtoon script:', err);
      setError(err.message || 'Error generating script.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveScriptEdits = async (updatedScript: WebtoonScript) => {
    setScript(updatedScript);
    try {
      await fetch(`/api/v1/ai/webtoon-script/${manga.id}/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: updatedScript }),
      });
    } catch (e) {
      console.warn('Failed to save script edits to server:', e);
    }
  };

  // Free Audio Synthesis / Playback Function with Speed Control
  const playPanelAudio = (panel: WebtoonPanel, index: number, speedMultiplier: number = playbackSpeed) => {
    stopAudio();
    setPlayingPanelIndex(index);

    const dialogue = panel.dialogueHindi;
    if (!dialogue) return;

    if (studioVoiceMode === 'sample_narrator') {
      const timestamp = Date.now();
      const url = `/api/v1/ai/tts?text=${encodeURIComponent(dialogue)}&voiceMode=sample_narrator&t=${timestamp}&speed=${speedMultiplier}`;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.playbackRate = speedMultiplier;
      audioRef.current = audio;
      audio.play().catch((err) => {
        console.warn('Sample narrator play error, falling back to speech:', err);
        playServerTTS(dialogue, index, speedMultiplier);
      });
      audio.onended = () => setPlayingPanelIndex(null);
      return;
    }

    // Method 1: Web Speech API (Built-in Free Browser TTS)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop prior
      const utterance = new SpeechSynthesisUtterance(dialogue);
      utterance.lang = 'hi-IN'; // Hindi voice
      utterance.rate = Math.min(2.0, Math.max(0.5, 0.95 * speedMultiplier)); // Natural speed adjusted by multiplier

      utterance.onend = () => {
        setPlayingPanelIndex(null);
      };

      utterance.onerror = () => {
        // Fallback to server TTS proxy
        playServerTTS(dialogue, index, speedMultiplier);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      playServerTTS(dialogue, index, speedMultiplier);
    }
  };

  const playServerTTS = (text: string, index: number, speedMultiplier: number = playbackSpeed) => {
    const url = `/api/v1/ai/tts?text=${encodeURIComponent(text)}&lang=hi&speed=${speedMultiplier}`;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.playbackRate = speedMultiplier;
    audioRef.current = audio;
    audio.play().catch(() => setPlayingPanelIndex(null));
    audio.onended = () => setPlayingPanelIndex(null);
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingPanelIndex(null);
  };

  const flatScenes = useMemo(() => getFlatScenes(script, disableCropping), [script, disableCropping]);

  const activeScenes = useMemo(() => {
    return flatScenes.filter((s) => !sceneExclusions[s.sceneId]);
  }, [flatScenes, sceneExclusions]);

  const handleToggleExcludeScene = (sceneId: string) => {
    setSceneExclusions((prev) => ({
      ...prev,
      [sceneId]: !prev[sceneId],
    }));
  };

  const handleDuplicateScene = (scene: WebtoonFlatScene) => {
    if (!script) return;
    const updatedPanels = [...script.panels];
    const pIdx = updatedPanels.findIndex((p) => p.panelIndex === scene.panelIndex);
    if (pIdx === -1) return;

    const panel = updatedPanels[pIdx];
    const existingIncidents = panel.incidents ? [...panel.incidents] : [];
    const newIncidentIndex = existingIncidents.length + 1;

    existingIncidents.push({
      incidentIndex: newIncidentIndex,
      incidentTitle: `${scene.sceneTitle} (Copy)`,
      cropRect: { ...scene.cropRect },
      speaker: scene.speaker,
      dialogueHindi: scene.dialogueHindi,
      sfx: scene.sfx,
      actionDescription: scene.actionDescription,
    });

    updatedPanels[pIdx] = { ...panel, incidents: existingIncidents };
    saveScriptEdits({ ...script, panels: updatedPanels });
  };

  const handleMoveSceneUp = (scene: WebtoonFlatScene) => {
    if (!script) return;
    const updatedPanels = [...script.panels];
    const pIdx = updatedPanels.findIndex((p) => p.panelIndex === scene.panelIndex);
    if (pIdx === -1) return;

    const panel = updatedPanels[pIdx];
    if (panel.incidents && panel.incidents.length > 1 && scene.incidentIndex && scene.incidentIndex > 1) {
      const incs = [...panel.incidents];
      const idx = scene.incidentIndex - 1;
      const temp = incs[idx];
      incs[idx] = incs[idx - 1];
      incs[idx - 1] = temp;
      updatedPanels[pIdx] = { ...panel, incidents: incs };
      saveScriptEdits({ ...script, panels: updatedPanels });
    } else if (pIdx > 0) {
      const temp = updatedPanels[pIdx];
      updatedPanels[pIdx] = updatedPanels[pIdx - 1];
      updatedPanels[pIdx - 1] = temp;
      saveScriptEdits({ ...script, panels: updatedPanels });
    }
  };

  const handleMoveSceneDown = (scene: WebtoonFlatScene) => {
    if (!script) return;
    const updatedPanels = [...script.panels];
    const pIdx = updatedPanels.findIndex((p) => p.panelIndex === scene.panelIndex);
    if (pIdx === -1) return;

    const panel = updatedPanels[pIdx];
    if (panel.incidents && panel.incidents.length > 1 && scene.incidentIndex && scene.incidentIndex < panel.incidents.length) {
      const incs = [...panel.incidents];
      const idx = scene.incidentIndex - 1;
      const temp = incs[idx];
      incs[idx] = incs[idx + 1];
      incs[idx + 1] = temp;
      updatedPanels[pIdx] = { ...panel, incidents: incs };
      saveScriptEdits({ ...script, panels: updatedPanels });
    } else if (pIdx < updatedPanels.length - 1) {
      const temp = updatedPanels[pIdx];
      updatedPanels[pIdx] = updatedPanels[pIdx + 1];
      updatedPanels[pIdx + 1] = temp;
      saveScriptEdits({ ...script, panels: updatedPanels });
    }
  };

  const handleDeleteScene = (sceneToDelete: WebtoonFlatScene) => {
    if (!script) return;
    const updatedPanels = [...script.panels];
    const pIdx = updatedPanels.findIndex((p) => p.panelIndex === sceneToDelete.panelIndex);
    if (pIdx === -1) return;

    const panel = updatedPanels[pIdx];
    if (panel.incidents && panel.incidents.length > 0 && sceneToDelete.incidentIndex) {
      const updatedIncidents = panel.incidents.filter(
        (_, i) => (i + 1) !== sceneToDelete.incidentIndex
      );
      if (updatedIncidents.length === 0) {
        updatedPanels.splice(pIdx, 1);
      } else {
        updatedPanels[pIdx] = { ...panel, incidents: updatedIncidents };
      }
    } else {
      updatedPanels.splice(pIdx, 1);
    }

    saveScriptEdits({ ...script, panels: updatedPanels });
  };

  const handleSplitPanel = (panelIndex: number, numSubScenes: number) => {
    if (!script) return;
    const updatedPanels = [...script.panels];
    const pIdx = updatedPanels.findIndex((p) => p.panelIndex === panelIndex);
    if (pIdx === -1) return;

    const panel = updatedPanels[pIdx];
    const sliceHeight = Math.floor(100 / numSubScenes);
    const newIncidents: WebtoonIncident[] = [];

    for (let i = 0; i < numSubScenes; i++) {
      const top = i * sliceHeight;
      const height = i === numSubScenes - 1 ? 100 - top : sliceHeight;
      newIncidents.push({
        incidentIndex: i + 1,
        incidentTitle: `पैनल ${panel.panelIndex} - दृश्य ${i + 1}`,
        cropRect: { topPct: top, heightPct: height },
        speaker: i === 0 ? (panel.speaker || 'सूत्रधार') : i === 1 ? 'मुख्य पात्र' : 'सह-पात्र',
        dialogueHindi: i === 0 ? (panel.dialogueHindi || `दृश्य ${i + 1} संवाद`) : `दृश्य ${i + 1} का दृश्य संवाद...`,
        sfx: panel.sfx || 'सरसराहट',
        actionDescription: `दृश्य ${i + 1} का एक्शन प्रभाव`,
      });
    }

    updatedPanels[pIdx] = { ...panel, incidents: newIncidents };
    setDisableCropping(false);
    saveScriptEdits({ ...script, panels: updatedPanels });
  };

  const handleAutoDivideAllStrips = (numSlices = 4) => {
    if (!script) return;
    const updatedPanels = script.panels.map((panel) => {
      const sliceHeight = Math.floor(100 / numSlices);
      const incidents: WebtoonIncident[] = [];
      for (let i = 0; i < numSlices; i++) {
        const top = i * sliceHeight;
        const height = i === numSlices - 1 ? 100 - top : sliceHeight;
        incidents.push({
          incidentIndex: i + 1,
          incidentTitle: `पैनल ${panel.panelIndex} - दृश्य ${i + 1}`,
          cropRect: { topPct: top, heightPct: height },
          speaker: i === 0 ? (panel.speaker || 'सूत्रधार') : 'पात्र',
          dialogueHindi: i === 0 ? (panel.dialogueHindi || `दृश्य ${i + 1} संवाद`) : `दृश्य ${i + 1} का संवाद...`,
          sfx: panel.sfx || 'सरसराहट',
          actionDescription: `दृश्य ${i + 1} की हलचल`,
        });
      }
      return { ...panel, incidents };
    });

    setDisableCropping(false);
    saveScriptEdits({ ...script, panels: updatedPanels });
  };

  const handleAddCustomCroppedScene = () => {
    if (!script || !cropModalPanel) return;
    const updatedPanels = [...script.panels];
    const pIdx = updatedPanels.findIndex((p) => p.panelIndex === cropModalPanel.panelIndex);
    if (pIdx === -1) return;

    const panel = updatedPanels[pIdx];
    const currentIncidents = panel.incidents ? [...panel.incidents] : [];

    const newIncident: WebtoonIncident = {
      incidentIndex: currentIncidents.length + 1,
      incidentTitle: `पैनल ${panel.panelIndex} - दृश्य ${currentIncidents.length + 1}`,
      cropRect: { topPct: customTopPct, heightPct: customHeightPct },
      speaker: customSpeaker || 'सूत्रधार',
      dialogueHindi: customDialogue || 'दृश्य संवाद',
      sfx: 'सरसराहट',
      actionDescription: 'वेबटून कैमरा ज़ूम',
    };

    currentIncidents.push(newIncident);
    const updatedPanel = { ...panel, incidents: currentIncidents };
    updatedPanels[pIdx] = updatedPanel;

    setCropModalPanel(updatedPanel);
    setDisableCropping(false);
    saveScriptEdits({ ...script, panels: updatedPanels });
  };

  const handleDeleteIncidentFromModal = (incidentIdx: number) => {
    if (!script || !cropModalPanel) return;
    const updatedPanels = [...script.panels];
    const pIdx = updatedPanels.findIndex((p) => p.panelIndex === cropModalPanel.panelIndex);
    if (pIdx === -1) return;

    const panel = updatedPanels[pIdx];
    if (!panel.incidents) return;

    const filteredIncidents = panel.incidents
      .filter((inc) => inc.incidentIndex !== incidentIdx)
      .map((inc, newI) => ({ ...inc, incidentIndex: newI + 1 }));

    const updatedPanel = { ...panel, incidents: filteredIncidents };
    updatedPanels[pIdx] = updatedPanel;

    setCropModalPanel(updatedPanel);
    saveScriptEdits({ ...script, panels: updatedPanels });
  };

  const handleBatchGenerateModalScenes = (numSlices: number) => {
    if (!script || !cropModalPanel) return;
    const updatedPanels = [...script.panels];
    const pIdx = updatedPanels.findIndex((p) => p.panelIndex === cropModalPanel.panelIndex);
    if (pIdx === -1) return;

    const panel = updatedPanels[pIdx];
    const sliceHeight = Math.floor(100 / numSlices);
    const incidents: WebtoonIncident[] = [];

    for (let i = 0; i < numSlices; i++) {
      const top = i * sliceHeight;
      const height = i === numSlices - 1 ? 100 - top : sliceHeight;
      incidents.push({
        incidentIndex: i + 1,
        incidentTitle: `पैनल ${panel.panelIndex} - दृश्य ${i + 1}`,
        cropRect: { topPct: top, heightPct: height },
        speaker: i === 0 ? (panel.speaker || 'सूत्रधार') : 'मुख्य पात्र',
        dialogueHindi: i === 0 ? (panel.dialogueHindi || `दृश्य ${i + 1} संवाद`) : `दृश्य ${i + 1} का दृश्य संवाद...`,
        sfx: panel.sfx || 'सरसराहट',
        actionDescription: `दृश्य ${i + 1} का एक्शन प्रभाव`,
      });
    }

    const updatedPanel = { ...panel, incidents };
    updatedPanels[pIdx] = updatedPanel;

    setCropModalPanel(updatedPanel);
    setDisableCropping(false);
    saveScriptEdits({ ...script, panels: updatedPanels });
  };

  // Video Reel Player Auto-Scroll & Voiceover Sync (Scene by Scene)
  const toggleVideoPlayer = () => {
    if (isPlayingVideo) {
      pauseVideoPlayer();
    } else {
      startVideoPlayer();
    }
  };

  const startVideoPlayer = () => {
    if (activeScenes.length === 0) return;
    setIsPlayingVideo(true);

    if (currentVideoPanelIdx >= activeScenes.length) {
      setCurrentVideoPanelIdx(0);
    }

    playCurrentVideoPanel(currentVideoPanelIdx);
  };

  const playCurrentVideoPanel = (idx: number) => {
    if (idx >= activeScenes.length) {
      setIsPlayingVideo(false);
      setPlayingPanelIndex(null);
      return;
    }

    setCurrentVideoPanelIdx(idx);
    const scene = activeScenes[idx];
    const dialogueText = subtitleLanguage === 'English' && scene.dialogueEnglish ? scene.dialogueEnglish : scene.dialogueHindi;

    // Check for user-recorded voice for this specific scene
    const recordedVoice = sceneVoiceAudios[scene.sceneId]?.audioUrl || scene.userAudioUrl;

    if (recordedVoice) {
      stopAudio();
      setPlayingPanelIndex(idx);
      const audio = new Audio(recordedVoice);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;
      audio.play().catch((err) => console.warn('Recorded voice playback error:', err));
      audio.onended = () => setPlayingPanelIndex(null);
    } else {
      // Fallback to spoken narration with speed control
      playPanelAudio({ dialogueHindi: dialogueText } as any, idx, playbackSpeed);
    }

    // Schedule next scene based on custom recorded voice duration or subtitle-based estimated duration & speed
    const autoSec = calculateDurationFromSubtitle(dialogueText, 1.0);
    const customSec = sceneVoiceAudios[scene.sceneId]?.duration || sceneDurations[scene.sceneId] || scene.estimatedDurationSec || autoSec || 4;
    const durationMs = Math.max(800, (customSec * 1000) / playbackSpeed);
    if (videoTimerRef.current) clearTimeout(videoTimerRef.current);

    videoTimerRef.current = setTimeout(() => {
      if (idx + 1 < activeScenes.length) {
        playCurrentVideoPanel(idx + 1);
      } else {
        setIsPlayingVideo(false);
        setPlayingPanelIndex(null);
      }
    }, durationMs);
  };

  const pauseVideoPlayer = () => {
    setIsPlayingVideo(false);
    stopAudio();
    if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
  };

  // Synchronize all scene durations dynamically according to subtitle dialogue length & chosen speed
  const handleSyncAllDurationsToSubtitles = () => {
    const newDurations: Record<string, number> = {};
    flatScenes.forEach((scene) => {
      const dialogue = subtitleLanguage === 'English' && scene.dialogueEnglish ? scene.dialogueEnglish : scene.dialogueHindi;
      newDurations[scene.sceneId] = calculateDurationFromSubtitle(dialogue, playbackSpeed);
    });
    setSceneDurations((prev) => ({ ...prev, ...newDurations }));
    triggerToast(`Durations calculated & synced for ${flatScenes.length} scenes at ${playbackSpeed}x speed!`);
  };

  const exportScriptJson = () => {
    if (!script) return;
    const blob = new Blob([JSON.stringify(script, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manga.title.replace(/[^a-z0-9]/gi, '_')}_ch${chapter.chapterNumber}_webtoon_script.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={
        isPageMode
          ? 'w-full space-y-4 animate-fadeIn'
          : 'fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto'
      }
    >
      {/* Page Mode Top Navigation Bar */}
      {isPageMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-900/90 rounded-2xl border border-zinc-800/80 shadow-md">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              id="btn-ai-generator-back-library"
              onClick={onNavigateToLibrary || onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Return to Manga Library"
            >
              <ArrowLeft className="w-4 h-4 text-rose-400" />
              <span>Back to Library</span>
            </button>

            {onChangeManga && (
              <button
                id="btn-ai-generator-change-manga"
                onClick={onChangeManga}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <span>Change Manga / Chapter</span>
              </button>
            )}

            <div className="h-4 w-px bg-zinc-700 hidden sm:block" />

            <div className="text-xs text-zinc-400 font-medium truncate">
              <span className="text-zinc-200 font-semibold">{manga.title}</span>
              <span className="mx-1.5 text-zinc-600">•</span>
              <span className="text-rose-400 font-medium">{chapter.name}</span>
            </div>
          </div>

          {allChapters.length > 1 && onSelectChapter && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">Chapter:</label>
              <select
                value={chapter.id}
                onChange={(e) => {
                  const chId = parseInt(e.target.value, 10);
                  const found = allChapters.find((c) => c.id === chId);
                  if (found) onSelectChapter(found);
                }}
                className="bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-rose-500"
              >
                {allChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div
        className={`bg-zinc-950 border border-zinc-800 rounded-2xl w-full ${
          isPageMode ? 'min-h-[85vh]' : 'max-w-5xl max-h-[92vh]'
        } flex flex-col shadow-2xl overflow-hidden`}
      >
        
        {/* Modal / Studio Top Bar */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="btn-studio-back-primary"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 transition-colors cursor-pointer shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 text-rose-400" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-lg">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  AI Webtoon Video Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Hindi (हिंदी)
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate">
                {manga.title} • {chapter.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* AI Model Selector */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-amber-500/40 rounded-xl px-2.5 py-1 text-xs shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold text-zinc-300 hidden md:inline">Model:</span>
              <select
                id="select-studio-ai-model"
                value={selectedAiModel}
                onChange={(e) => {
                  setSelectedAiModel(e.target.value);
                }}
                className="bg-zinc-950 text-amber-300 text-xs font-semibold rounded px-1.5 py-0.5 border border-amber-500/30 focus:outline-none cursor-pointer"
                title="Select AI Model for Subtitle & Dialogue Generation"
              >
                <option value="gemini-3.1-pro-preview">⭐ Gemini 3.1 Pro (Best AI Model)</option>
                <option value="gemini-3.8-flash">⚡ Gemini 3.8 Flash (High Speed)</option>
              </select>
            </div>

            <button
              onClick={() => setShowVoiceManagerModal(true)}
              className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Manage Voice Samples"
            >
              <Mic className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Voice Manager</span>
              {hasVoiceSample && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </button>
            <button
              id="btn-studio-regenerate-script"
              onClick={() => fetchOrCreateScript(true)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Re-generate AI Script with selected best model"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Regenerate with Best AI</span>
            </button>
            <button
              onClick={exportScriptJson}
              disabled={!script}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export Script JSON"
            >
              <Download className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>
            <button
              id="btn-studio-back-secondary"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Nav Tabs */}
        <div className="flex items-center border-b border-zinc-800/80 bg-zinc-900/40 px-4 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('story')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'story'
                ? 'border-rose-500 text-white bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>📖 Story & Characters</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'editor'
                ? 'border-rose-500 text-white bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Video className="w-4 h-4 text-amber-400" />
            <span>🎬 Panel-by-Panel Video Timeline</span>
            {script && (
              <span className="ml-1 px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300">
                {script.panels.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('player')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'player'
                ? 'border-rose-500 text-white bg-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Film className="w-4 h-4 text-rose-500" />
            <span>📽 Webtoon Reel Video Player</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-zinc-950">
          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-zinc-300 font-medium">
                Gemini AI is analyzing webtoon panels and generating Hindi dialogues...
              </p>
              <p className="text-xs text-zinc-500">
                Creating overall storyline, character roster (mangaId: {manga.id}, chapterId: {chapter.id}), and audio cues.
              </p>
            </div>
          ) : error ? (
            <div className="p-6 text-center bg-rose-950/20 border border-rose-900/50 rounded-xl text-rose-300 space-y-3">
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={() => fetchOrCreateScript(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Retry Script Generation
              </button>
            </div>
          ) : script ? (
            <>
              {/* TAB 1: STORY & CHARACTERS */}
              {activeTab === 'story' && (
                <div className="space-y-6">
                  {/* Searched Manga Details & Google Grounding Context Card */}
                  {script.mangaDetailsSummary && (
                    <div className="bg-gradient-to-r from-rose-950/30 via-zinc-900 to-amber-950/20 border border-rose-500/30 rounded-2xl p-5 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📖</span>
                          <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                              <span>Manga Lore & Searched Context</span>
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                                Google Search Grounded
                              </span>
                              {script.modelUsed && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                  <span>
                                    {script.modelUsed.includes('pro')
                                      ? 'AI Model: Gemini 3.1 Pro (Flagship Quality)'
                                      : `AI Model: ${script.modelUsed}`}
                                  </span>
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-zinc-400">
                              Fetched before subtitle generation to ensure human-readable dialogue & accurate character names
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => fetchOrCreateScript(true)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          title="Re-run search grounding & refresh subtitles"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                          <span>Re-Search & Update</span>
                        </button>
                      </div>

                      <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-line max-h-60 overflow-y-auto">
                        {script.mangaDetailsSummary}
                      </div>
                    </div>
                  )}

                  {/* Overall Chapter Story Card */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        <h3 className="text-base font-bold text-white">
                          अध्याय कहानी सार (Overall Chapter Story)
                        </h3>
                      </div>
                      <button
                        onClick={() => {
                          if (isEditingStory) {
                            saveScriptEdits({ ...script, overallStory: editedStoryText });
                          }
                          setIsEditingStory(!isEditingStory);
                        }}
                        className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {isEditingStory ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Save
                          </>
                        ) : (
                          <>
                            <Edit3 className="w-3.5 h-3.5 text-rose-400" /> Edit Story
                          </>
                        )}
                      </button>
                    </div>

                    {isEditingStory ? (
                      <textarea
                        value={editedStoryText}
                        onChange={(e) => setEditedStoryText(e.target.value)}
                        className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-rose-500"
                      />
                    ) : (
                      <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/60">
                        {script.overallStory}
                      </p>
                    )}
                  </div>

                  {/* Character Array Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-rose-400" />
                        <h3 className="text-base font-bold text-white">
                          पात्र सूची (Character Roster Array)
                        </h3>
                      </div>
                      <span className="text-xs text-zinc-500">
                        Stored for mangaId: {manga.id} • chapterId: {chapter.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {script.characters.map((char) => (
                        <div
                          key={char.id}
                          className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2 hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-white">{char.name}</h4>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                {char.role}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              ID: {char.id}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-400">{char.description}</p>

                          {char.keyLines && char.keyLines.length > 0 && (
                            <div className="space-y-1 pt-2 border-t border-zinc-800/80">
                              <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> मुख्य संवाद (Key Lines):
                              </span>
                              <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1">
                                {char.keyLines.map((line, lIdx) => (
                                  <li key={lIdx} className="italic">
                                    "{line}"
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SCENE-BY-SCENE VIDEO TIMELINE EDITOR */}
              {activeTab === 'editor' && (
                <div className="space-y-4">
                  {/* Timeline Control Header Bar */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-zinc-400 font-bold flex items-center gap-1.5 mr-1">
                        <Filter className="w-4 h-4 text-rose-400" /> Filter Timeline:
                      </span>
                      <button
                        onClick={() => setTimelineFilter('all')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          timelineFilter === 'all'
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        All Scenes ({flatScenes.length})
                      </button>
                      <button
                        onClick={() => setTimelineFilter('included')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          timelineFilter === 'included'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Included ({activeScenes.length})
                      </button>
                      <button
                        onClick={() => setTimelineFilter('excluded')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          timelineFilter === 'excluded'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Excluded ({flatScenes.length - activeScenes.length})
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Auto Split Toolbar Actions */}
                      <button
                        onClick={() => handleAutoDivideAllStrips(4)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Auto-slice all vertical strips into 4 sub-scenes each"
                      >
                        <Scissors className="w-3.5 h-3.5 text-amber-400" />
                        <span>Divide All (4 Sub-Scenes)</span>
                      </button>

                      <button
                        onClick={() => handleAutoDivideAllStrips(5)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Auto-slice all vertical strips into 5 sub-scenes each"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                        <span>Divide (5 Sub-Scenes)</span>
                      </button>

                      {/* Do Not Crop Toggle */}
                      <button
                        onClick={() => setDisableCropping(!disableCropping)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          disableCropping
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                        title="Toggle full uncropped image display"
                      >
                        <Crop className="w-3.5 h-3.5 text-amber-400" />
                        <span>{disableCropping ? 'Full Image View' : 'Crop Enabled'}</span>
                      </button>

                      {/* Speed Multiplier */}
                      <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800 text-xs shadow-inner" title="Speech & Scene duration speed multiplier">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-zinc-500 font-bold">Speed:</span>
                        <select
                          value={playbackSpeed}
                          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                          className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
                        >
                          <option value={0.5} className="bg-zinc-900 text-white">0.5x</option>
                          <option value={0.75} className="bg-zinc-900 text-white">0.75x</option>
                          <option value={1.0} className="bg-zinc-900 text-white">1.0x</option>
                          <option value={1.25} className="bg-zinc-900 text-white">1.25x</option>
                          <option value={1.5} className="bg-zinc-900 text-white">1.5x</option>
                          <option value={1.75} className="bg-zinc-900 text-white">1.75x</option>
                          <option value={2.0} className="bg-zinc-900 text-white">2.0x</option>
                        </select>
                      </div>

                      {/* Auto-Sync All Durations to Subtitles */}
                      <button
                        onClick={handleSyncAllDurationsToSubtitles}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                        title={`Automatically calculate and set each scene's duration based on subtitle length at ${playbackSpeed}x speed`}
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sync Durations to Subtitles ({playbackSpeed}x)</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {flatScenes
                      .filter((s) => {
                        if (timelineFilter === 'included') return !sceneExclusions[s.sceneId];
                        if (timelineFilter === 'excluded') return !!sceneExclusions[s.sceneId];
                        return true;
                      })
                      .map((scene, idx) => {
                      const isAudioPlaying = playingPanelIndex === idx;
                      const crop = scene.cropRect || { topPct: 0, heightPct: 25 };
                      const isExcluded = !!sceneExclusions[scene.sceneId];
                      const currentDuration = sceneDurations[scene.sceneId] || scene.estimatedDurationSec || 4;

                      return (
                        <div
                          key={scene.sceneId || idx}
                          className={`p-4 rounded-2xl border transition-all ${
                            isExcluded
                              ? 'bg-zinc-950/80 border-zinc-800/60 opacity-60'
                              : isAudioPlaying
                              ? 'bg-rose-950/20 border-rose-500/80 shadow-lg shadow-rose-950/50'
                              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row gap-4">
                            {/* Scene Image Cropped Webtoon Frame Preview */}
                            <div className="w-full md:w-44 h-48 bg-zinc-950 rounded-xl overflow-hidden border border-amber-500/30 relative shrink-0 flex items-center justify-center">
                              {crop.heightPct === 100 || disableCropping ? (
                                <img
                                  src={scene.pageUrl}
                                  alt={`Scene ${scene.globalIndex}`}
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div
                                  className="w-full relative overflow-hidden"
                                  style={{
                                    height: `${(100 / (crop.heightPct || 25)) * 100}%`,
                                    marginTop: `-${(crop.topPct / (crop.heightPct || 25)) * 100}%`,
                                  }}
                                >
                                  <img
                                    src={scene.pageUrl}
                                    alt={`Scene ${scene.globalIndex}`}
                                    className="w-full h-full object-cover transition-transform duration-500"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-bold text-amber-300 border border-amber-500/30">
                                Scene #{scene.globalIndex} (Page {scene.panelIndex})
                              </div>
                              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-rose-600/90 text-[10px] font-bold text-white">
                                {currentDuration}s
                              </div>
                            </div>

                            {/* Scene Video Controls & Hindi Script */}
                            <div className="flex-1 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                                    {scene.sceneTitle}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-xs font-bold">
                                    🗣 {scene.speaker || 'सूत्रधार'}
                                  </span>
                                  {(sceneVoiceAudios[scene.sceneId] || scene.userAudioUrl) && (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                                      <Mic className="w-3 h-3 text-emerald-400" /> Voice Timed ({currentDuration}s)
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  {/* Take / Exclude Button */}
                                  <button
                                    onClick={() => handleToggleExcludeScene(scene.sceneId)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                                      isExcluded
                                        ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                    }`}
                                    title={isExcluded ? 'Include in video' : 'Exclude from video'}
                                  >
                                    {isExcluded ? (
                                      <>
                                        <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                                        <span>Excluded</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Take Scene</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Scene Voiceover Recorder Button */}
                                  {recordingSceneId === scene.sceneId ? (
                                    <button
                                      onClick={stopSceneVoiceRecording}
                                      className="px-2.5 py-1 rounded-lg bg-rose-600 animate-pulse text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-lg"
                                      title="Stop Voice Recording"
                                    >
                                      <Square className="w-3.5 h-3.5 fill-current" />
                                      <span>Stop ({sceneRecordSeconds}s)</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => startSceneVoiceRecording(scene.sceneId)}
                                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                      title="Record your own voice for this scene"
                                    >
                                      <Mic className="w-3.5 h-3.5 text-rose-400" />
                                      <span>{sceneVoiceAudios[scene.sceneId] ? 'Re-Record Voice' : 'Record Voice'}</span>
                                    </button>
                                  )}

                                  {/* Play Recorded Voice Button */}
                                  {(sceneVoiceAudios[scene.sceneId]?.audioUrl || scene.userAudioUrl) && (
                                    <button
                                      onClick={() => {
                                        stopAudio();
                                        const audio = new Audio(sceneVoiceAudios[scene.sceneId]?.audioUrl || scene.userAudioUrl);
                                        audio.play();
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                      title="Listen to recorded voice narration"
                                    >
                                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Play Voice</span>
                                    </button>
                                  )}

                                  {/* Reorder Scene Up / Down */}
                                  <div className="flex items-center gap-0.5 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                                    <button
                                      onClick={() => handleMoveSceneUp(scene)}
                                      className="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
                                      title="Move Scene Up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveSceneDown(scene)}
                                      className="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
                                      title="Move Scene Down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Duplicate Scene Button */}
                                  <button
                                    onClick={() => handleDuplicateScene(scene)}
                                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                    title="Duplicate Scene"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="hidden sm:inline">Duplicate</span>
                                  </button>

                                  {/* Duration Picker with Subtitle Auto Recommendation */}
                                  {(() => {
                                    const sceneDialogue = subtitleLanguage === 'English' && scene.dialogueEnglish ? scene.dialogueEnglish : scene.dialogueHindi;
                                    const recommendedSec = calculateDurationFromSubtitle(sceneDialogue, playbackSpeed);

                                    return (
                                      <div className="flex items-center gap-1">
                                        <select
                                          value={currentDuration}
                                          onChange={(e) => {
                                            const sec = Number(e.target.value);
                                            setSceneDurations((prev) => ({ ...prev, [scene.sceneId]: sec }));
                                          }}
                                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-amber-300 font-bold focus:outline-none cursor-pointer"
                                          title="Change Scene Duration"
                                        >
                                          <option value={recommendedSec}>
                                            ✨ Subtitle Auto ({recommendedSec}s)
                                          </option>
                                          <option value={2}>⏱ 2 sec</option>
                                          <option value={3}>⏱ 3 sec</option>
                                          <option value={4}>⏱ 4 sec</option>
                                          <option value={5}>⏱ 5 sec</option>
                                          <option value={6}>⏱ 6 sec</option>
                                          <option value={8}>⏱ 8 sec</option>
                                          <option value={10}>⏱ 10 sec</option>
                                          <option value={12}>⏱ 12 sec</option>
                                          <option value={15}>⏱ 15 sec</option>
                                          <option value={18}>⏱ 18 sec</option>
                                          <option value={20}>⏱ 20 sec</option>
                                          {!([recommendedSec, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20].includes(currentDuration)) && (
                                            <option value={currentDuration}>⏱ Custom ({currentDuration}s)</option>
                                          )}
                                        </select>
                                        <button
                                          onClick={() => {
                                            setSceneDurations((prev) => ({ ...prev, [scene.sceneId]: recommendedSec }));
                                            triggerToast(`Scene duration set to ${recommendedSec}s based on subtitle length`);
                                          }}
                                          className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                                          title={`Sync to subtitle length (${recommendedSec}s)`}
                                        >
                                          <Zap className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })()}

                                  {/* Interactive Custom Crop Button */}
                                  <button
                                    onClick={() => {
                                      if (script && script.panels && script.panels.length > 0) {
                                        const targetPanel = script.panels.find((p) => p.panelIndex === scene.panelIndex) || script.panels[scene.panelIndex - 1] || script.panels[0];
                                        if (targetPanel) {
                                          setCropModalPanel(targetPanel);
                                          setCustomTopPct(scene.cropRect?.topPct ?? 0);
                                          setCustomHeightPct(scene.cropRect?.heightPct ?? 25);
                                          setCustomDialogue(scene.dialogueHindi || targetPanel.dialogueHindi || 'दृश्य का संवाद...');
                                          setCustomSpeaker(scene.speaker || targetPanel.speaker || 'सूत्रधार');
                                        }
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                    title="Interactive Crop Box & Scene Generator"
                                  >
                                    <Scissors className="w-3.5 h-3.5 text-amber-400" />
                                    <span>🎨 Cropper</span>
                                  </button>

                                  {/* Free Audio Play Button */}
                                  <button
                                    onClick={() => {
                                      if (isAudioPlaying) {
                                        stopAudio();
                                      } else {
                                        playPanelAudio({ dialogueHindi: scene.dialogueHindi } as any, idx);
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                      isAudioPlaying
                                        ? 'bg-rose-600 text-white animate-pulse'
                                        : 'bg-zinc-800 hover:bg-rose-600 text-zinc-200 hover:text-white border border-zinc-700'
                                    }`}
                                  >
                                    {isAudioPlaying ? (
                                      <>
                                        <VolumeX className="w-3.5 h-3.5" /> Stop
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-3.5 h-3.5 text-rose-400" /> Voice
                                      </>
                                    )}
                                  </button>

                                  {/* Regenerate Scene Subtitle with Best AI */}
                                  <button
                                    onClick={() => handleRegenerateSingleSceneSubtitle(scene)}
                                    disabled={regeneratingSceneId === scene.sceneId}
                                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                    title="Regenerate this scene's subtitle and dialogue using Best AI Model"
                                  >
                                    <Sparkles className={`w-3.5 h-3.5 text-rose-400 ${regeneratingSceneId === scene.sceneId ? 'animate-spin' : ''}`} />
                                    <span>{regeneratingSceneId === scene.sceneId ? 'Generating...' : 'Best AI Subtitle'}</span>
                                  </button>

                                  {/* Delete Scene Button */}
                                  <button
                                    onClick={() => handleDeleteScene(scene)}
                                    className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 transition-all cursor-pointer"
                                    title="Delete this scene"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Dialogue Text Areas: English Subtitles & Hindi Script */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                                    <span>🇬🇧 English Subtitles (Extracted Dialogue):</span>
                                  </label>
                                  <textarea
                                    value={scene.dialogueEnglish || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedPanels = [...script.panels];
                                      const pIdx = scene.panelIndex - 1;
                                      const panel = updatedPanels[pIdx];
                                      if (panel) {
                                        if (panel.incidents && scene.incidentIndex) {
                                          const incs = [...panel.incidents];
                                          incs[scene.incidentIndex - 1] = { ...incs[scene.incidentIndex - 1], dialogueEnglish: val };
                                          updatedPanels[pIdx] = { ...panel, incidents: incs };
                                        } else {
                                          updatedPanels[pIdx] = { ...panel, dialogueEnglish: val };
                                        }
                                        saveScriptEdits({ ...script, panels: updatedPanels });
                                      }
                                    }}
                                    placeholder="English dialogue subtitles extracted..."
                                    className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500 font-sans"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                                    <span>🇮🇳 हिंदी दृश्य संवाद (Hindi Script):</span>
                                  </label>
                                  <textarea
                                    value={scene.dialogueHindi}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedPanels = [...script.panels];
                                      const pIdx = scene.panelIndex - 1;
                                      const panel = updatedPanels[pIdx];
                                      if (panel) {
                                        if (panel.incidents && scene.incidentIndex) {
                                          const incs = [...panel.incidents];
                                          incs[scene.incidentIndex - 1] = { ...incs[scene.incidentIndex - 1], dialogueHindi: val };
                                          updatedPanels[pIdx] = { ...panel, incidents: incs };
                                        } else {
                                          updatedPanels[pIdx] = { ...panel, dialogueHindi: val };
                                        }
                                        saveScriptEdits({ ...script, panels: updatedPanels });
                                      }
                                    }}
                                    className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500 font-sans"
                                  />
                                </div>
                              </div>

                              {/* Narrator POV Breakdown: What character does vs what character says */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/20">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                                    <span>⚡ क्या करता है (What Character Does - Action):</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={scene.characterAction || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedPanels = [...script.panels];
                                      const pIdx = scene.panelIndex - 1;
                                      const panel = updatedPanels[pIdx];
                                      if (panel) {
                                        if (panel.incidents && scene.incidentIndex) {
                                          const incs = [...panel.incidents];
                                          incs[scene.incidentIndex - 1] = { ...incs[scene.incidentIndex - 1], characterAction: val };
                                          updatedPanels[pIdx] = { ...panel, incidents: incs };
                                        } else {
                                          updatedPanels[pIdx] = { ...panel, characterAction: val };
                                        }
                                        saveScriptEdits({ ...script, panels: updatedPanels });
                                      }
                                    }}
                                    placeholder="उदा: गुस्से में तलवार खींचता है या पीछे मुड़कर देखता है..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
                                    <span>💬 क्या कहता है (What Character Says - Dialogue):</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={scene.characterSays || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedPanels = [...script.panels];
                                      const pIdx = scene.panelIndex - 1;
                                      const panel = updatedPanels[pIdx];
                                      if (panel) {
                                        if (panel.incidents && scene.incidentIndex) {
                                          const incs = [...panel.incidents];
                                          incs[scene.incidentIndex - 1] = { ...incs[scene.incidentIndex - 1], characterSays: val };
                                          updatedPanels[pIdx] = { ...panel, incidents: incs };
                                        } else {
                                          updatedPanels[pIdx] = { ...panel, characterSays: val };
                                        }
                                        saveScriptEdits({ ...script, panels: updatedPanels });
                                      }
                                    }}
                                    placeholder='उदा: "अब तुम्हारा अंत निश्चित है!"...'
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-400"
                                  />
                                </div>
                              </div>

                              {/* Multi-Scene Crop & Controls */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80 flex items-center justify-between">
                                  <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                                    <Crop className="w-3 h-3" /> Scene Frame:
                                  </span>
                                  <select
                                    value={`${crop.topPct}-${crop.heightPct}`}
                                    onChange={(e) => {
                                      const [top, height] = e.target.value.split('-').map(Number);
                                      const updatedPanels = [...script.panels];
                                      const pIdx = scene.panelIndex - 1;
                                      const panel = updatedPanels[pIdx];
                                      if (panel) {
                                        if (panel.incidents && scene.incidentIndex) {
                                          const incs = [...panel.incidents];
                                          incs[scene.incidentIndex - 1] = { ...incs[scene.incidentIndex - 1], cropRect: { topPct: top, heightPct: height } };
                                          updatedPanels[pIdx] = { ...panel, incidents: incs };
                                        } else {
                                          updatedPanels[pIdx] = { ...panel, cropRect: { topPct: top, heightPct: height } };
                                        }
                                        saveScriptEdits({ ...script, panels: updatedPanels });
                                      }
                                    }}
                                    className="bg-zinc-900 border border-amber-500/30 rounded px-1.5 py-0.5 text-xs text-amber-200 focus:outline-none cursor-pointer"
                                  >
                                    <option value="0-20">Scene 1 (Top 0-20%)</option>
                                    <option value="20-20">Scene 2 (20-40%)</option>
                                    <option value="40-20">Scene 3 (40-60%)</option>
                                    <option value="60-20">Scene 4 (60-80%)</option>
                                    <option value="80-20">Scene 5 (Bottom 80-100%)</option>
                                    <option value="0-25">Top Quarter (0-25%)</option>
                                    <option value="25-25">2nd Quarter (25-50%)</option>
                                    <option value="50-25">3rd Quarter (50-75%)</option>
                                    <option value="75-25">Bottom Quarter (75-100%)</option>
                                    <option value="0-33">Top Third (0-33%)</option>
                                    <option value="33-33">Mid Third (33-66%)</option>
                                    <option value="66-34">Bottom Third (66-100%)</option>
                                    <option value="0-50">Top Half (0-50%)</option>
                                    <option value="50-50">Bottom Half (50-100%)</option>
                                    <option value="0-100">Full Image (0-100%)</option>
                                  </select>
                                </div>

                                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                                  <span className="text-[10px] text-zinc-500 block">🎵 BGM:</span>
                                  <span className="text-zinc-300 truncate block font-medium">
                                    {scene.bgmSuggestion}
                                  </span>
                                </div>

                                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80 flex items-center justify-between">
                                  <span className="text-[10px] text-zinc-500">⏱ Duration:</span>
                                  <span className="text-xs font-bold text-zinc-200">{scene.estimatedDurationSec}s</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: WEBTOON REEL VIDEO PLAYER */}
              {activeTab === 'player' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Film className="w-4 h-4 text-rose-500" />
                        Interactive Vertical Webtoon Reel Player ({activeScenes.length} Scenes)
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Auto-scrolls scene-by-scene through sliced webtoon frames with camera motion and spoken voiceover.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Subtitle Language Switcher */}
                      <div className="flex items-center gap-1 bg-zinc-950 px-2.5 py-1 rounded-xl border border-rose-500/40 text-xs">
                        <span className="text-rose-400 font-bold">Lang:</span>
                        <select
                          value={subtitleLanguage}
                          onChange={(e) => setSubtitleLanguage(e.target.value as any)}
                          className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="English" className="bg-zinc-900 text-white">🇬🇧 English Subtitles</option>
                          <option value="Hindi" className="bg-zinc-900 text-white">🇮🇳 Hindi Script</option>
                        </select>
                      </div>

                      {/* Subtitle Customizers */}
                      <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-xl border border-zinc-800 text-xs">
                        <span className="text-zinc-500 font-bold">Pos:</span>
                        <select
                          value={subtitlePos}
                          onChange={(e) => setSubtitlePos(e.target.value as any)}
                          className="bg-transparent text-amber-300 font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="bottom" className="bg-zinc-900 text-white">Bottom</option>
                          <option value="center" className="bg-zinc-900 text-white">Center</option>
                          <option value="top" className="bg-zinc-900 text-white">Top</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-xl border border-zinc-800 text-xs">
                        <span className="text-zinc-500 font-bold">Size:</span>
                        <select
                          value={subtitleSize}
                          onChange={(e) => setSubtitleSize(e.target.value as any)}
                          className="bg-transparent text-amber-300 font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="small" className="bg-zinc-900 text-white">Small</option>
                          <option value="medium" className="bg-zinc-900 text-white">Medium</option>
                          <option value="large" className="bg-zinc-900 text-white">Large</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-xl border border-zinc-800 text-xs">
                        <span className="text-zinc-500 font-bold">Color:</span>
                        <select
                          value={subtitleColor}
                          onChange={(e) => setSubtitleColor(e.target.value as any)}
                          className="bg-transparent text-amber-300 font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="yellow" className="bg-zinc-900 text-amber-300">Yellow</option>
                          <option value="white" className="bg-zinc-900 text-white">White</option>
                          <option value="cyan" className="bg-zinc-900 text-cyan-300">Cyan</option>
                        </select>
                      </div>

                      {/* Speed Multiplier */}
                      <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800 text-xs shadow-inner" title="Playback & Narration Speed Multiplier">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-zinc-500 font-bold">Speed:</span>
                        <select
                          value={playbackSpeed}
                          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                          className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
                        >
                          <option value={0.5} className="bg-zinc-900 text-white">0.5x</option>
                          <option value={0.75} className="bg-zinc-900 text-white">0.75x</option>
                          <option value={1.0} className="bg-zinc-900 text-white">1.0x</option>
                          <option value={1.25} className="bg-zinc-900 text-white">1.25x</option>
                          <option value={1.5} className="bg-zinc-900 text-white">1.5x</option>
                          <option value={1.75} className="bg-zinc-900 text-white">1.75x</option>
                          <option value={2.0} className="bg-zinc-900 text-white">2.0x</option>
                        </select>
                      </div>

                      {/* Hide Dialogues Under Image Toggle */}
                      <button
                        onClick={() => setHideSubtitlesVideo(!hideSubtitlesVideo)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          hideSubtitlesVideo
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                        title="Toggle Clean Image Mode"
                      >
                        {hideSubtitlesVideo ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                            <span>Dialogues Hidden</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Dialogues Overlay</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={toggleVideoPlayer}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                          isPlayingVideo
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white'
                        }`}
                      >
                        {isPlayingVideo ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" /> Play Reel
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          pauseVideoPlayer();
                          setCurrentVideoPanelIdx(0);
                        }}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                        title="Reset Reel"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Video Stage Canvas */}
                  {activeScenes.length > 0 ? (
                    <div className="relative w-full max-w-md mx-auto aspect-[9/16] max-h-[580px] bg-black rounded-3xl overflow-hidden border-2 border-zinc-800 shadow-2xl flex flex-col justify-between">
                      {/* Active Scene Webtoon Image Cropped Lens */}
                      {(() => {
                        const currentScene = activeScenes[currentVideoPanelIdx] || activeScenes[0];
                        const crop = currentScene?.cropRect || { topPct: 0, heightPct: 100 };
                        const isFull = crop.heightPct === 100 || disableCropping;

                        return (
                          <div className="absolute inset-0 overflow-hidden flex items-center justify-center bg-black">
                            {isFull ? (
                              <img
                                src={currentScene?.pageUrl}
                                alt="Webtoon Video Scene"
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div
                                className="w-full relative"
                                style={{
                                  height: `${(100 / (crop.heightPct || 33)) * 100}%`,
                                  marginTop: `-${(crop.topPct / (crop.heightPct || 33)) * 100}%`,
                                }}
                              >
                                <img
                                  src={currentScene?.pageUrl}
                                  alt="Webtoon Video Scene"
                                  className={`w-full h-full object-cover transition-transform duration-[4000ms] ease-out ${
                                    isPlayingVideo ? 'scale-110 translate-y-2' : 'scale-100'
                                  }`}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            {!hideSubtitlesVideo && (
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Header Overlay */}
                      <div className="relative z-10 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                          <span className="text-[11px] font-bold text-white truncate max-w-[150px]">
                            {manga.title}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-zinc-300 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                          Scene {currentVideoPanelIdx + 1} / {activeScenes.length}
                        </span>
                      </div>

                      {/* Subtitle Overlay with Custom Position, Size, Color */}
                      <div
                        className={`relative z-10 p-5 space-y-3 flex flex-col ${
                          subtitlePos === 'top'
                            ? 'justify-start my-auto'
                            : subtitlePos === 'center'
                            ? 'justify-center my-auto'
                            : 'justify-end'
                        }`}
                      >
                        {!hideSubtitlesVideo && (
                          <div className="bg-black/80 backdrop-blur-md p-4 rounded-2xl border border-rose-500/30 space-y-2 shadow-2xl">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-rose-600 text-[10px] font-bold text-white">
                                  🗣 {activeScenes[currentVideoPanelIdx]?.speaker || 'सूत्रधार'}
                                </span>
                                {(sceneVoiceAudios[activeScenes[currentVideoPanelIdx]?.sceneId]?.audioUrl || activeScenes[currentVideoPanelIdx]?.userAudioUrl) && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/40 flex items-center gap-1">
                                    <Mic className="w-2.5 h-2.5 text-emerald-400" /> User Voice
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-amber-300 font-mono">
                                ⚡ {activeScenes[currentVideoPanelIdx]?.sfx}
                              </span>
                            </div>

                            <p
                              className={`font-bold leading-relaxed ${
                                subtitleColor === 'cyan'
                                  ? 'text-cyan-300'
                                  : subtitleColor === 'white'
                                  ? 'text-white'
                                  : 'text-amber-300'
                              } ${
                                subtitleSize === 'small'
                                  ? 'text-xs'
                                  : subtitleSize === 'large'
                                  ? 'text-base sm:text-lg'
                                  : 'text-sm'
                              }`}
                            >
                              "{subtitleLanguage === 'English'
                                ? (activeScenes[currentVideoPanelIdx]?.dialogueEnglish || activeScenes[currentVideoPanelIdx]?.dialogueHindi)
                                : activeScenes[currentVideoPanelIdx]?.dialogueHindi}"
                            </p>

                            {/* Narrator POV breakdown in Video overlay */}
                            {(activeScenes[currentVideoPanelIdx]?.characterAction || activeScenes[currentVideoPanelIdx]?.characterSays) && (
                              <div className="space-y-1 pt-1.5 border-t border-white/10 text-[11px]">
                                {activeScenes[currentVideoPanelIdx]?.characterAction && (
                                  <div className="flex items-start gap-1.5 text-amber-200/95 bg-amber-500/10 px-2 py-1 rounded">
                                    <span className="font-bold text-amber-400 shrink-0">⚡ क्या करता है:</span>
                                    <span>{activeScenes[currentVideoPanelIdx]?.characterAction}</span>
                                  </div>
                                )}
                                {activeScenes[currentVideoPanelIdx]?.characterSays && (
                                  <div className="flex items-start gap-1.5 text-rose-200/95 bg-rose-500/10 px-2 py-1 rounded">
                                    <span className="font-bold text-rose-400 shrink-0">💬 क्या कहता है:</span>
                                    <span>"{activeScenes[currentVideoPanelIdx]?.characterSays}"</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-white/10">
                              <span>🎵 {activeScenes[currentVideoPanelIdx]?.bgmSuggestion}</span>
                              <span>🎥 {activeScenes[currentVideoPanelIdx]?.actionDescription}</span>
                            </div>
                          </div>
                        )}

                        {/* Timeline Progress Bar */}
                        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-300"
                            style={{
                              width: `${((currentVideoPanelIdx + 1) / activeScenes.length) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-zinc-400 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                      No scenes included in timeline. Switch to the Scene Editor tab to enable ("Take") scenes.
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
      {/* Voice Sample Manager Modal Popup */}
      {showVoiceManagerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Mic className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Voice Sample Manager</h3>
                  <p className="text-[11px] text-amber-200/80">Single Narrator Audio Voice Sample</p>
                </div>
              </div>
              <button
                onClick={() => setShowVoiceManagerModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">Custom Voice Sample File</span>
                  {hasVoiceSample ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                      None
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {hasVoiceSample
                    ? '1 custom narrator audio file is active at server/audiosample/sample_narrator.mp3. Uploading a new file will automatically replace this current sample.'
                    : 'No custom voice sample uploaded. Upload an MP3 audio file to use as your custom narrator voice narration.'}
                </p>

                {hasVoiceSample && (
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
                    <button
                      onClick={() => {
                        const audio = new Audio('/api/v1/ai/voice-sample');
                        audio.play();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Play Voice Sample
                    </button>

                    <button
                      onClick={handleDeleteVoiceSample}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Sample
                    </button>
                  </div>
                )}
              </div>

              {/* Action Tabs: Record Live vs Upload File */}
              <div className="flex border-b border-zinc-800 gap-2">
                <button
                  onClick={() => setActiveVoiceTab('record')}
                  className={`pb-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeVoiceTab === 'record'
                      ? 'border-amber-400 text-amber-300'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" /> 🎙 Record Live Voice
                </button>
                <button
                  onClick={() => setActiveVoiceTab('upload')}
                  className={`pb-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeVoiceTab === 'upload'
                      ? 'border-amber-400 text-amber-300'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" /> 📁 Upload MP3 File
                </button>
              </div>

              {/* TAB 1: RECORD LIVE VOICE */}
              {activeVoiceTab === 'record' && (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 text-center">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white">Record Narrator Voice Sample</h4>
                    <p className="text-[11px] text-zinc-400">
                      Speak into your microphone to record your custom sample voice.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 py-2">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
                      >
                        <Circle className="w-3.5 h-3.5 fill-current text-white animate-pulse" />
                        <span>Start Recording</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Recording ({recordingSeconds}s)</span>
                      </button>
                    )}
                  </div>

                  {recordedAudioUrl && !isRecording && (
                    <div className="p-3 rounded-lg bg-zinc-900 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                        <span>Recorded Audio Sample</span>
                        <span>{recordingSeconds}s</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            const audio = new Audio(recordedAudioUrl);
                            audio.play();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Play Recorded Clip
                        </button>
                        <button
                          onClick={uploadRecordedAudio}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Save as Narrator Voice
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: UPLOAD AUDIO FILE */}
              {activeVoiceTab === 'upload' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-200 block">
                    {hasVoiceSample ? 'Replace Sample Audio File (Single Voice Only):' : 'Upload Narrator Voice Sample (MP3):'}
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-950/10 cursor-pointer transition-all">
                    <Upload className="w-6 h-6 text-amber-400 mb-1 animate-bounce" />
                    <span className="text-xs font-bold text-amber-300">Click to Select Audio File</span>
                    <span className="text-[10px] text-zinc-400">Supported: .mp3, .wav (Max 15MB)</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleUploadVoiceSample}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {uploadStatus && (
                <p className="text-xs font-medium text-amber-300 bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/30">
                  {uploadStatus}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowVoiceManagerModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE CUSTOM CROP & MULTI-SCENE STUDIO MODAL */}
      {cropModalPanel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 text-zinc-100 space-y-6 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Visual Crop & Multi-Scene Generator
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Panel #{cropModalPanel.panelIndex} • Crop custom regions, add scenes one-by-one, or split panel image into multiple video scenes!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCropModalPanel(null)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Middle Grid: Image Canvas Cropper vs 9:16 Reel Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Visual Image Cropper & Overlay Box */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <Crop className="w-4 h-4 text-amber-400" />
                    Interactive Crop Box Selector
                  </span>
                  <span className="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-mono">
                    Top: {customTopPct}% | Height: {customHeightPct}%
                  </span>
                </div>

                {/* Interactive Drag & Crop Canvas (Mouse / Touch Hand Dragging) */}
                <div
                  ref={cropContainerRef}
                  onMouseDown={(e) => handleCropDragStart(e, 'draw')}
                  onTouchStart={(e) => handleCropDragStart(e, 'draw')}
                  className="relative rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-black flex items-center justify-center min-h-[340px] max-h-[440px] shadow-inner select-none cursor-crosshair group"
                >
                  <img
                    src={cropModalPanel.pageUrl}
                    alt={`Panel ${cropModalPanel.panelIndex}`}
                    className="w-full h-auto max-h-[440px] object-contain opacity-40 pointer-events-none select-none"
                    referrerPolicy="no-referrer"
                  />

                  {/* Highlights the EXACT cropped region with Interactive Drag Handles */}
                  <div
                    className="absolute left-0 right-0 border-2 border-amber-400 bg-amber-400/30 shadow-2xl transition-shadow flex flex-col justify-between"
                    style={{
                      top: `${customTopPct}%`,
                      height: `${customHeightPct}%`,
                    }}
                  >
                    {/* Top Drag Handle Bar */}
                    <div
                      onMouseDown={(e) => handleCropDragStart(e, 'top')}
                      onTouchStart={(e) => handleCropDragStart(e, 'top')}
                      className="w-full h-4 -mt-2 bg-amber-400 hover:bg-amber-300 cursor-ns-resize flex items-center justify-center border-y border-black/40 z-20 shadow-md group/top"
                      title="Click & Drag Top Edge"
                    >
                      <div className="w-12 h-1 bg-black/80 rounded-full group-hover/top:bg-black"></div>
                    </div>

                    {/* Center Grab & Move Box Handle */}
                    <div
                      onMouseDown={(e) => handleCropDragStart(e, 'center')}
                      onTouchStart={(e) => handleCropDragStart(e, 'center')}
                      className="flex-1 w-full cursor-grab active:cursor-grabbing hover:bg-amber-400/20 flex items-center justify-between px-3 text-xs z-10 select-none"
                      title="Click and Drag to move crop box up/down"
                    >
                      <span className="text-[10px] font-black text-black bg-amber-400 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow">
                        ✋ Hand Drag Box
                      </span>
                      <span className="text-[10px] font-bold text-white bg-black/90 px-2.5 py-0.5 rounded-full border border-amber-400/60 font-mono shadow">
                        Top: {customTopPct}% | Height: {customHeightPct}%
                      </span>
                    </div>

                    {/* Bottom Drag Handle Bar */}
                    <div
                      onMouseDown={(e) => handleCropDragStart(e, 'bottom')}
                      onTouchStart={(e) => handleCropDragStart(e, 'bottom')}
                      className="w-full h-4 -mb-2 bg-amber-400 hover:bg-amber-300 cursor-ns-resize flex items-center justify-center border-y border-black/40 z-20 shadow-md group/bottom"
                      title="Click & Drag Bottom Edge"
                    >
                      <div className="w-12 h-1 bg-black/80 rounded-full group-hover/bottom:bg-black"></div>
                    </div>
                  </div>
                </div>

                {/* Range Sliders & AI Vision Page Story Scan Button */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-300">
                      Cursor / Hand Crop Controls:
                    </span>
                    <button
                      onClick={handleAiVisionScanPanel}
                      disabled={extractingPanelIdx === cropModalPanel.panelIndex}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                      title="Read entire page image with Gemini Vision AI and build scene-by-scene script with subtitles"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${extractingPanelIdx === cropModalPanel.panelIndex ? 'animate-spin' : ''}`} />
                      <span>{extractingPanelIdx === cropModalPanel.panelIndex ? 'Analyzing Vision...' : '✨ AI Vision Auto-Scan Story'}</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-zinc-300 font-medium">
                      <span>Top Offset Position:</span>
                      <strong className="text-amber-300">{customTopPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, 100 - customHeightPct)}
                      value={customTopPct}
                      onChange={(e) => setCustomTopPct(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-zinc-300 font-medium">
                      <span>Crop Frame Height:</span>
                      <strong className="text-amber-300">{customHeightPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100 - customTopPct}
                      value={customHeightPct}
                      onChange={(e) => setCustomHeightPct(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="pt-2 border-t border-zinc-800/80">
                    <span className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                      Quick Crop Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Scene 1 (Top 20%)', top: 0, height: 20 },
                        { label: 'Scene 2 (20-40%)', top: 20, height: 20 },
                        { label: 'Scene 3 (40-60%)', top: 40, height: 20 },
                        { label: 'Scene 4 (60-80%)', top: 60, height: 20 },
                        { label: 'Scene 5 (80-100%)', top: 80, height: 20 },
                        { label: 'Top Quarter', top: 0, height: 25 },
                        { label: 'Mid Quarter', top: 25, height: 25 },
                        { label: 'Top Half', top: 0, height: 50 },
                        { label: 'Bottom Half', top: 50, height: 50 },
                        { label: 'Full Image', top: 0, height: 100 },
                      ].map((p, pI) => (
                        <button
                          key={pI}
                          onClick={() => {
                            setCustomTopPct(p.top);
                            setCustomHeightPct(p.height);
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer border ${
                            customTopPct === p.top && customHeightPct === p.height
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live 9:16 Video Preview & Actions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <Video className="w-4 h-4 text-rose-400" />
                    Live 9:16 Reel Video Stage Preview
                  </span>
                  <span className="text-xs text-rose-400 font-bold">Vertical Video View</span>
                </div>

                {/* 9:16 Video Preview Stage */}
                <div className="w-full h-56 sm:h-64 bg-black rounded-2xl overflow-hidden border-2 border-rose-500/40 relative flex items-center justify-center shadow-lg">
                  <div
                    className="w-full relative overflow-hidden"
                    style={{
                      height: `${(100 / (customHeightPct || 25)) * 100}%`,
                      marginTop: `-${(customTopPct / (customHeightPct || 25)) * 100}%`,
                    }}
                  >
                    <img
                      src={cropModalPanel.pageUrl}
                      alt="Crop Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-3 left-3 right-3 p-2 bg-black/80 backdrop-blur rounded-xl border border-rose-500/30 text-xs text-zinc-200">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                      🗣 {customSpeaker || 'सूत्रधार'}
                    </span>
                    <p className="line-clamp-2 text-xs italic font-medium">"{customDialogue}"</p>
                  </div>
                </div>

                {/* Add This Single Crop as Scene Form */}
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Speaker:</label>
                      <input
                        type="text"
                        value={customSpeaker}
                        onChange={(e) => setCustomSpeaker(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                        placeholder="e.g. सूत्रधार / नायक"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Duration:</label>
                      <input
                        type="text"
                        value="4 Seconds"
                        disabled
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1">Dialogue Hindi:</label>
                    <textarea
                      value={customDialogue}
                      onChange={(e) => setCustomDialogue(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                      placeholder="Enter dialogue text for this cropped scene..."
                    />
                  </div>

                  <button
                    onClick={handleAddCustomCroppedScene}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>➕ Add This Crop As New Scene</span>
                  </button>
                </div>

                {/* Batch Multi-Scene Generation Options */}
                <div className="bg-zinc-950/80 p-3.5 rounded-xl border border-amber-500/30 space-y-2 text-xs">
                  <span className="text-amber-300 font-bold block flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Multiple Screen Auto-Generate Options:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleBatchGenerateModalScenes(2)}
                      className="py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-amber-500/20 text-zinc-200 hover:text-amber-300 border border-zinc-800 hover:border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <span>⚡ 2 Equal Scenes</span>
                    </button>
                    <button
                      onClick={() => handleBatchGenerateModalScenes(3)}
                      className="py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-amber-500/20 text-zinc-200 hover:text-amber-300 border border-zinc-800 hover:border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <span>⚡ 3 Equal Scenes</span>
                    </button>
                    <button
                      onClick={() => handleBatchGenerateModalScenes(4)}
                      className="py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-amber-500/20 text-zinc-200 hover:text-amber-300 border border-zinc-800 hover:border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <span>⚡ 4 Equal Scenes</span>
                    </button>
                    <button
                      onClick={() => handleBatchGenerateModalScenes(5)}
                      className="py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-amber-500/20 text-zinc-200 hover:text-amber-300 border border-zinc-800 hover:border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <span>⚡ 5 Equal Scenes</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* All Current Generated Scenes for this Image Panel */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-amber-400" />
                  Generated Scenes for Panel #{cropModalPanel.panelIndex} ({cropModalPanel.incidents?.length || 1} Total)
                </h4>
              </div>

              {cropModalPanel.incidents && cropModalPanel.incidents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {cropModalPanel.incidents.map((inc, iI) => {
                    const incCrop = inc.cropRect || { topPct: 0, heightPct: 25 };
                    return (
                      <div
                        key={iI}
                        className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-3 relative group"
                      >
                        <div className="w-16 h-20 bg-black rounded-lg overflow-hidden border border-amber-500/30 shrink-0 relative flex items-center justify-center">
                          <div
                            className="w-full relative overflow-hidden"
                            style={{
                              height: `${(100 / (incCrop.heightPct || 25)) * 100}%`,
                              marginTop: `-${(incCrop.topPct / (incCrop.heightPct || 25)) * 100}%`,
                            }}
                          >
                            <img
                              src={cropModalPanel.pageUrl}
                              alt="Inc"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-300 truncate">
                              {inc.incidentTitle || `Scene #${iI + 1}`}
                            </span>
                            <button
                              onClick={() => handleDeleteIncidentFromModal(inc.incidentIndex || iI + 1)}
                              className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                              title="Delete Scene"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] text-zinc-400 block font-mono">
                            Crop: {incCrop.topPct}% - {incCrop.topPct + incCrop.heightPct}%
                          </span>
                          <p className="text-[11px] text-zinc-300 truncate italic">
                            "{inc.dialogueHindi}"
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">
                  No individual scenes generated yet. Use the Interactive Cropper above or click an Auto-Generate button to create scenes from this image.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button
                onClick={() => setCropModalPanel(null)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-zinc-900/95 text-white border border-amber-500/40 shadow-2xl shadow-black backdrop-blur-md animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-zinc-100">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
