'use client';

import React, { useEffect, useState, use, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import {
  Film,
  Play,
  Pause,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  ArrowLeft,
  Loader2,
  Volume2,
  Mic,
  CheckSquare,
  Square,
  Clock,
  Layers,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  RotateCcw,
  ScanText,
  Sliders,
  Wand2,
  SkipForward,
  SkipBack,
  RefreshCw,
  BookOpen,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function VideoStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chapterId = resolvedParams.id;

  const [chapter, setChapter] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeScene, setActiveScene] = useState<any>(null);

  // Checkbox Selection States
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [batchAdding, setBatchAdding] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Status & Audio States
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSaved, setLastSaved] = useState<string>('Just now');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // OCR Extraction States
  const [extractingOcr, setExtractingOcr] = useState(false);
  const [ocrSuccessMessage, setOcrSuccessMessage] = useState('');

  // Live Video Rendering & Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 100%
  const [viewMode, setViewMode] = useState<'fit' | 'cinema'>('fit');
  const [zoomScale, setZoomScale] = useState(1);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadStudioData() {
      try {
        const [chapRes, pagesRes, scenesRes] = await Promise.all([
          fetch(`/api/chapters/${chapterId}`),
          fetch(`/api/chapters/${chapterId}/pages`),
          fetch(`/api/scenes?chapterId=${chapterId}`),
        ]);
        const cData = await chapRes.json();
        const pData = await pagesRes.json();
        const sData = await scenesRes.json();

        if (cData.success) setChapter(cData.data);
        if (pData.success) setPages(pData.data);
        if (sData.success) {
          // Clean out legacy "Narration for Page..." placeholders from previous versions
          const cleanedScenes = sData.data.map((s: any) => ({
            ...s,
            narration: s.narration?.startsWith('Narration for Page') ? '' : (s.narration || ''),
            effects: s.effects || 'ken-burns',
            visualEffect: s.visualEffect || 'none',
          }));
          setScenes(cleanedScenes);
          if (cleanedScenes.length > 0) setActiveScene(cleanedScenes[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadStudioData();
  }, [chapterId]);

  // Live Video Playback Loop & Effect Synchronization
  useEffect(() => {
    if (!isPlaying || !activeScene) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      setPlaybackProgress(0);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      return;
    }

    // Trigger visual flash if set
    if (activeScene.visualEffect === 'flash') {
      setFlashKey((prev) => prev + 1);
    }

    // Play attached scene audio in sync
    if (activeScene.audio?.cloudinaryUrl) {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio(activeScene.audio.cloudinaryUrl);
      } else {
        audioPlayerRef.current.src = activeScene.audio.cloudinaryUrl;
      }
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.play().catch(() => {});
    } else if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const durationSeconds = Math.max(1, activeScene.duration || 5);
    const durationMs = durationSeconds * 1000;
    const intervalMs = 50;
    let elapsedMs = 0;

    playbackTimerRef.current = setInterval(() => {
      elapsedMs += intervalMs;
      const pct = Math.min(100, (elapsedMs / durationMs) * 100);
      setPlaybackProgress(pct);

      if (elapsedMs >= durationMs) {
        // Advance to next scene
        const currentIndex = scenes.findIndex((s) => s._id === activeScene._id);
        if (currentIndex !== -1 && currentIndex < scenes.length - 1) {
          setActiveScene(scenes[currentIndex + 1]);
        } else {
          // Reached end of sequence
          setIsPlaying(false);
          setPlaybackProgress(0);
        }
      }
    }, intervalMs);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, activeScene, scenes]);

  // Toggle Video Play / Pause
  const handleTogglePlay = () => {
    if (scenes.length === 0) return;
    if (!activeScene) setActiveScene(scenes[0]);
    setIsPlaying((prev) => !prev);
  };

  const handleNextScene = () => {
    if (!activeScene) return;
    const idx = scenes.findIndex((s) => s._id === activeScene._id);
    if (idx < scenes.length - 1) {
      setActiveScene(scenes[idx + 1]);
      setPlaybackProgress(0);
    }
  };

  const handlePrevScene = () => {
    if (!activeScene) return;
    const idx = scenes.findIndex((s) => s._id === activeScene._id);
    if (idx > 0) {
      setActiveScene(scenes[idx - 1]);
      setPlaybackProgress(0);
    }
  };

  // Refresh pages + scenes after OCR completes
  const refreshOcrResults = async () => {
    const pRes = await fetch(`/api/chapters/${chapterId}/pages`);
    const pData = await pRes.json();
    if (pData.success) setPages(pData.data);

    const sRes = await fetch(`/api/scenes?chapterId=${chapterId}`);
    const sData = await sRes.json();
    if (sData.success) {
      const cleaned = sData.data.map((s: any) => ({
        ...s,
        narration: s.narration?.startsWith('Narration for Page') ? '' : (s.narration || ''),
        effects: s.effects || 'ken-burns',
        visualEffect: s.visualEffect || 'none',
      }));
      setScenes(cleaned);
      if (activeScene) {
        const updatedActive = cleaned.find((s: any) => s._id === activeScene._id);
        if (updatedActive) setActiveScene(updatedActive);
      }
    }
  };

  // OCR Text Extraction for All Pages — queued via RabbitMQ, polled until done
  const handleExtractAllOcr = async () => {
    setExtractingOcr(true);
    setOcrSuccessMessage('');
    try {
      const res = await fetch(`/api/chapters/${chapterId}/extract-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'OCR extraction failed');
        setExtractingOcr(false);
        return;
      }

      if (data.queued && data.jobId) {
        // Background job — poll its status until finished
        const jobId = data.jobId;
        const poll = async (): Promise<void> => {
          try {
            const jRes = await fetch(`/api/ocr-jobs?chapterId=${chapterId}`);
            const jData = await jRes.json();
            const job = jData.success ? jData.data.find((j: any) => j.jobId === jobId) : null;
            if (job) {
              setOcrSuccessMessage(`OCR running: ${job.donePages}/${job.totalPages || '?'} pages…`);
            }
            if (job && (job.status === 'done' || job.status === 'failed')) {
              await refreshOcrResults();
              setOcrSuccessMessage(
                job.status === 'done'
                  ? `OCR extracted text for ${job.donePages} pages!`
                  : `OCR failed for ${job.failedOrders?.length || 0} page(s) — retry from dashboard.`
              );
              setTimeout(() => setOcrSuccessMessage(''), 4500);
              setExtractingOcr(false);
              return;
            }
          } catch {}
          setTimeout(poll, 2000);
        };
        setTimeout(poll, 1500);
        return; // keep spinner until job finishes
      }

      // Synchronous fallback (RabbitMQ unavailable)
      await refreshOcrResults();
      setOcrSuccessMessage(`OCR extracted text for ${data.done ?? data.data?.length ?? 0} pages!`);
      setTimeout(() => setOcrSuccessMessage(''), 4500);
      setExtractingOcr(false);
    } catch (err) {
      console.error(err);
      alert('OCR extraction request failed');
      setExtractingOcr(false);
    }
  };

  // Single page scene creation (uses extracted OCR text if available, otherwise empty)
  const handleCreateSceneFromPage = async (page: any) => {
    try {
      const newOrder = scenes.length + 1;
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          pageId: page._id,
          order: newOrder,
          title: `Scene ${newOrder}`,
          narration: page.extractedText || '',
          dialogue: '',
          duration: 5,
          image: page.editedUrl || page.originalUrl,
          effects: 'ken-burns',
          visualEffect: 'none',
          zoom: 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const updatedScenes = [...scenes, data.data];
        setScenes(updatedScenes);
        setActiveScene(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Page Selection Checkbox
  const togglePageSelection = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  // Select all / Deselect all pages
  const toggleSelectAllPages = () => {
    if (selectedPageIds.length === pages.length) {
      setSelectedPageIds([]);
    } else {
      setSelectedPageIds(pages.map((p) => p._id));
    }
  };

  // Batch Add Selected Pages as Scenes (with extracted OCR text as default narration)
  const handleAddSelectedPagesAsScenes = async () => {
    if (selectedPageIds.length === 0) return;
    setBatchAdding(true);
    try {
      const selectedPagesList = pages.filter((p) => selectedPageIds.includes(p._id));
      const newlyCreated: any[] = [];

      for (let i = 0; i < selectedPagesList.length; i++) {
        const page = selectedPagesList[i];
        const newOrder = scenes.length + newlyCreated.length + 1;
        const res = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId,
            pageId: page._id,
            order: newOrder,
            title: `Scene ${newOrder} (P${page.order})`,
            narration: page.extractedText || '',
            dialogue: '',
            duration: 5,
            image: page.editedUrl || page.originalUrl,
            effects: 'ken-burns',
            visualEffect: 'none',
            zoom: 1,
          }),
        });
        const data = await res.json();
        if (data.success) {
          newlyCreated.push(data.data);
        }
      }

      const updated = [...scenes, ...newlyCreated];
      setScenes(updated);
      if (!activeScene && newlyCreated.length > 0) {
        setActiveScene(newlyCreated[0]);
      }
      setSelectedPageIds([]);
    } catch (err) {
      console.error(err);
      alert('Error adding selected scenes');
    } finally {
      setBatchAdding(false);
    }
  };

  // Toggle Scene Selection Checkbox
  const toggleSceneSelection = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSceneIds((prev) =>
      prev.includes(sceneId) ? prev.filter((id) => id !== sceneId) : [...prev, sceneId]
    );
  };

  // Batch Delete Selected Scenes
  const handleBatchDeleteScenes = async () => {
    if (selectedSceneIds.length === 0) return;
    if (!confirm(`Delete ${selectedSceneIds.length} selected scenes?`)) return;

    setBatchDeleting(true);
    try {
      await Promise.all(
        selectedSceneIds.map((id) => fetch(`/api/scenes/${id}`, { method: 'DELETE' }))
      );

      const remaining = scenes.filter((s) => !selectedSceneIds.includes(s._id));
      setScenes(remaining);
      if (activeScene && selectedSceneIds.includes(activeScene._id)) {
        setActiveScene(remaining[0] || null);
      }
      setSelectedSceneIds([]);
    } catch (e) {
      console.error(e);
      alert('Failed to delete some scenes');
    } finally {
      setBatchDeleting(false);
    }
  };

  // Batch Set Duration for Selected Scenes
  const handleBatchSetDuration = async (seconds: number) => {
    if (selectedSceneIds.length === 0) return;
    try {
      await Promise.all(
        selectedSceneIds.map((id) =>
          fetch(`/api/scenes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration: seconds }),
          })
        )
      );

      setScenes((prev) =>
        prev.map((s) => (selectedSceneIds.includes(s._id) ? { ...s, duration: seconds } : s))
      );
      if (activeScene && selectedSceneIds.includes(activeScene._id)) {
        setActiveScene((prev: any) => ({ ...prev, duration: seconds }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateActiveScene = async (field: string, value: any) => {
    if (!activeScene) return;
    setSaveStatus('saving');
    const updated = { ...activeScene, [field]: value };
    setActiveScene(updated);
    setScenes((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));

    try {
      await fetch(`/api/scenes/${updated._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      setSaveStatus('saved');
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setSaveStatus('unsaved');
    }
  };

  // Audio Recording & Upload
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `voiceover_${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadAudioFile(file);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const uploadAudioFile = async (file: File) => {
    if (!activeScene) return;
    setUploadingAudio(true);
    try {
      const formData = new FormData();
      formData.append('audioFile', file);

      const res = await fetch(`/api/scenes/${activeScene._id}/audio`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setActiveScene(data.data);
        setScenes((prev) => prev.map((s) => (s._id === data.data._id ? data.data : s)));
      }
    } catch (e) {
      console.error(e);
      alert('Audio upload failed');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAudioFile(file);
    }
  };

  // Helper to compute CSS transform for Live Effects during playback
  const getLiveTransformStyle = () => {
    if (!activeScene) return {};
    const effect = activeScene.effects || 'ken-burns';
    const progressFactor = playbackProgress / 100;

    let baseScale = zoomScale;
    let transform = `scale(${baseScale})`;

    if (isPlaying) {
      if (effect === 'ken-burns') {
        const zoomDelta = 0.18 * progressFactor;
        const xPan = -3 * progressFactor;
        const yPan = -2.5 * progressFactor;
        transform = `scale(${baseScale * (1 + zoomDelta)}) translate(${xPan}%, ${yPan}%)`;
      } else if (effect === 'vertical-pan') {
        const yScroll = -28 * progressFactor;
        transform = `scale(${baseScale * 1.05}) translateY(${yScroll}%)`;
      } else if (effect === 'zoom-in') {
        const zoomDelta = 0.25 * progressFactor;
        transform = `scale(${baseScale * (1 + zoomDelta)})`;
      }
    }

    return {
      transform,
      transition: isPlaying && (effect === 'ken-burns' || effect === 'vertical-pan' || effect === 'zoom-in')
        ? 'transform 0.05s linear'
        : 'transform 0.3s ease-out',
    };
  };

  // Active scene's visual effect overlay class
  const getVisualEffectClass = () => {
    if (!activeScene) return '';
    const effect = activeScene.effects;
    if (isPlaying && effect === 'shake') return 'animate-camera-shake';
    if (isPlaying && effect === 'pulse') return 'animate-camera-pulse';
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  const activeIndex = scenes.findIndex((s) => s._id === activeScene?._id);
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 5), 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col select-none">
      <Navbar />

      {/* Top Studio Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <Link
            href={chapter?.seriesId ? `/series/${chapter.seriesId}` : '/'}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white flex items-center space-x-2">
                <Film className="w-4 h-4 text-purple-400" />
                <span>Webtoon Video Studio & Scene Animator</span>
              </h1>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                Ch. {chapter?.chapterNumber}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {chapter?.title} • {scenes.length} Scenes • {totalDuration}s Total Video Duration
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href={`/chapters/${chapterId}/editor`}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-neutral-700"
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Panel Editor</span>
          </Link>

          <div className="flex items-center space-x-2 text-xs text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
            {saveStatus === 'saving' && (
              <span className="text-amber-400 flex items-center space-x-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </span>
            )}
            {saveStatus === 'saved' && <span className="text-emerald-400">Saved ✓ ({lastSaved})</span>}
            {saveStatus === 'unsaved' && <span className="text-neutral-400">Unsaved changes</span>}
          </div>
        </div>
      </header>

      {/* Main Studio Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-120px)] overflow-hidden">
        
        {/* Left Drawer: Scenes Sequence & Pages (3 Cols) */}
        <div className="lg:col-span-3 bg-neutral-900 border-r border-neutral-800 p-4 flex flex-col overflow-y-auto space-y-6">
          
          {/* Scenes Sequence Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Scenes Sequence ({scenes.length})</span>
              </h3>
              {scenes.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedSceneIds.length === scenes.length) setSelectedSceneIds([]);
                    else setSelectedSceneIds(scenes.map((s) => s._id));
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  {selectedSceneIds.length === scenes.length ? 'Clear' : 'Select All'}
                </button>
              )}
            </div>

            {/* Batch Scene Action Bar */}
            {selectedSceneIds.length > 0 && (
              <div className="mb-3 p-2.5 bg-indigo-950/60 border border-indigo-800/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-indigo-200">
                  <span className="font-semibold">{selectedSceneIds.length} scenes selected</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleBatchSetDuration(3)}
                      className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-[10px] rounded text-neutral-300"
                    >
                      3s
                    </button>
                    <button
                      onClick={() => handleBatchSetDuration(5)}
                      className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-[10px] rounded text-neutral-300"
                    >
                      5s
                    </button>
                    <button
                      onClick={() => handleBatchSetDuration(10)}
                      className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-[10px] rounded text-neutral-300"
                    >
                      10s
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleBatchDeleteScenes}
                  disabled={batchDeleting}
                  className="w-full bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition-all"
                >
                  {batchDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete Selected ({selectedSceneIds.length})</span>
                </button>
              </div>
            )}

            {scenes.length === 0 ? (
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center text-xs text-neutral-500">
                No scenes added yet. Select pages below to add them to your video sequence.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {scenes.map((scene, idx) => {
                  const isChecked = selectedSceneIds.includes(scene._id);
                  const isCurrent = activeScene?._id === scene._id;
                  return (
                    <div
                      key={scene._id}
                      onClick={() => {
                        setActiveScene(scene);
                        setPlaybackProgress(0);
                      }}
                      className={`p-2.5 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all ${
                        isCurrent
                          ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/40'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <button
                        onClick={(e) => toggleSceneSelection(scene._id, e)}
                        className="text-neutral-400 hover:text-indigo-400 p-0.5"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-500" />
                        )}
                      </button>

                      <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 border border-neutral-800">
                        <img
                          src={scene.image}
                          alt={scene.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold truncate">{scene.title}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{scene.duration || 5}s</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                          {scene.narration ? scene.narration : <span className="italic text-neutral-600">No narration</span>}
                        </p>
                        <div className="flex items-center space-x-1.5 mt-1 text-[9px] text-indigo-400">
                          <span className="bg-indigo-950 px-1.5 py-0.5 rounded uppercase font-semibold">
                            {scene.effects || 'ken-burns'}
                          </span>
                          {scene.visualEffect && scene.visualEffect !== 'none' && (
                            <span className="bg-purple-950 px-1.5 py-0.5 rounded text-purple-300">
                              {scene.visualEffect}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Scene from Pages Section */}
          <div className="border-t border-neutral-800 pt-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Suwayomi Pages ({pages.length})
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleSelectAllPages}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  {selectedPageIds.length === pages.length ? 'Clear' : 'Select All'}
                </button>
              </div>
            </div>

            {/* OCR Extract All Button */}
            <div className="mb-3 space-y-2">
              <button
                type="button"
                onClick={handleExtractAllOcr}
                disabled={extractingOcr}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center space-x-1.5 shadow transition-all disabled:opacity-50"
              >
                {extractingOcr ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting Text via OCR...</span>
                  </>
                ) : (
                  <>
                    <ScanText className="w-3.5 h-3.5" />
                    <span>Extract Text (OCR All Pages)</span>
                  </>
                )}
              </button>

              {ocrSuccessMessage && (
                <div className="p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-[11px] text-emerald-300 text-center animate-fade-in">
                  ✓ {ocrSuccessMessage}
                </div>
              )}
            </div>

            {/* Batch Add Button */}
            {selectedPageIds.length > 0 && (
              <button
                type="button"
                onClick={handleAddSelectedPagesAsScenes}
                disabled={batchAdding}
                className="mb-3 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all disabled:opacity-50"
              >
                {batchAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Adding {selectedPageIds.length} Scenes...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add Selected ({selectedPageIds.length}) to Scenes</span>
                  </>
                )}
              </button>
            )}

            {/* Pages Grid */}
            <div className="grid grid-cols-2 gap-2.5 overflow-y-auto max-h-[360px] pr-1">
              {pages.map((page) => {
                const isSelected = selectedPageIds.includes(page._id);
                const hasOcr = Boolean(page.extractedText && page.extractedText.trim().length > 0);
                return (
                  <div
                    key={page._id}
                    className={`group relative aspect-[3/4] bg-neutral-950 rounded-xl overflow-hidden border transition-all ${
                      isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <img
                      src={page.editedUrl || page.originalUrl}
                      alt={`Page ${page.order}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />

                    {/* Checkbox Toggle */}
                    <div
                      onClick={(e) => togglePageSelection(page._id, e)}
                      className="absolute top-1.5 left-1.5 z-10 bg-neutral-950/80 rounded p-1 cursor-pointer hover:scale-110 transition-transform"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-400 hover:text-white" />
                      )}
                    </div>

                    {/* OCR Indicator Badge */}
                    {hasOcr && (
                      <div
                        title={`Extracted text: ${page.extractedText.slice(0, 100)}...`}
                        className="absolute top-1.5 right-1.5 z-10 bg-purple-600/90 text-white rounded px-1.5 py-0.5 text-[9px] font-bold shadow flex items-center space-x-0.5"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>OCR</span>
                      </div>
                    )}

                    {/* Hover Add Button */}
                    <div
                      onClick={() => handleCreateSceneFromPage(page)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer z-10"
                    >
                      <span className="bg-indigo-600 text-white p-2 rounded-full shadow hover:scale-110 transition-transform">
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>

                    <div className="absolute bottom-1 right-1 bg-neutral-950/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-neutral-300 pointer-events-none">
                      #{page.order}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center & Right: Live Rendering Player & Studio Controls (9 Cols) */}
        <div className="lg:col-span-9 flex flex-col bg-neutral-950 overflow-y-auto">
          
          {/* Canvas Top Bar: Viewport Sizing, Zoom, and Subtitle Toggles */}
          <div className="bg-neutral-900 border-b border-neutral-800 px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-neutral-400 font-semibold uppercase mr-2">Preview Mode:</span>
              <button
                type="button"
                onClick={() => setViewMode('fit')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  viewMode === 'fit'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Webtoon Read Mode (Big)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cinema')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  viewMode === 'cinema'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Cinema 16:9 Video</span>
              </button>
            </div>

            {/* Zoom & Display Controls */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 bg-neutral-800 px-2 py-1 rounded-xl border border-neutral-700">
                <button
                  onClick={() => setZoomScale((prev) => Math.max(0.7, prev - 0.15))}
                  className="p-1 text-neutral-400 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-neutral-300 px-1 font-semibold">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale((prev) => Math.min(2.5, prev + 0.15))}
                  className="p-1 text-neutral-400 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomScale(1)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 ml-1 px-1 py-0.5"
                >
                  Reset
                </button>
              </div>

              {/* Subtitle Toggle (Off by default so image is clean!) */}
              <button
                type="button"
                onClick={() => setShowSubtitles((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
                  showSubtitles
                    ? 'bg-purple-950 border-purple-600 text-purple-200'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                }`}
                title="Toggle subtitles on preview"
              >
                {showSubtitles ? <Eye className="w-3.5 h-3.5 text-purple-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>Subtitles: {showSubtitles ? 'On' : 'Off'}</span>
              </button>
            </div>
          </div>

          {/* Large Live Video Preview Stage */}
          <div
            ref={canvasContainerRef}
            className={`flex-1 flex items-center justify-center p-6 bg-neutral-950 relative overflow-hidden transition-all ${
              isFullscreen ? 'fixed inset-0 z-50 p-0' : 'min-h-[500px] max-h-[72vh]'
            }`}
          >
            {activeScene ? (
              <div
                className={`relative overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-900 flex items-center justify-center transition-all ${
                  viewMode === 'cinema'
                    ? 'max-w-4xl w-full aspect-[16/9] rounded-2xl'
                    : 'max-h-[68vh] w-auto max-w-2xl rounded-2xl'
                }`}
              >
                {/* Image with Live Camera Motion & Animation */}
                <div
                  className={`relative w-full h-full flex items-center justify-center overflow-hidden ${getVisualEffectClass()}`}
                >
                  <img
                    src={activeScene.image}
                    alt={activeScene.title}
                    referrerPolicy="no-referrer"
                    style={getLiveTransformStyle()}
                    className={`block object-contain select-none pointer-events-none transition-transform ${
                      viewMode === 'cinema' ? 'w-full h-full object-cover' : 'max-h-[68vh] w-auto'
                    }`}
                  />

                  {/* Visual Effect: Manga Speed Lines */}
                  {activeScene.visualEffect === 'speed-lines' && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none opacity-40 mix-blend-screen"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      {Array.from({ length: 36 }, (_, i) => {
                        const angle = (i * 10 * Math.PI) / 180;
                        const x1 = 50 + Math.cos(angle) * 32;
                        const y1 = 50 + Math.sin(angle) * 32;
                        const x2 = 50 + Math.cos(angle) * 75;
                        const y2 = 50 + Math.sin(angle) * 75;
                        return (
                          <line
                            key={i}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="white"
                            strokeWidth={i % 2 === 0 ? '0.8' : '0.4'}
                            opacity="0.6"
                          />
                        );
                      })}
                    </svg>
                  )}

                  {/* Visual Effect: Vignette */}
                  {activeScene.visualEffect === 'vignette' && (
                    <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_90px_rgba(0,0,0,0.85)] z-10" />
                  )}

                  {/* Visual Effect: Soft Bloom / Glow */}
                  {activeScene.visualEffect === 'bloom' && (
                    <div className="absolute inset-0 pointer-events-none mix-blend-screen bg-indigo-500/15 backdrop-blur-[0.5px] z-10" />
                  )}

                  {/* Visual Effect: Impact Flash */}
                  {activeScene.visualEffect === 'flash' && (
                    <div
                      key={flashKey}
                      className="absolute inset-0 pointer-events-none bg-white z-20 animate-flash"
                    />
                  )}

                  {/* Clean Subtitle Overlay (ONLY shown if user explicitly turned subtitles ON) */}
                  {showSubtitles && activeScene.narration && (
                    <div className="absolute bottom-3 inset-x-6 text-center pointer-events-none z-20">
                      <span className="inline-block bg-neutral-950/80 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-medium text-white shadow border border-neutral-700/60">
                        {activeScene.narration}
                      </span>
                    </div>
                  )}
                </div>

                {/* Live Rendering Status Badge */}
                {isPlaying && (
                  <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow flex items-center space-x-1.5 animate-pulse z-20">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    <span>LIVE RENDERING ({activeScene.effects || 'ken-burns'})</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-neutral-500 text-sm flex flex-col items-center space-y-2">
                <Layers className="w-10 h-10 text-neutral-700" />
                <span>Select or create a scene to start live video rendering</span>
              </div>
            )}
          </div>

          {/* Video Player Playback Control Bar */}
          <div className="bg-neutral-900 border-y border-neutral-800 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handlePrevScene}
                disabled={scenes.length <= 1 || activeIndex <= 0}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Previous Scene"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={scenes.length === 0}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg transition-all disabled:opacity-40"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-white" />
                    <span>Pause Video</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Play Video Live</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNextScene}
                disabled={scenes.length <= 1 || activeIndex >= scenes.length - 1}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Next Scene"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar & Timing */}
            <div className="flex-1 max-w-md w-full flex items-center space-x-3">
              <span className="text-[11px] font-mono text-neutral-400">
                {activeScene ? `Scene ${activeIndex + 1}/${scenes.length}` : '0/0'}
              </span>

              <div className="flex-1 bg-neutral-800 h-2 rounded-full overflow-hidden relative">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-75"
                  style={{ width: `${playbackProgress}%` }}
                />
              </div>

              <span className="text-[11px] font-mono text-indigo-400 font-bold">
                {activeScene ? `${activeScene.duration || 5}s` : '0s'}
              </span>
            </div>
          </div>

          {/* Active Scene Properties & Settings Editor */}
          {activeScene && (
            <div className="bg-neutral-900 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-neutral-800">
              
              {/* Left Column: Script & Narration */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                      Narration / Speech Script
                    </label>
                    {activeScene.narration && (
                      <span className="text-[10px] text-neutral-500">
                        {activeScene.narration.length} chars
                      </span>
                    )}
                  </div>
                  <textarea
                    value={activeScene.narration || ''}
                    onChange={(e) => handleUpdateActiveScene('narration', e.target.value)}
                    rows={4}
                    placeholder="Enter narration or dialogue here. (Speech is no longer placed on the image by default)"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600 transition-colors"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Speech text is kept clean and separate. Enable the Subtitles button above if you ever want captions on preview.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                      Duration (Seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={activeScene.duration || 5}
                      onChange={(e) => handleUpdateActiveScene('duration', Math.max(1, Number(e.target.value)))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                      Camera Motion Animation
                    </label>
                    <select
                      value={activeScene.effects || 'ken-burns'}
                      onChange={(e) => handleUpdateActiveScene('effects', e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="ken-burns">Ken Burns (Cinematic Pan & Zoom)</option>
                      <option value="vertical-pan">Vertical Scroll (Webtoon Pan)</option>
                      <option value="zoom-in">Dramatic Push-In</option>
                      <option value="shake">Camera Shake (Action Shock)</option>
                      <option value="pulse">Breathing Pulse</option>
                      <option value="none">Static (Locked View)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Effects & Audio */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                      Visual FX Overlay
                    </label>
                    <select
                      value={activeScene.visualEffect || 'none'}
                      onChange={(e) => handleUpdateActiveScene('visualEffect', e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="none">None (Clean Webtoon Art)</option>
                      <option value="vignette">Cinematic Dark Vignette</option>
                      <option value="speed-lines">Manga Speed Action Lines</option>
                      <option value="bloom">Soft Ethereal Glow</option>
                      <option value="flash">Impact White Flash</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                      Transition Style
                    </label>
                    <select
                      value={activeScene.transition || 'none'}
                      onChange={(e) => handleUpdateActiveScene('transition', e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="none">Cut (Instant)</option>
                      <option value="fade">Crossfade</option>
                      <option value="slide">Slide</option>
                      <option value="dissolve">Dissolve</option>
                    </select>
                  </div>
                </div>

                {/* Audio Upload & Microphone Voiceover */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1.5">
                    Scene Audio Track (Voiceover & BGM)
                  </label>
                  <div className="flex items-center space-x-3 mb-2.5">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-pulse shadow"
                      >
                        <div className="w-2.5 h-2.5 bg-white rounded-full" />
                        <span>Stop Recording Voiceover</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        disabled={uploadingAudio}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 shadow"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Record Voiceover Live</span>
                      </button>
                    )}
                    {uploadingAudio && <span className="text-xs text-neutral-400">Uploading audio...</span>}
                  </div>

                  {activeScene.audio?.cloudinaryUrl && (
                    <div className="mt-2.5 flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-900/50">
                      <Volume2 className="w-4 h-4" />
                      <span>Audio attached: {activeScene.audio.format} ({activeScene.audio.duration}s)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Timeline Track */}
          <div className="bg-neutral-950 px-6 py-4 flex items-center space-x-3 overflow-x-auto">
            <span className="text-xs font-bold text-neutral-500 uppercase flex-shrink-0">Timeline:</span>
            {scenes.map((scene, idx) => {
              const isCurrent = activeScene?._id === scene._id;
              return (
                <div
                  key={scene._id}
                  onClick={() => {
                    setActiveScene(scene);
                    setPlaybackProgress(0);
                  }}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl border cursor-pointer text-xs font-semibold flex items-center space-x-2 transition-all ${
                    isCurrent
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-1 ring-indigo-400/50'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <span className="text-[10px] text-neutral-400 font-mono">#{idx + 1}</span>
                  <span className="truncate max-w-[120px]">{scene.title}</span>
                  <span className="text-[10px] opacity-75 font-mono">{scene.duration || 5}s</span>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}
