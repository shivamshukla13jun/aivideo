import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Sliders,
  BookOpen,
  ArrowLeft,
  Settings2,
  CheckCircle,
  Loader2,
  Film,
  Sparkles,
  Volume2,
  VolumeX,
  Edit3,
  Save,
  Mic,
  Upload,
  Play,
  Pause,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Scan,
  Scissors,
  Square,
  Circle,
  Crop,
} from 'lucide-react';
import { Manga, Chapter, ReaderMode, WebtoonScript, WebtoonPanel } from '../types.js';
import { WebtoonVideoStudioModal } from './WebtoonVideoStudioModal.js';

interface MangaReaderProps {
  manga: Manga;
  chapter: Chapter;
  chapters: Chapter[];
  onClose: () => void;
  onSelectChapter: (chapter: Chapter) => void;
  onProgressUpdate: (chapterId: number, lastPageRead: number, isFinished: boolean) => void;
}

export const MangaReader: React.FC<MangaReaderProps> = ({
  manga,
  chapter,
  chapters,
  onClose,
  onSelectChapter,
  onProgressUpdate,
}) => {
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(chapter.lastPageRead || 1);
  const [readerMode, setReaderMode] = useState<ReaderMode>('webtoon');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showVideoStudio, setShowVideoStudio] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // AI Subtitles & Human / Sample Voice State
  const [showAiSubtitles, setShowAiSubtitles] = useState(false);
  const [webtoonScript, setWebtoonScript] = useState<WebtoonScript | null>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'human' | 'sample_narrator'>('human');
  const [editingPanelIdx, setEditingPanelIdx] = useState<number | null>(null);
  const [editDialogueText, setEditDialogueText] = useState('');
  const [editSpeakerText, setEditSpeakerText] = useState('');
  const [editCharacterAction, setEditCharacterAction] = useState('');
  const [editCharacterSays, setEditCharacterSays] = useState('');
  const [isSavingSubtitle, setIsSavingSubtitle] = useState(false);
  const [playingPanelIdx, setPlayingPanelIdx] = useState<number | null>(null);
  const [extractingPanelIdx, setExtractingPanelIdx] = useState<number | null>(null);
  const [showVoiceUploadModal, setShowVoiceUploadModal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // In-Reader Hand Crop & Story Scene Creator State
  const [showHandCropModal, setShowHandCropModal] = useState(false);
  const [handCropPanelIdx, setHandCropPanelIdx] = useState<number>(1);
  const [handCropPageUrl, setHandCropPageUrl] = useState<string>('');
  const [handCropTopPct, setHandCropTopPct] = useState<number>(0);
  const [handCropHeightPct, setHandCropHeightPct] = useState<number>(30);
  const [handCropDialogue, setHandCropDialogue] = useState<string>('');
  const [handCropSpeaker, setHandCropSpeaker] = useState<string>('मुख्य पात्र');
  const [handCropStatus, setHandCropStatus] = useState<string>('');

  const handleOpenHandCropModal = (panelIdx: number, pageUrl: string) => {
    setHandCropPanelIdx(panelIdx);
    setHandCropPageUrl(pageUrl);
    setHandCropTopPct(0);
    setHandCropHeightPct(30);
    setHandCropDialogue('');
    setHandCropSpeaker('मुख्य पात्र');
    setHandCropStatus('');
    setShowHandCropModal(true);
  };

  const handleSaveHandCropScene = async () => {
    if (!handCropPageUrl) return;
    setHandCropStatus('Saving cropped scene & dialogue to Video Studio...');

    let currentScript = webtoonScript;
    if (!currentScript) {
      currentScript = {
        id: `${manga.id}_${chapter.id}`,
        mangaId: manga.id,
        chapterId: chapter.id,
        mangaTitle: manga.title,
        chapterName: chapter.name,
        overallStory: `manga: ${manga.title} chapter: ${chapter.name}`,
        characters: [],
        panels: pages.map((url, i) => ({
          panelIndex: i + 1,
          pageUrl: url,
          dialogueHindi: `पैनल ${i + 1} का दृश्य`,
          speaker: 'सूत्रधार',
          actionDescription: 'कैमरा ज़ूम',
          bgmSuggestion: 'BGM',
          sfx: 'सरसराहट',
          estimatedDurationSec: 4,
          incidents: [],
        })),
        generatedAt: new Date().toISOString(),
        language: 'hi',
      };
    }

    const updatedPanels = [...currentScript.panels];
    let pIdx = updatedPanels.findIndex((p) => p.panelIndex === handCropPanelIdx);

    if (pIdx === -1) {
      updatedPanels.push({
        panelIndex: handCropPanelIdx,
        pageUrl: handCropPageUrl,
        dialogueHindi: handCropDialogue || 'दृश्य संवाद',
        speaker: handCropSpeaker || 'मुख्य पात्र',
        actionDescription: 'हैंड क्रॉप दृश्य',
        bgmSuggestion: 'BGM',
        sfx: 'सरसराहट',
        estimatedDurationSec: 4,
        incidents: [],
      });
      pIdx = updatedPanels.length - 1;
    }

    const targetPanel = updatedPanels[pIdx];
    const existingIncidents = targetPanel.incidents ? [...targetPanel.incidents] : [];
    const newIncidentIndex = existingIncidents.length + 1;

    existingIncidents.push({
      incidentIndex: newIncidentIndex,
      incidentTitle: `पैनल ${handCropPanelIdx} - दृश्य ${newIncidentIndex}`,
      cropRect: { topPct: handCropTopPct, heightPct: handCropHeightPct },
      speaker: handCropSpeaker || 'मुख्य पात्र',
      dialogueHindi: handCropDialogue || `दृश्य ${newIncidentIndex} संवाद`,
      sfx: 'सरसराहट',
      actionDescription: 'उपयोगकर्ता द्वारा चुना गया हैंड क्रॉप दृश्य',
    });

    updatedPanels[pIdx] = {
      ...targetPanel,
      incidents: existingIncidents,
      dialogueHindi: targetPanel.dialogueHindi || handCropDialogue,
    };

    const newScript: WebtoonScript = {
      ...currentScript,
      panels: updatedPanels,
    };

    try {
      const res = await fetch(`/api/v1/ai/webtoon-script/${manga.id}/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: newScript }),
      });
      if (res.ok) {
        const saved = await res.json();
        setWebtoonScript(saved);
        setHandCropStatus('✓ Hand-cropped scene saved to Video Studio!');
        setTimeout(() => {
          setShowHandCropModal(false);
          setHandCropStatus('');
        }, 1200);
      } else {
        setWebtoonScript(newScript);
        setHandCropStatus('✓ Saved locally to script!');
        setTimeout(() => {
          setShowHandCropModal(false);
          setHandCropStatus('');
        }, 1200);
      }
    } catch (err) {
      setWebtoonScript(newScript);
      setHandCropStatus('✓ Saved to session script!');
      setTimeout(() => {
        setShowHandCropModal(false);
        setHandCropStatus('');
      }, 1200);
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
          setVoiceMode('sample_narrator');
          setUploadStatus('✓ Live recording saved as narrator voice sample!');
          setTimeout(() => {
            setShowVoiceUploadModal(false);
            setUploadStatus('');
          }, 1500);
        } else {
          setUploadStatus('Failed to save recorded voice.');
        }
      } catch (err) {
        setUploadStatus('Error saving live recorded audio.');
      }
    };
    reader.readAsDataURL(recordedBlob);
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize pages from chapter or fetch live from API
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setPages([]);

    if (chapter.pages && chapter.pages.length > 0) {
      setPages(chapter.pages);
      setIsLoading(false);
    } else {
      // Attempt live fetch from API
      fetch(`/api/v1/chapter/${chapter.id}/pages`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted) return;
          if (data && Array.isArray(data.pages) && data.pages.length > 0) {
            setPages(data.pages);
          } else {
            // Fallback pages if source is unreachable
            setPages([
              'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=900&auto=format&fit=crop&q=85',
              'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=900&auto=format&fit=crop&q=85',
              'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=900&auto=format&fit=crop&q=85',
              'https://images.unsplash.com/photo-1563089145-599997674d42?w=900&auto=format&fit=crop&q=85',
              'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=900&auto=format&fit=crop&q=85',
            ]);
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (!isMounted) return;
          setPages([
            'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=900&auto=format&fit=crop&q=85',
          ]);
          setIsLoading(false);
        });
    }
    setCurrentPage(chapter.lastPageRead > 0 ? Math.min(chapter.lastPageRead, chapter.pageCount || 1) : 1);
    return () => {
      isMounted = false;
    };
  }, [chapter]);

  // Save progress on page change
  const saveProgress = (page: number) => {
    const isFinished = page >= pages.length;
    onProgressUpdate(chapter.id, page, isFinished);

    // Call API
    fetch(`/api/v1/chapter/${chapter.id}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastPageRead: page, read: isFinished }),
    }).catch((e) => console.error('Failed to sync progress:', e));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        if (readerMode === 'rtl') handlePrevPage();
        else handleNextPage();
      } else if (e.key === 'ArrowLeft') {
        if (readerMode === 'rtl') handleNextPage();
        else handlePrevPage();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, pages.length, readerMode, onClose]);

  const handleNextPage = () => {
    if (currentPage < pages.length) {
      const next = currentPage + 1;
      setCurrentPage(next);
      saveProgress(next);
    } else {
      // Prompt next chapter
      handleNextChapter();
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      saveProgress(prev);
    }
  };

  // Next / Prev Chapter navigation
  const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const currentIndex = sortedChapters.findIndex((c) => c.id === chapter.id);
  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  const handleNextChapter = () => {
    if (nextChapter) {
      onSelectChapter(nextChapter);
    }
  };

  // Fetch or Generate AI Subtitles Script
  const loadAiSubtitles = async () => {
    setIsLoadingScript(true);
    try {
      const res = await fetch('/api/v1/ai/webtoon-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mangaId: manga.id,
          chapterId: chapter.id,
          mangaTitle: manga.title,
          chapterName: chapter.name,
          pages,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWebtoonScript(data);
      }
    } catch (e) {
      console.error('[MangaReader] Error loading AI subtitles:', e);
    } finally {
      setIsLoadingScript(false);
    }
  };

  // Trigger loading when AI Subtitles mode is toggled ON
  useEffect(() => {
    if (showAiSubtitles && !webtoonScript && pages.length > 0) {
      loadAiSubtitles();
    }
  }, [showAiSubtitles, chapter.id, pages]);

  // Save subtitle edits to database
  const handleSaveSubtitle = async (panelIdx: number) => {
    if (!webtoonScript) return;
    setIsSavingSubtitle(true);

    const updatedPanels = webtoonScript.panels.map((p) => {
      if (p.panelIndex === panelIdx) {
        return {
          ...p,
          dialogueHindi: editDialogueText,
          speaker: editSpeakerText || p.speaker,
          characterAction: editCharacterAction,
          characterSays: editCharacterSays,
        };
      }
      return p;
    });

    const updatedScript: WebtoonScript = {
      ...webtoonScript,
      panels: updatedPanels,
    };

    try {
      const res = await fetch(`/api/v1/ai/webtoon-script/${manga.id}/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: updatedScript }),
      });
      if (res.ok) {
        const saved = await res.json();
        setWebtoonScript(saved);
        setEditingPanelIdx(null);
      }
    } catch (e) {
      console.error('[MangaReader] Error saving subtitle edit:', e);
    } finally {
      setIsSavingSubtitle(false);
    }
  };

  // Gemini Vision extraction from panel image (single dialogue)
  const handleExtractVisionSubtitle = async (panelIdx: number, imageUrl: string) => {
    if (!webtoonScript || !imageUrl) return;
    setExtractingPanelIdx(panelIdx);
    try {
      const res = await fetch('/api/v1/ai/extract-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          mangaTitle: manga.title,
          panelIndex: panelIdx,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedPanels = webtoonScript.panels.map((p) => {
          if (p.panelIndex === panelIdx) {
            return {
              ...p,
              dialogueHindi: data.dialogueHindi || p.dialogueHindi,
              speaker: data.speaker || p.speaker,
              sfx: data.sfx || p.sfx,
            };
          }
          return p;
        });
        const updatedScript = { ...webtoonScript, panels: updatedPanels };
        // Save to DB
        const saveRes = await fetch(`/api/v1/ai/webtoon-script/${manga.id}/${chapter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: updatedScript }),
        });
        if (saveRes.ok) {
          const saved = await saveRes.json();
          setWebtoonScript(saved);
        }
      }
    } catch (e) {
      console.error('[MangaReader] Error extracting vision subtitles:', e);
    } finally {
      setExtractingPanelIdx(null);
    }
  };

  // Gemini Vision multi-incident decomposition for panel image
  const handleExtractVisionIncidents = async (panelIdx: number, imageUrl: string) => {
    if (!webtoonScript || !imageUrl) return;
    setExtractingPanelIdx(panelIdx);
    try {
      const res = await fetch('/api/v1/ai/extract-incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          mangaTitle: manga.title,
          panelIndex: panelIdx,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.incidents)) {
          const updatedPanels = webtoonScript.panels.map((p) => {
            if (p.panelIndex === panelIdx) {
              return {
                ...p,
                incidents: data.incidents,
              };
            }
            return p;
          });
          const updatedScript = { ...webtoonScript, panels: updatedPanels };
          const saveRes = await fetch(`/api/v1/ai/webtoon-script/${manga.id}/${chapter.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: updatedScript }),
          });
          if (saveRes.ok) {
            const saved = await saveRes.json();
            setWebtoonScript(saved);
          }
        }
      }
    } catch (e) {
      console.error('[MangaReader] Error extracting vision incidents:', e);
    } finally {
      setExtractingPanelIdx(null);
    }
  };

  // Skip / Delete panel from narration sequence
  const handleToggleSkipPanel = async (panelIdx: number) => {
    if (!webtoonScript) return;
    const updatedPanels = webtoonScript.panels.map((p) => {
      if (p.panelIndex === panelIdx) {
        return {
          ...p,
          skipped: !p.skipped,
        };
      }
      return p;
    });
    const updatedScript = { ...webtoonScript, panels: updatedPanels };
    setWebtoonScript(updatedScript);
    try {
      await fetch(`/api/v1/ai/webtoon-script/${manga.id}/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: updatedScript }),
      });
    } catch (e) {
      console.error('[MangaReader] Error saving skip panel state:', e);
    }
  };

  // Play voiceover for panel
  const handlePlayVoiceover = async (panelIdx: number, text: string) => {
    if (playingPanelIdx === panelIdx) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingPanelIdx(null);
      return;
    }

    setPlayingPanelIdx(panelIdx);

    try {
      if (voiceMode === 'sample_narrator') {
        const audioUrl = `/api/v1/ai/tts?text=${encodeURIComponent(text)}&voiceMode=sample_narrator`;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          await audioRef.current.play();
        }
      } else {
        // Human Web Speech API fallback or server TTS
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'hi-IN';
          utterance.rate = 0.92;
          utterance.pitch = 1.0;
          utterance.onend = () => setPlayingPanelIdx(null);
          utterance.onerror = () => setPlayingPanelIdx(null);
          window.speechSynthesis.speak(utterance);
        } else {
          const audioUrl = `/api/v1/ai/tts?text=${encodeURIComponent(text)}&lang=hi`;
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            await audioRef.current.play();
          }
        }
      }
    } catch (err) {
      console.warn('[MangaReader] Voiceover play error:', err);
      setPlayingPanelIdx(null);
    }
  };

  // Handle uploading custom audio sample file
  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Uploading custom sample voice file...');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/v1/ai/upload-voice-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Audio: base64,
            fileName: 'sample_narrator.mp3',
          }),
        });
        if (res.ok) {
          setUploadStatus('✓ Custom voice sample saved! Selected as active voice.');
          setVoiceMode('sample_narrator');
          setTimeout(() => {
            setShowVoiceUploadModal(false);
            setUploadStatus('');
          }, 1500);
        } else {
          setUploadStatus('Error saving voice file.');
        }
      } catch (err) {
        setUploadStatus('Failed to upload voice sample.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePrevChapter = () => {
    if (prevChapter) {
      onSelectChapter(prevChapter);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black text-white flex flex-col select-none overflow-hidden"
    >
      {/* Permanent Floating Quick-Action Back Navigation Button - ALWAYS VISIBLE */}
      <div className="fixed top-3 left-3 z-50 flex items-center gap-2">
        <button
          id="btn-reader-floating-back"
          onClick={onClose}
          className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-900/95 hover:bg-rose-600 text-zinc-100 hover:text-white border border-zinc-700/80 hover:border-rose-500 shadow-2xl backdrop-blur-md transition-all duration-200 cursor-pointer text-xs font-bold select-none"
          title="Back to Manga / Library (Esc)"
        >
          <ArrowLeft className="w-4 h-4 text-rose-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
          <span>Back</span>
        </button>
        <button
          onClick={() => setShowControls((prev) => !prev)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70 backdrop-blur-md text-xs font-medium transition-all cursor-pointer shadow-lg"
          title="Toggle Reader Controls"
        >
          <span className="truncate max-w-[120px] md:max-w-[180px]">{manga.title}</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400 truncate max-w-[100px]">{chapter.name}</span>
        </button>
      </div>

      {/* Top Controls Overlay */}
      <div
        className={`absolute top-0 inset-x-0 z-40 bg-gradient-to-b from-black/95 via-black/80 to-transparent pt-3 pb-4 px-4 sm:px-6 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 pl-24 sm:pl-32">
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="btn-reader-back"
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50 backdrop-blur transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{manga.title}</h3>
              <p className="text-xs text-zinc-400 truncate">{chapter.name}</p>
            </div>
          </div>

          {/* Chapter Selector & Quick Navigation Dropdown */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="btn-reader-top-prev-chapter"
              disabled={!prevChapter}
              onClick={handlePrevChapter}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none border border-zinc-700/80 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title={prevChapter ? `Previous: ${prevChapter.name}` : 'No previous chapter'}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden md:inline">Prev</span>
            </button>

            <select
              id="select-reader-chapter"
              value={chapter.id}
              onChange={(e) => {
                const selected = chapters.find((c) => c.id === parseInt(e.target.value, 10));
                if (selected) onSelectChapter(selected);
              }}
              className="bg-zinc-900/90 border border-zinc-700/80 text-xs text-zinc-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-rose-500 max-w-[140px] sm:max-w-[220px] truncate"
            >
              {[...chapters]
                .sort((a, b) => b.chapterNumber - a.chapterNumber)
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
            </select>

            <button
              id="btn-reader-top-next-chapter"
              disabled={!nextChapter}
              onClick={handleNextChapter}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none border border-zinc-700/80 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title={nextChapter ? `Next: ${nextChapter.name}` : 'No next chapter'}
            >
              <span className="hidden md:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              id="btn-reader-ai-subtitles-toggle"
              onClick={() => setShowAiSubtitles(!showAiSubtitles)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showAiSubtitles
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-zinc-900/90 text-amber-300 hover:text-amber-200 border-amber-500/30 hover:border-amber-500/60'
              }`}
              title="Read with AI Subtitles & Voice Conversion"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">AI Subtitles</span>
            </button>

            <button
              id="btn-reader-ai-video-studio"
              onClick={() => setShowVideoStudio(true)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="AI Webtoon Video Studio"
            >
              <Film className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">AI Studio</span>
            </button>

            <button
              id="btn-reader-settings-toggle"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                showSettings
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-300 hover:text-white'
              }`}
              title="Reader Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            <button
              id="btn-reader-fullscreen"
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Reader Settings Drawer */}
        {showSettings && (
          <div className="max-w-md ml-auto mt-3 p-4 rounded-xl bg-zinc-900/95 border border-zinc-800 backdrop-blur-md shadow-2xl space-y-3">
            <h4 className="text-xs font-semibold uppercase text-zinc-400">Reading Layout</h4>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(
                [
                  { id: 'webtoon', label: 'Webtoon' },
                  { id: 'single', label: 'Single Page' },
                  { id: 'ltr', label: 'Left to Right' },
                  { id: 'rtl', label: 'Right to Left' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setReaderMode(mode.id)}
                  className={`py-2 px-2.5 rounded-lg font-medium transition-all cursor-pointer ${
                    readerMode === mode.id
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Subtitles & Voice Settings Bar */}
        {showAiSubtitles && (
          <div className="max-w-3xl mx-auto mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 backdrop-blur-md shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="font-semibold text-amber-200">AI Subtitles Active</span>
              {isLoadingScript && (
                <span className="flex items-center gap-1 text-amber-400/80">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Converting chapter...</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-amber-500/20">
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-zinc-300">Voice:</span>
                <select
                  value={voiceMode}
                  onChange={(e) => setVoiceMode(e.target.value as any)}
                  className="bg-transparent text-amber-200 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="human" className="bg-zinc-900 text-white">Human AI Voice (hi-IN)</option>
                  <option value="sample_narrator" className="bg-zinc-900 text-white">My Sample Voice (audiosample)</option>
                </select>
              </div>

              <button
                id="btn-upload-sample-voice"
                onClick={() => setShowVoiceUploadModal(true)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                title="Upload my sample voice for narration"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload Sample Voice</span>
              </button>

              <button
                onClick={loadAiSubtitles}
                disabled={isLoadingScript}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
                title="Regenerate AI Subtitles"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingScript ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Canvas / Reading Area */}
      <div
        className="flex-1 overflow-auto flex justify-center items-center relative"
        onClick={() => setShowControls((prev) => !prev)}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-400 space-y-4">
            <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
            <p className="text-xs font-medium">Loading chapter pages...</p>
            <button
              onClick={onClose}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-700 cursor-pointer shadow-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-rose-400" />
              <span>Back to Manga</span>
            </button>
          </div>
        ) : readerMode === 'webtoon' ? (
          /* Webtoon: Continuous Vertical Strip */
          <div className="w-full max-w-3xl mx-auto flex flex-col items-center py-16 px-2 space-y-4">
            {pages.map((pageUrl, idx) => {
              const panelData = webtoonScript?.panels?.[idx];
              const isEditingThis = editingPanelIdx === idx + 1;

              return (
                <div key={idx} className="w-full shadow-2xl relative flex flex-col items-center">
                  {/* Webtoon Image: Clean view with Hand Crop overlay button */}
                  <div className="w-full relative group rounded-lg overflow-hidden bg-zinc-950">
                    {pageUrl ? (
                      <img
                        src={pageUrl}
                        alt={`Page ${idx + 1}`}
                        className="w-full h-auto object-contain block"
                        referrerPolicy="no-referrer"
                        loading={idx > 2 ? 'lazy' : 'eager'}
                      />
                    ) : (
                      <div className="w-full h-64 bg-zinc-900 flex items-center justify-center text-zinc-500 text-xs">
                        Page image unavailable
                      </div>
                    )}
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-zinc-300 font-mono">
                      Page {idx + 1} / {pages.length}
                    </div>

                    {/* Hand Crop Button on image */}
                    {pageUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenHandCropModal(idx + 1, pageUrl);
                        }}
                        className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xl backdrop-blur border border-rose-400/50 cursor-pointer transition-all active:scale-95 z-10"
                        title="Pick exact portion of image & enter story dialogue"
                      >
                        <Scissors className="w-4 h-4 text-amber-300" />
                        <span>✂️ Crop Scene & Add Story</span>
                      </button>
                    )}
                  </div>

                  {/* Clean AI Subtitle & Voice Box directly underneath panel */}
                  {showAiSubtitles && (
                    <div className={`w-full mt-2 p-3.5 rounded-xl border backdrop-blur-md text-zinc-100 shadow-xl space-y-2 transition-all ${
                      panelData?.skipped 
                        ? 'bg-zinc-950/80 border-rose-900/50 opacity-60' 
                        : 'bg-zinc-900/90 border-amber-500/30'
                    }`}>
                      <div className="flex items-center justify-between text-xs border-b border-zinc-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            panelData?.skipped
                              ? 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                              : 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                          }`}>
                            {panelData?.skipped ? 'Skipped Panel' : (panelData?.speaker || `पैनल ${idx + 1}`)}
                          </span>
                          <span className="text-zinc-400 text-[11px]">
                            {panelData?.sfx ? `🎵 ${panelData.sfx}` : 'AI Conversational Subtitle'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() =>
                              handlePlayVoiceover(
                                idx + 1,
                                panelData?.dialogueHindi || `पैनल ${idx + 1} का दृश्य`
                              )
                            }
                            disabled={!!panelData?.skipped}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              panelData?.skipped
                                ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                                : playingPanelIdx === idx + 1
                                ? 'bg-amber-500 text-black animate-pulse'
                                : 'bg-zinc-800 hover:bg-amber-500 hover:text-black text-amber-300 border border-amber-500/30'
                            }`}
                            title="Play Voiceover Narration"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>{playingPanelIdx === idx + 1 ? 'Playing...' : 'Voice'}</span>
                          </button>

                          <button
                            onClick={() => handleExtractVisionSubtitle(idx + 1, pageUrl)}
                            disabled={extractingPanelIdx === idx + 1}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/50 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                            title="Extract text directly from panel image using Gemini Vision"
                          >
                            <Scan className={`w-3.5 h-3.5 text-cyan-400 ${extractingPanelIdx === idx + 1 ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Vision AI</span>
                          </button>

                          <button
                            onClick={() => handleExtractVisionIncidents(idx + 1, pageUrl)}
                            disabled={extractingPanelIdx === idx + 1}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                            title="Extract all visual scenes/incidents happening in this panel image using Vision AI"
                          >
                            <Scissors className={`w-3.5 h-3.5 text-amber-400 ${extractingPanelIdx === idx + 1 ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Incidents</span>
                          </button>

                          <button
                            onClick={() => {
                              if (isEditingThis) {
                                setEditingPanelIdx(null);
                              } else {
                                setEditingPanelIdx(idx + 1);
                                setEditDialogueText(panelData?.dialogueHindi || '');
                                setEditSpeakerText(panelData?.speaker || 'सूत्रधार');
                                setEditCharacterAction(panelData?.characterAction || '');
                                setEditCharacterSays(panelData?.characterSays || '');
                              }
                            }}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all cursor-pointer"
                            title="Edit AI Subtitle"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          <button
                            onClick={() => handleToggleSkipPanel(idx + 1)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                              panelData?.skipped
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800 hover:bg-rose-900'
                                : 'bg-zinc-800 text-zinc-400 hover:text-rose-400 border-zinc-700'
                            }`}
                            title={panelData?.skipped ? 'Unskip Panel' : 'Skip / Hide Panel from Narration'}
                          >
                            {panelData?.skipped ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-rose-400" />}
                          </button>
                        </div>
                      </div>

                      {/* Display Extracted Visual Incidents for this panel */}
                      {panelData?.incidents && panelData.incidents.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-amber-500/20">
                          <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                            <span className="flex items-center gap-1">
                              <Scissors className="w-3.5 h-3.5 text-amber-400" />
                              Vision AI Extracted Incidents ({panelData.incidents.length} sub-scenes):
                            </span>
                            <span className="text-zinc-500 text-[10px]">Auto-cropped & timed</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {panelData.incidents.map((inc, iIdx) => (
                              <div
                                key={iIdx}
                                className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                      {inc.incidentTitle || `Scene #${iIdx + 1}`}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 font-semibold truncate">
                                      🗣 {inc.speaker}
                                    </span>
                                  </div>
                                  {inc.characterAction && (
                                    <div className="text-[11px] text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                      <span className="font-semibold text-amber-400">⚡ क्या करता है:</span>
                                      <span>{inc.characterAction}</span>
                                    </div>
                                  )}
                                  {inc.characterSays && (
                                    <div className="text-[11px] text-rose-300/90 bg-rose-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                      <span className="font-semibold text-rose-400">💬 क्या कहता है:</span>
                                      <span>"{inc.characterSays}"</span>
                                    </div>
                                  )}
                                  <p className="text-zinc-200 text-xs mt-1 italic font-medium">
                                    "{inc.dialogueHindi}"
                                  </p>
                                </div>

                                <button
                                  onClick={() => handlePlayVoiceover(idx + 1, inc.dialogueHindi)}
                                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-amber-500 hover:text-black text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  <Volume2 className="w-3 h-3" /> Audio
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isEditingThis ? (
                        <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-zinc-400">Speaker:</label>
                            <input
                              type="text"
                              value={editSpeakerText}
                              onChange={(e) => setEditSpeakerText(e.target.value)}
                              className="bg-zinc-950 border border-zinc-700 text-xs text-white px-2 py-1 rounded focus:outline-none focus:border-amber-500 flex-1"
                              placeholder="Speaker Name"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] font-bold text-amber-400 block mb-0.5">
                                ⚡ क्या करता है (What Character Does):
                              </label>
                              <input
                                type="text"
                                value={editCharacterAction}
                                onChange={(e) => setEditCharacterAction(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-700 text-xs text-amber-200 px-2 py-1 rounded focus:outline-none focus:border-amber-500"
                                placeholder="पात्र की हरकत या एक्शन..."
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-rose-400 block mb-0.5">
                                💬 क्या कहता है (What Character Says):
                              </label>
                              <input
                                type="text"
                                value={editCharacterSays}
                                onChange={(e) => setEditCharacterSays(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-700 text-xs text-rose-200 px-2 py-1 rounded focus:outline-none focus:border-rose-500"
                                placeholder="पात्र द्वारा बोले गए शब्द..."
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-zinc-300 block mb-0.5">
                              🎙️ सूत्रधार की कहानी (Narrator Subtitle Story):
                            </label>
                            <textarea
                              value={editDialogueText}
                              onChange={(e) => setEditDialogueText(e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-950 border border-zinc-700 text-xs text-amber-100 p-2 rounded focus:outline-none focus:border-amber-500"
                              placeholder="Type or edit Hindi dialogue subtitle..."
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingPanelIdx(null)}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveSubtitle(idx + 1)}
                              disabled={isSavingSubtitle}
                              className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1 shadow"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{isSavingSubtitle ? 'Saving...' : 'Save to DB'}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-0.5">
                          {/* Narrator POV Breakdown: What Character Does & What Character Says */}
                          {(panelData?.characterAction || panelData?.characterSays) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-1">
                              {panelData.characterAction && (
                                <div className="flex items-start gap-1.5 text-xs text-amber-200/90 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                                  <span className="font-bold text-amber-400 shrink-0">⚡ क्या करता है:</span>
                                  <span className="leading-snug">{panelData.characterAction}</span>
                                </div>
                              )}
                              {panelData.characterSays && (
                                <div className="flex items-start gap-1.5 text-xs text-rose-200/90 bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/20">
                                  <span className="font-bold text-rose-400 shrink-0">💬 क्या कहता है:</span>
                                  <span className="italic leading-snug">"{panelData.characterSays}"</span>
                                </div>
                              )}
                            </div>
                          )}

                          <p className="text-xs sm:text-sm text-amber-100 font-medium leading-relaxed tracking-wide">
                            {panelData?.dialogueHindi || `अध्याय के इस दृश्य में कहानी का नया मोड़।`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* End of Chapter Action */}
            <div className="w-full py-12 text-center bg-zinc-900/40 rounded-xl border border-zinc-800/80 mt-6 p-6">
              <CheckCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <h4 className="font-semibold text-sm text-zinc-200">End of {chapter.name}</h4>
              <p className="text-xs text-zinc-400 mt-1 mb-4">Progress has been recorded.</p>
              
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  id="btn-webtoon-back-to-manga"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold shadow border border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <ArrowLeft className="w-4 h-4 text-rose-400" />
                  <span>Back to Manga Details</span>
                </button>

                {prevChapter && (
                  <button
                    id="btn-webtoon-prev-chapter"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevChapter();
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold shadow transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev: {prevChapter.name}</span>
                  </button>
                )}

                {nextChapter && (
                  <button
                    id="btn-webtoon-next-chapter"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextChapter();
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Next: {nextChapter.name}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Paged Mode (Single / LTR / RTL) */
          <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
            <div className="max-h-[75vh] max-w-full flex items-center justify-center shadow-2xl relative">
              {(pages[currentPage - 1] || pages[0]) ? (
                <img
                  src={pages[currentPage - 1] || pages[0]}
                  alt={`Page ${currentPage}`}
                  className="max-h-[75vh] max-w-full object-contain rounded"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-zinc-500 text-sm p-8">No page image available</div>
              )}
            </div>

            {/* Paged Mode Subtitle Overlay Card */}
            {showAiSubtitles && (
              <div className="w-full max-w-xl mt-3 p-3.5 rounded-xl bg-zinc-900/90 border border-amber-500/30 backdrop-blur-md text-zinc-100 shadow-xl space-y-2 z-10" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const pData = webtoonScript?.panels?.[currentPage - 1];
                  const isEditingThis = editingPanelIdx === currentPage;
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-1.5">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[11px]">
                          {pData?.speaker || `Page ${currentPage}`}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              handlePlayVoiceover(
                                currentPage,
                                pData?.dialogueHindi || `Page ${currentPage} narration`
                              )
                            }
                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-amber-500 hover:text-black text-amber-300 text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Voice</span>
                          </button>
                          <button
                            onClick={() => {
                              if (isEditingThis) setEditingPanelIdx(null);
                              else {
                                setEditingPanelIdx(currentPage);
                                setEditDialogueText(pData?.dialogueHindi || '');
                                setEditSpeakerText(pData?.speaker || 'सूत्रधार');
                                setEditCharacterAction(pData?.characterAction || '');
                                setEditCharacterSays(pData?.characterSays || '');
                              }
                            }}
                            className="p-1 rounded bg-zinc-800 text-amber-300 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isEditingThis ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editSpeakerText}
                            onChange={(e) => setEditSpeakerText(e.target.value)}
                            className="bg-zinc-950 border border-zinc-700 text-xs text-white px-2 py-1 rounded w-full"
                            placeholder="Speaker Name"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editCharacterAction}
                              onChange={(e) => setEditCharacterAction(e.target.value)}
                              className="bg-zinc-950 border border-zinc-700 text-xs text-amber-200 px-2 py-1 rounded w-full"
                              placeholder="⚡ क्या करता है (What Character Does)..."
                            />
                            <input
                              type="text"
                              value={editCharacterSays}
                              onChange={(e) => setEditCharacterSays(e.target.value)}
                              className="bg-zinc-950 border border-zinc-700 text-xs text-rose-200 px-2 py-1 rounded w-full"
                              placeholder="💬 क्या कहता है (What Character Says)..."
                            />
                          </div>
                          <textarea
                            value={editDialogueText}
                            onChange={(e) => setEditDialogueText(e.target.value)}
                            rows={2}
                            className="bg-zinc-950 border border-zinc-700 text-xs text-amber-100 p-2 rounded w-full"
                            placeholder="🎙️ सूत्रधार की कहानी (Narrator Subtitle Story)..."
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingPanelIdx(null)} className="px-2 py-1 bg-zinc-800 text-xs rounded">Cancel</button>
                            <button onClick={() => handleSaveSubtitle(currentPage)} className="px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded">Save</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(pData?.characterAction || pData?.characterSays) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pb-1">
                              {pData.characterAction && (
                                <div className="text-[11px] text-amber-200/90 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 flex items-start gap-1">
                                  <span className="font-bold text-amber-400 shrink-0">⚡ क्या करता है:</span>
                                  <span>{pData.characterAction}</span>
                                </div>
                              )}
                              {pData.characterSays && (
                                <div className="text-[11px] text-rose-200/90 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 flex items-start gap-1">
                                  <span className="font-bold text-rose-400 shrink-0">💬 क्या कहता है:</span>
                                  <span className="italic">"{pData.characterSays}"</span>
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-amber-100 font-medium leading-relaxed">
                            {pData?.dialogueHindi || `Page ${currentPage} dialogue...`}
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Click zones for paging */}
            <div
              className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize"
              onClick={(e) => {
                e.stopPropagation();
                if (readerMode === 'rtl') handleNextPage();
                else handlePrevPage();
              }}
            />
            <div
              className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize"
              onClick={(e) => {
                e.stopPropagation();
                if (readerMode === 'rtl') handlePrevPage();
                else handleNextPage();
              }}
            />
          </div>
        )}
      </div>

      {/* Hidden Audio Player for Voice Sample / TTS playback */}
      <audio ref={audioRef} className="hidden" onEnded={() => setPlayingPanelIdx(null)} />

      {/* Upload Sample Voice Modal */}
      {showVoiceUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Narrator Voice Sample Manager</h3>
              </div>
              <button
                onClick={() => setShowVoiceUploadModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
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
                <Upload className="w-3.5 h-3.5" /> 📁 Upload File
              </button>
            </div>

            {/* TAB 1: RECORD LIVE VOICE */}
            {activeVoiceTab === 'record' && (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 text-center">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">Record Narrator Voice Live</h4>
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
                      <span>Recorded Clip</span>
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
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Play Recording
                      </button>
                      <button
                        onClick={uploadRecordedAudio}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Save as Narrator Voice
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: UPLOAD AUDIO FILE */}
            {activeVoiceTab === 'upload' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Upload your own recorded narration voice sample file (`.mp3`, `.wav`, or `.m4a`). It will be saved on the server in <code className="bg-zinc-950 px-1 py-0.5 rounded text-amber-300">server/audiosample/sample_narrator.mp3</code>.
                </p>

                <div className="border-2 border-dashed border-amber-500/40 rounded-xl p-6 text-center bg-amber-950/20 hover:bg-amber-950/40 transition-colors">
                  <Upload className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-amber-200">Select Audio File</p>
                  <p className="text-[11px] text-zinc-400 mt-1">MP3, WAV, or M4A (Max 15MB)</p>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleVoiceUpload}
                    className="mt-3 block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {uploadStatus && (
              <p className="text-xs text-center font-medium text-amber-300 bg-amber-950/60 p-2 rounded-lg border border-amber-500/30">
                {uploadStatus}
              </p>
            )}

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowVoiceUploadModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Controls Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {/* Slider & Page Indicator (for paged modes) */}
          {readerMode !== 'webtoon' && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-400 font-mono w-10 text-right">{currentPage}</span>
              <input
                id="slider-reader-page"
                type="range"
                min={1}
                max={pages.length}
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCurrentPage(val);
                  saveProgress(val);
                }}
                className="flex-1 accent-rose-600 cursor-pointer"
              />
              <span className="text-xs text-zinc-400 font-mono w-10">{pages.length}</span>
            </div>
          )}

          {/* Chapter Navigation Buttons */}
          <div className="flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2">
              <button
                id="btn-reader-bottom-back"
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 transition-colors cursor-pointer"
                title="Back to Manga (Esc)"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <button
                id="btn-reader-prev-chapter"
                disabled={!prevChapter}
                onClick={handlePrevChapter}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none border border-zinc-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous Chapter</span>
              </button>
            </div>

            <span className="text-zinc-400 font-mono text-[11px] sm:text-xs text-center px-2">
              {readerMode === 'webtoon' ? `${pages.length} Pages (Webtoon)` : `Page ${currentPage} of ${pages.length}`}
            </span>

            <button
              id="btn-reader-next-chapter"
              disabled={!nextChapter}
              onClick={handleNextChapter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none border border-zinc-800 transition-colors cursor-pointer"
            >
              <span className="hidden sm:inline">Next Chapter</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* In-Reader Hand Crop & Story Dialogue Modal */}
      {showHandCropModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl text-zinc-100 flex flex-col md:flex-row max-h-[90vh]">
            {/* Left: Interactive Canvas Image Crop Preview */}
            <div className="w-full md:w-1/2 p-4 bg-zinc-950 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800 overflow-y-auto">
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Scissors className="w-4 h-4 text-amber-400" /> Page #{handCropPanelIdx} Crop Box
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Top: {handCropTopPct}% • Height: {handCropHeightPct}%
                </span>
              </div>

              {/* 9:16 Video Stage Box */}
              <div className="w-48 h-72 bg-zinc-900 rounded-xl overflow-hidden border-2 border-rose-500 relative shadow-2xl shrink-0 flex items-center justify-center">
                {handCropPageUrl ? (
                  <div
                    className="w-full relative overflow-hidden transition-all duration-300"
                    style={{
                      height: `${(100 / (handCropHeightPct || 25)) * 100}%`,
                      marginTop: `-${(handCropTopPct / (handCropHeightPct || 25)) * 100}%`,
                    }}
                  >
                    <img
                      src={handCropPageUrl}
                      alt="Crop Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">No Image</span>
                )}

                <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-md p-2 rounded-lg border border-amber-500/40 text-center">
                  <p className="text-[10px] font-bold text-amber-300 truncate">{handCropSpeaker || 'मुख्य पात्र'}</p>
                  <p className="text-xs font-serif text-white truncate">{handCropDialogue || 'संवाद यहाँ दिखेगा...'}</p>
                </div>
              </div>

              {/* Sliders for Top % & Height % */}
              <div className="w-full mt-4 space-y-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                    <span>Vertical Position (Top %):</span>
                    <strong className="text-amber-400">{handCropTopPct}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100 - handCropHeightPct}
                    value={handCropTopPct}
                    onChange={(e) => setHandCropTopPct(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                    <span>Crop Height (Height %):</span>
                    <strong className="text-rose-400">{handCropHeightPct}%</strong>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={handCropHeightPct}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setHandCropHeightPct(val);
                      if (handCropTopPct + val > 100) {
                        setHandCropTopPct(100 - val);
                      }
                    }}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                {/* Crop Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-zinc-400">Presets:</span>
                  {[
                    { label: 'Top 1/3', top: 0, h: 33 },
                    { label: 'Middle 1/3', top: 33, h: 33 },
                    { label: 'Bottom 1/3', top: 66, h: 34 },
                    { label: 'Full Page', top: 0, h: 100 },
                  ].map((preset, pI) => (
                    <button
                      key={pI}
                      onClick={() => {
                        setHandCropTopPct(preset.top);
                        setHandCropHeightPct(preset.h);
                      }}
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 border border-zinc-700 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Dialogue & Story Script Inputs */}
            <div className="w-full md:w-1/2 p-5 flex flex-col justify-between space-y-4 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-rose-400" /> Hand-Crop Story & Subtitle
                  </h3>
                  <button
                    onClick={() => setShowHandCropModal(false)}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    बोलने वाला पात्र (Speaker Name):
                  </label>
                  <input
                    type="text"
                    value={handCropSpeaker}
                    onChange={(e) => setHandCropSpeaker(e.target.value)}
                    placeholder="उदा. मुख्य नायक, सूत्रधार, विलेन..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    हिंदी कहानी / संवाद (Hindi Dialogue Subtitle):
                  </label>
                  <textarea
                    value={handCropDialogue}
                    onChange={(e) => setHandCropDialogue(e.target.value)}
                    placeholder="इस चुने हुए हिस्से का संवाद दर्ज करें (e.g. 'उसने तलवार उठाई और दुश्मन की तरफ बढ़ा...')"
                    className="w-full h-28 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 leading-relaxed"
                  />
                </div>

                {handCropStatus && (
                  <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs text-center font-medium">
                    {handCropStatus}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setShowHandCropModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSaveHandCropScene}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-xs font-bold shadow-lg shadow-rose-950/50 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Scene to Video Studio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVideoStudio && (
        <WebtoonVideoStudioModal
          manga={manga}
          chapter={chapter}
          onClose={() => setShowVideoStudio(false)}
        />
      )}
    </div>
  );
};
