import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  Mic,
  Music,
  Upload,
  Clock,
  Wand2,
  RefreshCw,
  AlertCircle,
  Film,
  Layers,
  Search,
  CheckSquare,
  Square,
  Play,
  Pause,
  Trash2,
  Volume2,
} from 'lucide-react';
import { animeLibraryService, AnimeManga, AnimeChapter } from '../services/animeLibraryService';
import { Scene, TransitionEffect, DEFAULT_SUBTITLE_STYLE, AudioClip } from '../types/video';
import { api } from '../services/api';
import { getSocket, getSocketId, subscribeToGenerationProgress } from '../services/socket';

interface AnimeLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportScenes: (
    scenes: Scene[],
    projectTitle: string,
    projectDesc: string,
    globalAudioUrl?: string
  ) => void;
  backendStatus?: any;
}

export const AnimeLibraryModal: React.FC<AnimeLibraryModalProps> = ({
  isOpen,
  onClose,
  onImportScenes,
  backendStatus,
}) => {
  // Navigation step: 1 = Library, 2 = Chapters, 3 = Panels & Audio
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Connection & Data
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [mangas, setMangas] = useState<AnimeManga[]>([]);
  const [selectedManga, setSelectedManga] = useState<AnimeManga | null>(null);
  const [chapters, setChapters] = useState<AnimeChapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<AnimeChapter | null>(null);
  const [panelPages, setPanelPages] = useState<string[]>([]);
  const [selectedPanels, setSelectedPanels] = useState<Set<number>>(new Set());
  const [storyMemory, setStoryMemory] = useState<any>(null);
  const [mangaTheme, setMangaTheme] = useState<string>('Action Anime & Story');
  const [showCharacterDrawer, setShowCharacterDrawer] = useState<boolean>(false);
  const [newCharName, setNewCharName] = useState<string>('');
  const [newCharRole, setNewCharRole] = useState<string>('Protagonist');
  const [newCharDesc, setNewCharDesc] = useState<string>('');

  // Panel customization
  const [panelDuration, setPanelDuration] = useState<number>(4);
  const [panelEffect, setPanelEffect] = useState<TransitionEffect>('kenburns');
  const [panelCaptions, setPanelCaptions] = useState<Record<number, string>>({});

  // Audio configuration
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioName, setAudioName] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Auto Voiceover configuration
  const [autoGenerateVoiceover, setAutoGenerateVoiceover] = useState<boolean>(false);
  const [ttsVoice, setTtsVoice] = useState<string>('hi-IN-MadhurNeural');
  const [sampleVoiceUrl, setSampleVoiceUrl] = useState<string>('');
  const [sampleVoiceName, setSampleVoiceName] = useState<string>('');
  const [isUploadingSampleVoice, setIsUploadingSampleVoice] = useState<boolean>(false);

  const handleSampleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingSampleVoice(true);
      const res = await api.uploadSampleAudio(file);
      setSampleVoiceUrl(res.url);
      setSampleVoiceName(res.fileName || file.name);
    } catch (err: any) {
      alert(`सैंपल ऑडियो अपलोड विफल: ${err.message}`);
    } finally {
      setIsUploadingSampleVoice(false);
    }
  };

  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatingStatusText, setGeneratingStatusText] = useState('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [streamSnippet, setStreamSnippet] = useState<string>('');
  const [cachedChapterData, setCachedChapterData] = useState<any | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState<boolean>(false);
  const [isThemeSaved, setIsThemeSaved] = useState<boolean>(false);
  const isInitialThemeMount = useRef(true);

  // Loading & Filter states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chapterSearch, setChapterSearch] = useState<string>('');

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadLibrary();
    }
  }, [isOpen]);

  // Silent background auto-save for story theme into MongoDB
  useEffect(() => {
    if (isInitialThemeMount.current) {
      isInitialThemeMount.current = false;
      return;
    }
    if (!selectedManga || !mangaTheme.trim()) return;

    const timer = setTimeout(async () => {
      try {
        const updated = await api.saveStoryMemory(selectedManga.title, {
          ...(storyMemory || {}),
          mangaTitle: selectedManga.title,
          theme: mangaTheme,
        });
        setStoryMemory(updated);
        setIsThemeSaved(true);
        setTimeout(() => setIsThemeSaved(false), 2500);
      } catch (err) {
        console.warn('[Auto-Save Theme Error]', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [mangaTheme, selectedManga]);

  // Socket.IO real-time progress listener & connection status
  useEffect(() => {
    const socket = getSocket();
    setIsSocketConnected(socket.connected);

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const unsubscribe = subscribeToGenerationProgress((progress) => {
      if (progress.message) {
        setGeneratingStatusText(progress.message);
      }
      if (typeof progress.percent === 'number') {
        setProgressPercent(progress.percent);
      }
      if (progress.streamSnippet) {
        setStreamSnippet(progress.streamSnippet);
      }
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      unsubscribe();
    };
  }, []);

  // Clean up recorded blob URL on unmount
  useEffect(() => {
    return () => {
      if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordedBlobUrl]);

  const loadLibrary = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const online = await animeLibraryService.checkConnection();
      setIsConnected(online);
      if (online) {
        const list = await animeLibraryService.getLibrary();
        setMangas(list);
      } else {
        setErrorMsg('Could not connect to Suwayomi on localhost:4567. Make sure Suwayomi is running.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load library');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectManga = async (manga: AnimeManga) => {
    setSelectedManga(manga);
    setStep(2);
    setIsLoading(true);
    setErrorMsg('');
    // Load character memory, theme & lore for this manga from MongoDB
    api.getStoryMemory(manga.title, manga.id).then((mem) => {
      setStoryMemory(mem);
      if (mem?.theme) setMangaTheme(mem.theme);
    }).catch(() => {});
    try {
      const chaps = await animeLibraryService.getChapters(manga.id);
      setChapters(chaps);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load chapters');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCharacterToDB = async () => {
    if (!selectedManga || !newCharName.trim()) return;
    try {
      const currentChars = storyMemory?.characters || [];
      const updatedChars = [
        ...currentChars,
        {
          name: newCharName.trim(),
          role: newCharRole,
          description: newCharDesc.trim() || 'Tracked character in series.',
          keyTraits: [],
          firstAppearedChapter: selectedChapter?.name || 'Chapter 1',
          lastSeenChapter: selectedChapter?.name || 'Chapter 1',
        },
      ];
      const updated = await api.saveStoryMemory(selectedManga.title, {
        ...(storyMemory || {}),
        mangaTitle: selectedManga.title,
        theme: mangaTheme,
        characters: updatedChars,
      });
      setStoryMemory(updated);
      setNewCharName('');
      setNewCharDesc('');
    } catch (err: any) {
      console.warn('Failed to auto-save character to database:', err);
    }
  };

  const handleSelectChapter = async (chapter: AnimeChapter) => {
    setSelectedChapter(chapter);
    setStep(3);
    setIsLoading(true);
    setCachedChapterData(null);
    setErrorMsg('');

    try {
      // 1. Fetch chapter pages from Suwayomi
      const pages = await animeLibraryService.getChapterPages(chapter.id);
      setPanelPages(pages);
      setSelectedPanels(new Set(pages.map((_, i) => i)));

      // 2. Check if this chapter was already analyzed & stored in MongoDB / disk cache
      try {
        setIsLoadingCache(true);
        const cacheRes = await api.getChapterCache(chapter.id, selectedManga?.id);
        if (cacheRes?.cached && cacheRes.data) {
          const cached = cacheRes.data;
          setCachedChapterData(cached);

          // Pre-fill panel captions from cached data
          if (cached.panelCaptions && Object.keys(cached.panelCaptions).length > 0) {
            const captionsMap: Record<number, string> = {};
            Object.entries(cached.panelCaptions).forEach(([k, v]) => {
              captionsMap[Number(k)] = String(v);
            });
            setPanelCaptions(captionsMap);
          } else if (cached.scenes && Array.isArray(cached.scenes)) {
            const captionsMap: Record<number, string> = {};
            cached.scenes.forEach((s: any, idx: number) => {
              captionsMap[idx] = s.narration || s.title || '';
            });
            setPanelCaptions(captionsMap);
          }
        } else {
          setPanelCaptions({});
        }
      } catch (cacheErr) {
        console.warn('Could not check chapter cache:', cacheErr);
        setPanelCaptions({});
      } finally {
        setIsLoadingCache(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load chapter panels');
    } finally {
      setIsLoading(false);
    }
  };


  const togglePanelSelection = (index: number) => {
    setSelectedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllPanels = () => {
    setSelectedPanels(new Set(panelPages.map((_, i) => i)));
  };

  const deselectAllPanels = () => {
    setSelectedPanels(new Set());
  };

  // Audio Upload handler
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const res = await api.uploadMedia(file);
      setAudioUrl(res.url);
      setAudioName(file.name);
    } catch (err: any) {
      alert(`Audio upload failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Microphone Voice Recording handler
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const localUrl = URL.createObjectURL(audioBlob);
        setRecordedBlobUrl(localUrl);

        // Upload recorded audio to server
        const audioFile = new File([audioBlob], `voiceover_${Date.now()}.webm`, { type: 'audio/webm' });
        try {
          const res = await api.uploadMedia(audioFile);
          setAudioUrl(res.url);
          setAudioName(`Voiceover Recording (${recordingSeconds}s)`);
        } catch (uploadErr) {
          console.warn('Local recording used, server upload failed:', uploadErr);
          setAudioUrl(localUrl);
          setAudioName('Local Voiceover Recording');
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert(`Microphone access error: ${err.message}`);
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

  // Auto-generate situation-aware story & subtitles with Gemini Vision + Character Memory (No AI audio)
  const handleGenerateVideoWithGemini = async () => {
    if (!selectedManga || !selectedChapter) return;
    if (selectedPanels.size === 0) {
      alert('Please select at least one panel to generate story subtitles.');
      return;
    }

    setIsGeneratingVideo(true);
    setProgressPercent(10);
    setGeneratingStatusText('1/5: तैयारी शुरू हो रही है...');
    setStreamSnippet('');
    setErrorMsg('');

    try {
      const socket = getSocket();
      const currentSocketId = socket.id || getSocketId();

      const sortedIndices = Array.from(selectedPanels).sort((a, b) => a - b);
      const panelsPayload = sortedIndices.map((idx) => ({
        pageIndex: idx,
        imageUrl: panelPages[idx],
      }));

      const result = await api.generateAnimeVideo({
        socketId: currentSocketId,
        mangaId: String(selectedManga.id),
        mangaTitle: selectedManga.title,
        chapterId: String(selectedChapter.id),
        chapterName: selectedChapter.name || `Chapter ${selectedChapter.chapterNumber}`,
        panels: panelsPayload,
        autoGenerateAudio: autoGenerateVoiceover,
        voice: ttsVoice,
        sampleAudioUrl: sampleVoiceUrl || undefined,
      });

      if (result.success && result.data?.scenes) {
        if (result.data.storyMemory) {
          setStoryMemory(result.data.storyMemory);
        }
        setCachedChapterData(result.data);
        // Subtitles are generated in Hindi with situation-aware duration
        onImportScenes(
          result.data.scenes,
          result.data.title,
          result.data.description,
          undefined
        );
        onClose();
      } else {
        throw new Error(result.error || 'Failed to auto-generate anime story subtitles.');
      }

    } catch (err: any) {
      console.error('Anime Subtitle Generation Error:', err);
      setErrorMsg(err.message || 'Subtitle generation failed.');
    } finally {
      setIsGeneratingVideo(false);
      setGeneratingStatusText('');
      setProgressPercent(0);
      setStreamSnippet('');
    }
  };

  // Load previously generated and stored chapter subtitles into video studio (Cost: 0, Instant)
  const handleLoadCachedIntoStudio = () => {
    if (!cachedChapterData || !cachedChapterData.scenes) return;

    let scenesToImport = cachedChapterData.scenes;
    if (selectedPanels.size > 0 && selectedPanels.size < cachedChapterData.scenes.length) {
      scenesToImport = cachedChapterData.scenes.filter((_: any, idx: number) => selectedPanels.has(idx));
    }

    if (cachedChapterData.storyMemory) {
      setStoryMemory(cachedChapterData.storyMemory);
    }

    const title =
      cachedChapterData.title ||
      `${selectedManga?.title || 'Anime'} - ${selectedChapter?.name || `Chapter ${selectedChapter?.chapterNumber}`}`;
    const desc =
      cachedChapterData.description || 'Saved anime story subtitles loaded from database without API calls.';

    onImportScenes(scenesToImport, title, desc, audioUrl || undefined);
    onClose();
  };

  // Import into main video studio
  const handleImportToVideo = () => {

    if (selectedPanels.size === 0) {
      alert('Please select at least one panel to import.');
      return;
    }

    const sortedIndices = Array.from(selectedPanels).sort((a, b) => a - b);
    const importedScenes: Scene[] = sortedIndices.map((panelIdx, i) => {
      const pageUrl = panelPages[panelIdx];
      const caption = panelCaptions[panelIdx] || `Panel ${panelIdx + 1}`;

      const audioClips: AudioClip[] = [];
      if (audioUrl) {
        audioClips.push({
          id: `audio_clip_${Date.now()}_${i}`,
          url: audioUrl,
          name: audioName || 'Background / Voiceover Audio',
          duration: panelDuration,
          startTime: 0,
          volume: 0.9,
          type: 'voiceover',
        });
      }

      return {
        id: `anime_scene_${Date.now()}_${i}`,
        slideNumber: i + 1,
        title: `${selectedManga?.title || 'Anime'} - P${panelIdx + 1}`,
        imageUrl: pageUrl,
        duration: panelDuration,
        effect: panelEffect,
        narration: caption,
        subtitles: [
          {
            id: `sub_${Date.now()}_${i}`,
            text: caption,
            startTime: 0.3,
            endTime: Math.max(1, panelDuration - 0.3),
            style: { ...DEFAULT_SUBTITLE_STYLE },
          },
        ],
        audioClips,
      };
    });

    const projectTitle = `${selectedManga?.title || 'Anime'} - ${selectedChapter?.name || `Chapter ${selectedChapter?.chapterNumber}`}`;
    const projectDesc = `Anime Video generated from ${importedScenes.length} chapter panels with synchronized audio.`;

    onImportScenes(importedScenes, projectTitle, projectDesc, audioUrl);
    onClose();
  };

  if (!isOpen) return null;

  // Filtered lists
  const filteredMangas = mangas.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChapters = chapters.filter((c) =>
    (c.name || `Chapter ${c.chapterNumber}`).toLowerCase().includes(chapterSearch.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1180px',
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 40px rgba(6, 182, 212, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Breadcrumb */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.7)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <BookOpen size={20} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#fff' }}>
                  Anime & Manga Studio
                </h2>
                {isConnected !== null && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: isConnected ? '#4ade80' : '#f87171',
                      border: `1px solid ${isConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isConnected ? '#4ade80' : '#f87171',
                      }}
                    />
                    {isConnected ? 'Suwayomi Connected' : 'Suwayomi Offline'}
                  </span>
                )}
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: isSocketConnected ? 'rgba(6, 182, 212, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: isSocketConnected ? '#38bdf8' : '#94a3b8',
                    border: `1px solid ${isSocketConnected ? 'rgba(6, 182, 212, 0.3)' : 'rgba(148, 163, 184, 0.3)'}`,
                  }}
                  title="Real-Time Socket.IO Updates"
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: isSocketConnected ? '#38bdf8' : '#94a3b8',
                      boxShadow: isSocketConnected ? '0 0 6px #38bdf8' : 'none',
                    }}
                  />
                  {isSocketConnected ? 'Socket.IO Live ⚡' : 'Socket.IO Connecting...'}
                </span>
              </div>

              {/* Breadcrumb Steps */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span
                  style={{
                    color: step === 1 ? 'var(--primary-cyan)' : 'inherit',
                    fontWeight: step === 1 ? 600 : 400,
                    cursor: 'pointer',
                  }}
                  onClick={() => setStep(1)}
                >
                  1. Anime Library
                </span>
                <span>/</span>
                <span
                  style={{
                    color: step === 2 ? 'var(--primary-cyan)' : 'inherit',
                    fontWeight: step === 2 ? 600 : 400,
                    cursor: selectedManga ? 'pointer' : 'default',
                  }}
                  onClick={() => selectedManga && setStep(2)}
                >
                  {selectedManga ? selectedManga.title : '2. Chapters'}
                </span>
                <span>/</span>
                <span
                  style={{
                    color: step === 3 ? 'var(--primary-cyan)' : 'inherit',
                    fontWeight: step === 3 ? 600 : 400,
                  }}
                >
                  {selectedChapter ? `3. Panels (${panelPages.length}) & Audio` : '3. Panels & Audio'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {step > 1 && (
              <button
                className="btn-secondary"
                onClick={() => setStep((prev) => (prev - 1) as any)}
                style={{ padding: '6px 14px', fontSize: '13px' }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={loadLibrary}
              title="Refresh Library"
              style={{ padding: '6px 10px' }}
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '0 8px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div
            style={{
              padding: '10px 24px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#fca5a5',
              fontSize: '13px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* STEP 1: Anime / Manga Library Catalog */}
          {step === 1 && (
            <div>
              {/* Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search
                    size={18}
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
                  />
                  <input
                    type="text"
                    placeholder="Search Anime, Manga, or Webtoon in your library..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {filteredMangas.length} {filteredMangas.length === 1 ? 'title' : 'titles'}
                </div>
              </div>

              {/* Mangas Grid */}
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                  <p>Loading your anime & manga collection from Suwayomi...</p>
                </div>
              ) : filteredMangas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                  <BookOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
                  <h3 style={{ color: '#fff', marginBottom: '8px' }}>No Anime/Manga Found</h3>
                  <p style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
                    {searchQuery
                      ? 'No titles match your search criteria.'
                      : 'Your Suwayomi library is currently empty or still syncing.'}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '20px',
                  }}
                >
                  {filteredMangas.map((manga) => (
                    <div
                      key={manga.id}
                      onClick={() => handleSelectManga(manga)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.5)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(6, 182, 212, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Cover Thumbnail */}
                      <div style={{ height: '260px', position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a' }}>
                        {manga.thumbnailUrl ? (
                          <img
                            src={manga.thumbnailUrl}
                            alt={manga.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              // Fallback on image load error
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            <BookOpen size={48} />
                          </div>
                        )}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            background: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(4px)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--primary-cyan)',
                          }}
                        >
                          {manga.chapters?.totalCount ?? '?'} Ch.
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h4
                            style={{
                              margin: '0 0 4px 0',
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#fff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={manga.title}
                          >
                            {manga.title}
                          </h4>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {manga.artist || manga.author || 'Manga / Webtoon'}
                          </p>
                        </div>
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Select Chapters →</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Chapter Selector */}
          {step === 2 && selectedManga && (
            <div>
              {/* Selected Manga Header */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                {selectedManga.thumbnailUrl && (
                  <img
                    src={selectedManga.thumbnailUrl}
                    alt={selectedManga.title}
                    style={{ width: '60px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                )}
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#fff' }}>{selectedManga.title}</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {chapters.length} chapters available in your local library. Click any chapter to inspect and import its panels.
                  </p>
                </div>
              </div>

              {/* Chapter Search Filter */}
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Filter chapters by title or number..."
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Chapters List */}
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                  <p>Loading chapter list...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredChapters.map((ch) => (
                    <div
                      key={ch.id}
                      onClick={() => handleSelectChapter(ch)}
                      style={{
                        padding: '12px 18px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: 'var(--primary-cyan)',
                          }}
                        >
                          #{ch.chapterNumber}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                            {ch.name || `Chapter ${ch.chapterNumber}`}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {ch.pageCount && ch.pageCount > 0 ? `${ch.pageCount} panels / pages` : 'Panel pages ready to load'}
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '12px' }}
                      >
                        <Layers size={14} />
                        <span>Inspect Panels</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Chapter Panels & Audio Studio */}
          {step === 3 && selectedChapter && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* CHARACTER MEMORY & AUDIENCE REMINDER BANNER */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(139, 92, 246, 0.12))',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'rgba(6, 182, 212, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Sparkles size={20} color="var(--primary-cyan)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>🧠 Story Memory & Lore: {selectedManga?.title}</span>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '99px',
                            background: 'rgba(34, 197, 94, 0.2)',
                            color: '#4ade80',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ade80' }} />
                          Stored in MongoDB
                        </span>
                        {storyMemory?.characters?.length > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '99px',
                              background: 'rgba(6, 182, 212, 0.25)',
                              color: 'var(--primary-cyan)',
                            }}
                          >
                            {storyMemory.characters.length} characters
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                        {storyMemory?.characters?.length > 0 ? (
                          <>
                            Active Lore:{' '}
                            <strong style={{ color: '#fff' }}>
                              {storyMemory.characters.slice(0, 4).map((c: any) => c.name).join(', ')}
                              {storyMemory.characters.length > 4 ? ` +${storyMemory.characters.length - 4} more` : ''}
                            </strong>
                            . Anonymous or mystery figures will trigger audience reminder hooks!
                          </>
                        ) : (
                          'Gemini Vision extracts character profiles and mysteries, persisting them in MongoDB for next chapter callbacks.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => setShowCharacterDrawer(!showCharacterDrawer)}
                      style={{ padding: '5px 12px', fontSize: '12px', borderColor: 'rgba(6, 182, 212, 0.4)', color: 'var(--primary-cyan)' }}
                    >
                      {showCharacterDrawer ? 'Hide DB Characters' : `Inspect DB Characters (${storyMemory?.characters?.length || 0})`}
                    </button>
                  </div>
                </div>

                {/* Theme Configuration Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(0,0,0,0.35)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-cyan)', whiteSpace: 'nowrap' }}>
                    🎨 Story Theme in DB:
                  </span>
                  <input
                    type="text"
                    value={mangaTheme}
                    onChange={(e) => setMangaTheme(e.target.value)}
                    placeholder="e.g. Martial Arts Cultivation, Dark Fantasy, High School Action"
                    style={{
                      flex: 1,
                      minWidth: '200px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: '#fff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <span
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      background: isThemeSaved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      color: isThemeSaved ? '#34d399' : '#94a3b8',
                      border: `1px solid ${isThemeSaved ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                    }}
                  >
                    💾 {isThemeSaved ? 'MongoDB में सुरक्षित ✅' : 'स्वतः सहेजा जाता है'}
                  </span>
                </div>

                {/* EXPANDABLE CHARACTER & LORE INSPECTOR DRAWER */}
                {showCharacterDrawer && (
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      borderRadius: '10px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>
                        Characters Stored in MongoDB ({storyMemory?.characters?.length || 0})
                      </span>
                    </div>

                    {/* Characters List */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                      {(!storyMemory?.characters || storyMemory.characters.length === 0) ? (
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                          No characters stored in DB yet. They will be auto-extracted and stored when you generate with Gemini AI.
                        </div>
                      ) : (
                        storyMemory.characters.map((c: any, cIdx: number) => (
                          <div
                            key={cIdx}
                            style={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--primary-cyan)' }}>{c.name}</strong>
                              <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.25)', color: '#c084fc', padding: '1px 6px', borderRadius: '4px' }}>
                                {c.role || 'Character'}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: 1.3 }}>
                              {c.description}
                            </p>
                            {c.secretsOrMysteries?.length > 0 && (
                              <div style={{ fontSize: '10px', color: '#fca5a5', marginTop: '2px' }}>
                                ❓ {c.secretsOrMysteries.join('; ')}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Quick Add Character Form */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="New Character Name"
                        value={newCharName}
                        onChange={(e) => setNewCharName(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: '130px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <select
                        value={newCharRole}
                        onChange={(e) => setNewCharRole(e.target.value)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                        }}
                      >
                        <option value="Protagonist">Protagonist</option>
                        <option value="Rival">Rival</option>
                        <option value="Villain">Villain</option>
                        <option value="Anonymous Masked Warrior">Anonymous Masked Warrior</option>
                        <option value="Mysterious Figure">Mysterious Figure</option>
                        <option value="Ally">Ally</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Description / Role / Secrets"
                        value={newCharDesc}
                        onChange={(e) => setNewCharDesc(e.target.value)}
                        style={{
                          flex: 2,
                          minWidth: '160px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <button
                        className="btn-primary"
                        onClick={handleAddCharacterToDB}
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                      >
                        + Add to DB
                      </button>
                    </div>
                  </div>
                )}
              </div>


              {/* Controls Toolbar */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-secondary"
                    onClick={selectAllPanels}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    <CheckSquare size={14} />
                    <span>Select All ({panelPages.length})</span>
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={deselectAllPanels}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    <Square size={14} />
                    <span>Deselect All</span>
                  </button>

                  <div style={{ height: '20px', width: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }} />

                  {/* Per-panel duration */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Clock size={14} />
                    <span>Duration:</span>
                    <select
                      value={panelDuration}
                      onChange={(e) => setPanelDuration(Number(e.target.value))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '4px 8px',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    >
                      <option value={2}>2s per panel</option>
                      <option value={3}>3s per panel</option>
                      <option value={4}>4s per panel (Recommended)</option>
                      <option value={5}>5s per panel</option>
                      <option value={6}>6s per panel</option>
                    </select>
                  </div>

                  {/* Transition effect */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Film size={14} />
                    <span>Effect:</span>
                    <select
                      value={panelEffect}
                      onChange={(e) => setPanelEffect(e.target.value as TransitionEffect)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '4px 8px',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    >
                      <option value="kenburns">Ken Burns Dynamic</option>
                      <option value="zoom-in">Zoom In</option>
                      <option value="zoom-out">Zoom Out</option>
                      <option value="pan-left">Pan Left</option>
                      <option value="pan-right">Pan Right</option>
                      <option value="fade">Smooth Fade</option>
                      <option value="crossfade">Crossfade</option>
                    </select>
                  </div>
                </div>

                {/* AI Generate Button */}
                <button
                  className="btn-secondary"
                  onClick={handleGenerateVideoWithGemini}
                  disabled={isGeneratingVideo}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.2))',
                    borderColor: 'rgba(139, 92, 246, 0.4)',
                  }}
                >
                  <Sparkles size={15} color="var(--primary-cyan)" />
                  <span>
                    {isGeneratingVideo
                      ? 'Generating Subtitles...'
                      : cachedChapterData
                      ? `🔄 Re-generate (${backendStatus?.aiProvider === 'ollama' ? 'Ollama AI' : 'Gemini AI'})`
                      : backendStatus?.aiProvider === 'ollama'
                      ? '🦙 Generate Subtitles & Story (Ollama AI)'
                      : '⚡ Generate Subtitles & Story (Gemini AI)'}
                  </span>
                </button>
              </div>

              {/* Cached Chapter Data Banner (Gemini API Cost Saved!) */}
              {cachedChapterData && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.12))',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.12)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)',
                        color: '#fff',
                      }}
                    >
                      <CheckCircle size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                          इस अध्याय का डेटा पहले से सुरक्षित है!
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.25)',
                            color: '#34d399',
                            fontWeight: 600,
                          }}
                        >
                          Gemini API लागत बची ✅
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {cachedChapterData.scenes?.length || 0} पैनल्स के सबटाइटल और स्थिति-अनुसार समय डेटाबेस से पहले ही भर दिए गए हैं।
                      </span>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleLoadCachedIntoStudio}
                    style={{
                      padding: '8px 20px',
                      fontSize: '13px',
                      background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                      boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    <Sparkles size={15} />
                    <span>⚡ सीधे स्टूडियो में लोड करें (0s इंतज़ार)</span>
                  </button>
                </div>
              )}

              {/* AUDIO STUDIO SECTION (Voice Recording + Audio Track) */}

              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(6, 182, 212, 0.08))',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music size={18} color="var(--primary-cyan)" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                      Audio & Voice Narration for Video
                    </h4>
                  </div>
                  {audioUrl && (
                    <span style={{ fontSize: '12px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={14} />
                      Audio Track Attached ({audioName})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {/* Microphone Voice Recorder */}
                  {!isRecording ? (
                    <button
                      className="btn-secondary"
                      onClick={startRecording}
                      style={{ padding: '8px 16px', fontSize: '12px', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                    >
                      <Mic size={15} color="#f87171" />
                      <span>Record Voice Narration</span>
                    </button>
                  ) : (
                    <button
                      className="btn-secondary"
                      onClick={stopRecording}
                      style={{
                        padding: '8px 16px',
                        fontSize: '12px',
                        background: 'rgba(239, 68, 68, 0.25)',
                        borderColor: '#ef4444',
                        color: '#fca5a5',
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          display: 'inline-block',
                          animation: 'pulse 1s infinite',
                        }}
                      />
                      <span>Stop Recording ({recordingSeconds}s)</span>
                    </button>
                  )}

                  {/* Audio File Upload */}
                  <label
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Upload size={14} />
                    <span>Upload Music / Voice Clip</span>
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: 'none' }}
                      onChange={handleAudioUpload}
                    />
                  </label>

                  {/* Audio Player Preview */}
                  {audioUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                      <audio controls src={audioUrl} style={{ height: '32px' }} />
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setAudioUrl('');
                          setAudioName('');
                          setRecordedBlobUrl('');
                        }}
                        style={{ padding: '6px 8px', color: '#f87171' }}
                        title="Remove Audio"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* AUTO VOICEOVER (TEXT-TO-SPEECH) SECTION - OPTIONAL */}
              <div
                style={{
                  background: autoGenerateVoiceover
                    ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.15))'
                    : 'rgba(15, 23, 42, 0.55)',
                  border: autoGenerateVoiceover
                    ? '1px solid rgba(6, 182, 212, 0.45)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'all 0.25s ease',
                  boxShadow: autoGenerateVoiceover ? '0 0 24px rgba(6, 182, 212, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: autoGenerateVoiceover ? 'var(--grad-cyan-violet)' : 'rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        boxShadow: autoGenerateVoiceover ? '0 0 14px rgba(6, 182, 212, 0.5)' : 'none',
                      }}
                    >
                      <Mic size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                          🎙️ ऑटो वॉइसओवर (Auto-Generate Voiceover)
                        </h4>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: autoGenerateVoiceover ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                            color: autoGenerateVoiceover ? '#4ade80' : '#94a3b8',
                            border: `1px solid ${autoGenerateVoiceover ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                            fontWeight: 600,
                          }}
                        >
                          {autoGenerateVoiceover ? 'सक्रिय (ON) ✨' : 'वैकल्पिक (OFF)'}
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Gemini द्वारा सबटाइटल तैयार होते ही हर सीन की आवाज़ न्यूरल TTS या आपकी सैंपल आवाज़ से स्वतः जुड़ जाएगी।
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: autoGenerateVoiceover ? 'var(--primary-cyan)' : 'var(--text-secondary)' }}>
                      {autoGenerateVoiceover ? 'वॉइसओवर चालू' : 'वॉइसओवर जोड़ें'}
                    </span>
                    <input
                      type="checkbox"
                      checked={autoGenerateVoiceover}
                      onChange={(e) => setAutoGenerateVoiceover(e.target.checked)}
                      style={{
                        width: '20px',
                        height: '20px',
                        accentColor: 'var(--primary-cyan)',
                        cursor: 'pointer',
                      }}
                    />
                  </label>
                </div>

                {/* Expanded Voice Selection & Sample Audio Settings when ON */}
                {autoGenerateVoiceover && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      {/* Voice Model Dropdown */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '260px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          आवाज़ मॉडल चुनें:
                        </span>
                        <select
                          value={ttsVoice}
                          onChange={(e) => setTtsVoice(e.target.value)}
                          style={{
                            flex: 1,
                            background: 'rgba(0, 0, 0, 0.45)',
                            border: '1px solid rgba(6, 182, 212, 0.35)',
                            borderRadius: '8px',
                            color: '#fff',
                            padding: '8px 12px',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        >
                          <optgroup label="सर्वश्रेष्ठ हिंदी न्यूरल आवाज़ें (Microsoft Edge Neural - 100% Free)">
                            <option value="hi-IN-MadhurNeural">🎙️ Madhur (मधुर - हिंदी पुरुष कथावाचक, एनीमे नरेटर)</option>
                            <option value="hi-IN-SwaraNeural">🎙️ Swara (स्वरा - हिंदी महिला, मधुर व स्पष्ट)</option>
                          </optgroup>
                          <optgroup label="English Anime Voices (Neural)">
                            <option value="en-US-ChristopherNeural">Christopher (Deep Anime Storyteller)</option>
                            <option value="en-US-GuyNeural">Guy (Action Shonen Hero)</option>
                            <option value="en-US-JennyNeural">Jenny (Expressive Female Heroine)</option>
                            <option value="en-US-AriaNeural">Aria (Cinematic Narration)</option>
                          </optgroup>
                          <optgroup label="Japanese Anime Voices (Neural)">
                            <option value="ja-JP-KeitaNeural">Keita (けいた - Japanese Male Anime)</option>
                            <option value="ja-JP-NanamiNeural">Nanami (ななみ - Japanese Female Anime)</option>
                          </optgroup>
                          <optgroup label="Voice Cloning (मेरी सैंपल आवाज़)">
                            <option value="sample-clone">✨ मेरी सैंपल आवाज़ (Voice Cloning - ElevenLabs)</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* Sample Audio Upload for Cloning */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label
                          className="btn-secondary"
                          style={{
                            padding: '8px 14px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            borderColor: sampleVoiceUrl ? 'rgba(34, 197, 94, 0.5)' : 'rgba(6, 182, 212, 0.3)',
                            background: sampleVoiceUrl ? 'rgba(34, 197, 94, 0.15)' : undefined,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Upload size={14} color={sampleVoiceUrl ? '#4ade80' : 'var(--primary-cyan)'} />
                          <span>{isUploadingSampleVoice ? 'अपलोड हो रहा है...' : sampleVoiceName ? `सैंपल: ${sampleVoiceName.slice(0, 16)}...` : 'अपनी सैंपल आवाज़ अपलोड करें (.mp3)'}</span>
                          <input
                            type="file"
                            accept="audio/*"
                            style={{ display: 'none' }}
                            onChange={handleSampleVoiceUpload}
                            disabled={isUploadingSampleVoice}
                          />
                        </label>

                        {sampleVoiceUrl && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <audio controls src={sampleVoiceUrl} style={{ height: '30px', width: '130px' }} />
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                setSampleVoiceUrl('');
                                setSampleVoiceName('');
                              }}
                              style={{ padding: '6px 8px', color: '#f87171' }}
                              title="हटाएं"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Helpful Automatic Pacing Notification */}
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Sparkles size={13} color="var(--primary-cyan)" />
                      <span>
                        <strong>सटीक टाइमिंग:</strong> आवाज़ की लंबाई के अनुसार हर सीन की अवधि (Duration) अपने आप सेट होगी ताकि कोई भी डायलॉग कभी बीच में न कटे।
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Panels Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                {panelPages.map((pageUrl, idx) => {
                  const isSelected = selectedPanels.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => togglePanelSelection(idx)}
                      style={{
                        background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: `2px solid ${isSelected ? 'var(--primary-cyan)' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Selection Checkbox Badge */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          zIndex: 2,
                          background: isSelected ? 'var(--primary-cyan)' : 'rgba(0, 0, 0, 0.7)',
                          color: isSelected ? '#000' : '#fff',
                          borderRadius: '6px',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected ? <CheckCircle size={16} /> : <Square size={16} />}
                      </div>

                      {/* Panel Number Badge & Situation-Aware Duration Badge */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          zIndex: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {cachedChapterData?.scenes?.[idx]?.duration && (
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.9)',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
                            }}
                            title={`स्थिति के अनुसार सटीक अवधि: ${cachedChapterData.scenes[idx].duration}s`}
                          >
                            ⏱️ {cachedChapterData.scenes[idx].duration}s
                          </span>
                        )}
                        <span
                          style={{
                            background: 'rgba(0, 0, 0, 0.8)',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          Panel {idx + 1}
                        </span>
                      </div>


                      {/* Panel Image */}
                      <div style={{ height: '240px', backgroundColor: '#0f172a', position: 'relative' }}>
                        <img
                          src={pageUrl}
                          alt={`Panel ${idx + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            opacity: isSelected ? 1 : 0.45,
                            transition: 'opacity 0.2s ease',
                          }}
                        />
                      </div>

                      {/* Panel Caption / Narration Input */}
                      <div
                        style={{ padding: '10px 12px', background: 'rgba(15, 23, 42, 0.8)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          Narration Subtitle:
                        </label>
                        <input
                          type="text"
                          value={panelCaptions[idx] || ''}
                          onChange={(e) =>
                            setPanelCaptions((prev) => ({ ...prev, [idx]: e.target.value }))
                          }
                          placeholder="Auto-extracted by Gemini AI on Generate (Editable after)"
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '11px',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        {step === 3 && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(15, 23, 42, 0.85)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span style={{ color: '#fff', fontWeight: 600 }}>{selectedPanels.size} panels</span> selected
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12px' }}>
                <Sparkles size={14} />
                <span>AI Subtitle & Memory Analysis</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn-secondary"
                onClick={onClose}
                disabled={isGeneratingVideo}
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>

              <button
                className="btn-secondary"
                onClick={handleImportToVideo}
                disabled={selectedPanels.size === 0 || isGeneratingVideo}
                style={{ padding: '10px 16px', fontSize: '13px' }}
                title="Directly import panels without AI narration"
              >
                Direct Import
              </button>

              {cachedChapterData ? (
                <>
                  <button
                    className="btn-secondary"
                    onClick={handleGenerateVideoWithGemini}
                    disabled={selectedPanels.size === 0 || isGeneratingVideo}
                    style={{ padding: '10px 16px', fontSize: '13px' }}
                    title="Gemini AI से फिर से नया जनरेट करें"
                  >
                    <RefreshCw size={14} />
                    <span>🔄 Re-generate (Gemini AI)</span>
                  </button>

                  <button
                    className="btn-primary"
                    onClick={handleLoadCachedIntoStudio}
                    disabled={selectedPanels.size === 0 || isGeneratingVideo}
                    style={{
                      padding: '10px 24px',
                      fontSize: '14px',
                      background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    <CheckCircle size={16} />
                    <span>⚡ लोड करें सुरक्षित सबटाइटल (लागत बची ✅)</span>
                  </button>
                </>
              ) : (
                <button
                  className="btn-primary"
                  onClick={handleGenerateVideoWithGemini}
                  disabled={selectedPanels.size === 0 || isGeneratingVideo}
                  style={{
                    padding: '10px 24px',
                    fontSize: '14px',
                    background: 'var(--grad-cyan-violet)',
                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                  }}
                >
                  {isGeneratingVideo ? (
                    <>
                      <Sparkles size={16} className="animate-spin" />
                      <span>Analyzing Panels, Recalling Characters & Writing Subtitles...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>⚡ Generate Subtitles & Story (Gemini AI)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}


        {/* Loading Overlay during Gemini Vision & Subtitle Generation */}
        {isGeneratingVideo && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10, 15, 29, 0.94)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              gap: '18px',
              padding: '24px',
            }}
          >
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '18px',
                background: 'var(--grad-cyan-violet)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 35px rgba(6, 182, 212, 0.6)',
              }}
            >
              <Sparkles size={34} color="#fff" />
            </div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>
              Gemini AI: हिंदी कहानी और सबटाइटल तैयार हो रहे हैं
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--primary-cyan)', maxWidth: '480px', textAlign: 'center', lineHeight: 1.6, fontWeight: 500 }}>
              {generatingStatusText || 'पैनल्स का विश्लेषण और किरदारों की याददाश्त लोड हो रही है...'}
            </p>
            <div style={{ width: '340px', height: '8px', background: 'rgba(255,255,255,0.12)', borderRadius: '99px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent || 15}%`,
                  height: '100%',
                  background: 'var(--grad-cyan-violet)',
                  transition: 'width 0.4s ease',
                  boxShadow: '0 0 14px rgba(6, 182, 212, 0.8)',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#10b981', fontWeight: 600 }}>
              <Sparkles size={14} />
              <span>{progressPercent || 10}% पूर्ण (Socket.IO लाइव अपडेट)</span>
            </div>

            {/* Real-Time Gemini AI Response Stream Console */}
            {streamSnippet && (
              <div
                style={{
                  width: '100%',
                  maxWidth: '520px',
                  background: 'rgba(2, 6, 23, 0.85)',
                  border: '1px solid rgba(6, 182, 212, 0.45)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 0 24px rgba(6, 182, 212, 0.2)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                    Gemini 3.6 AI लाइव रिस्पॉन्स (Real-Time Stream)
                  </span>
                  <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600 }}>
                    अनलिमिटेड टाइमआउट ♾️
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#e2e8f0',
                    lineHeight: 1.5,
                    maxHeight: '65px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {streamSnippet}
                  <span className="animate-pulse" style={{ color: '#06b6d4', fontWeight: 900 }}> ▋</span>
                </div>
              </div>
            )}

            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              सबटाइटल तैयार होते ही आप स्टूडियो में अपनी आवाज़ में डायलॉग्स रिकॉर्ड कर सकेंगे!
            </span>

          </div>
        )}
      </div>
    </div>
  );
};
