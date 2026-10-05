'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, use } from 'react';
import Link from 'next/link';
import { Player, type PlayerRef } from '@remotion/player';
import Navbar from '@/components/Navbar';
import YouTubePublishPanel from '@/components/YouTubePublishPanel';
import CameraEditor from '@/components/video/CameraEditor';
import { WebtoonVideo } from '@/components/video/WebtoonVideo';
import {
  Aspect,
  FPS,
  FRAME_SIZE,
  defaultCamera,
  defaultDurationSeconds,
  interpolateCamera,
  splitCamera,
} from '@/lib/video/camera';
import {
  buildVideoProps,
  computeTimeline,
  effectiveImageHeight,
  loadImageSize,
  sceneCamera,
  sceneIndexAtFrame,
  toVideoSrc,
} from '@/lib/video/project';
import { keptSegments, normalizeHideBoxes } from '@/lib/video/cleanup';
import SceneCleanupEditor from '@/components/video/SceneCleanupEditor';
import {
  Film,
  Plus,
  Trash2,
  Sparkles,
  ArrowLeft,
  Loader2,
  Volume2,
  Mic,
  CheckSquare,
  Square,
  Layers,
  Eye,
  EyeOff,
  ScanText,
  Youtube,
  Scissors,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Monitor,
  Video,
  Timer,
  Eraser,
  Languages,
  RefreshCw,
  Save,
  ToggleLeft,
  ToggleRight,
  Wand2,
  ImageIcon,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const pageImage = (page: any) => page.editedUrl || page.originalUrl;

const cleanScene = (s: any) => ({
  ...s,
  narration: s.narration?.startsWith('Narration for Page') ? '' : s.narration || '',
  visualEffect: s.visualEffect || 'none',
});

export default function VideoStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chapterId = resolvedParams.id;

  const [chapter, setChapter] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  // Checkbox Selection States
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [batchAdding, setBatchAdding] = useState(false);
  const [addProgress, setAddProgress] = useState('');
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Auto-save toggle (off by default)
  const [autoSave, setAutoSave] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('studio-auto-save') === 'true';
    return false;
  });
  const [preprocessingImages, setPreprocessingImages] = useState(false);
  const [preprocessMessage, setPreprocessMessage] = useState('');

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
  const [ocrProviders, setOcrProviders] = useState<{ id: string; label: string; available: boolean; note: string }[]>([
    { id: 'paddle', label: 'PaddleOCR (self-hosted)', available: true, note: '' },
  ]);
  const [ocrProvider, setOcrProvider] = useState('paddle');
  const [canTranslate, setCanTranslate] = useState(false);
  const [translating, setTranslating] = useState(false);

  // YouTube Publish Panel
  const [showPublishPanel, setShowPublishPanel] = useState(false);

  // Video output & player state
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [playheadFrame, setPlayheadFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [pxPerSecond, setPxPerSecond] = useState(14);
  const [inspectorTab, setInspectorTab] = useState<'camera' | 'remove'>('camera');
  const playerRef = useRef<PlayerRef>(null);

  // Debounced per-scene saves (camera dragging / typing fire many updates)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingPatches = useRef<Record<string, any>>({});
  const measuringRef = useRef(new Set<string>());

  useEffect(() => {
    const saved = localStorage.getItem(`studio-aspect-${chapterId}`);
    if (saved === '16:9' || saved === '9:16') {
      const t = setTimeout(() => setAspect(saved), 0);
      return () => clearTimeout(t);
    }
  }, [chapterId]);



  // Configured OCR engines; remember the last chosen one if it is still available
  useEffect(() => {
    fetch('/api/ocr-providers')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setOcrProviders(d.data);
        setCanTranslate(Boolean(d.canTranslate));
        const saved = localStorage.getItem('studio-ocr-provider');
        const usable = (p: any) => p.id === saved && p.available;
        if (saved && d.data.some(usable)) setOcrProvider(saved);
        else if (d.data[0]) setOcrProvider(d.data[0].id); // fall back to the first provider
      })
      .catch(() => {});
  }, []);

  const changeAspect = (a: Aspect) => {
    setAspect(a);
    localStorage.setItem(`studio-aspect-${chapterId}`, a);
  };

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
          const cleanedScenes = sData.data.map(cleanScene);
          setScenes(cleanedScenes);
          if (cleanedScenes.length > 0) setActiveSceneId(cleanedScenes[0]._id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadStudioData();
  }, [chapterId]);

  // Older scenes have no stored image size — measure once and persist it
  useEffect(() => {
    const missing = scenes.filter(
      (s) => s.image && !(s.imageWidth && s.imageHeight) && !measuringRef.current.has(s._id)
    );
    if (missing.length === 0) return;
    missing.forEach((s) => measuringRef.current.add(s._id));
    (async () => {
      for (const s of missing) {
        try {
          const { width, height } = await loadImageSize(s.image);
          setScenes((prev) => prev.map((p) => (p._id === s._id ? { ...p, imageWidth: width, imageHeight: height } : p)));
          fetch(`/api/scenes/${s._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageWidth: width, imageHeight: height }),
          }).catch(() => {});
        } catch (e) {
          console.warn(e);
        }
      }
    })();
  }, [scenes]);

  const videoProps = useMemo(() => buildVideoProps(scenes, aspect, showSubtitles), [scenes, aspect, showSubtitles]);
  const timeline = useMemo(() => computeTimeline(videoProps.scenes), [videoProps.scenes]);
  const frameSize = FRAME_SIZE[aspect];

  const playheadSceneIdx = videoProps.scenes.length
    ? sceneIndexAtFrame(videoProps.scenes, timeline.starts, playheadFrame)
    : -1;
  const playheadSceneId = playheadSceneIdx >= 0 ? videoProps.scenes[playheadSceneIdx].id : null;

  // Player → studio sync (throttled by the player's timeupdate cadence)
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onTime = (e: { detail: { frame: number } }) => setPlayheadFrame(e.detail.frame);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      setPlayheadFrame(player.getCurrentFrame());
    };
    player.addEventListener('timeupdate', onTime);
    player.addEventListener('seeked', onTime);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('timeupdate', onTime);
      player.removeEventListener('seeked', onTime);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [loading]);

  // While playing, the inspector follows the scene under the playhead
  const followedSceneId = isPlaying && playheadSceneId ? playheadSceneId : activeSceneId;
  const activeScene = scenes.find((s) => s._id === followedSceneId) || null;

  const seekToScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    const idx = videoProps.scenes.findIndex((s) => s.id === sceneId);
    if (idx >= 0) {
      playerRef.current?.seekTo(timeline.starts[idx]);
      setPlayheadFrame(timeline.starts[idx]);
    }
  };

  const nextOrder = (offset = 0) => scenes.reduce((m, s) => Math.max(m, s.order || 0), 0) + 1 + offset;

  const markSaved = () => {
    setSaveStatus('saved');
    setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const autoSaveRef = useRef(autoSave);
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);

  const flushScene = useCallback(async (sceneId: string) => {
    const body = pendingPatches.current[sceneId];
    if (!body) return;
    delete pendingPatches.current[sceneId];
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/scenes/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      markSaved();
    } catch {
      setSaveStatus('unsaved');
    }
  }, []);

  const patchScene = useCallback((sceneId: string, patch: Record<string, any>) => {
    setScenes((prev) => prev.map((s) => (s._id === sceneId ? { ...s, ...patch } : s)));
    pendingPatches.current[sceneId] = { ...(pendingPatches.current[sceneId] || {}), ...patch };
    setSaveStatus('unsaved');
    clearTimeout(saveTimers.current[sceneId]);
    if (autoSaveRef.current) {
      saveTimers.current[sceneId] = setTimeout(() => flushScene(sceneId), 450);
    }
  }, [flushScene]);

  const saveAllPending = useCallback(async () => {
    const ids = Object.keys(pendingPatches.current);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => flushScene(id)));
  }, [flushScene]);

  const toggleAutoSave = () => {
    const next = !autoSave;
    setAutoSave(next);
    localStorage.setItem('studio-auto-save', String(next));
    if (next) {
      // Flush any pending changes immediately
      Object.keys(pendingPatches.current).forEach((id) => flushScene(id));
    }
  };

  const handleUpdateActiveScene = (field: string, value: any) => {
    if (activeScene) patchScene(activeScene._id, { [field]: value });
  };

  // Refresh pages + scenes after OCR completes
  const refreshOcrResults = async () => {
    const pRes = await fetch(`/api/chapters/${chapterId}/pages`);
    const pData = await pRes.json();
    if (pData.success) setPages(pData.data);

    const sRes = await fetch(`/api/scenes?chapterId=${chapterId}`);
    const sData = await sRes.json();
    if (sData.success) setScenes(sData.data.map(cleanScene));
  };

  const changeOcrProvider = (p: string) => {
    setOcrProvider(p);
    localStorage.setItem('studio-ocr-provider', p);
  };

  const handleTranslateToHindi = async () => {
    if (!activeScene?.narration?.trim()) return;
    const sceneId = activeScene._id;
    setTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: activeScene.narration, target: 'hi' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Translation failed');
      patchScene(sceneId, { narrationHi: data.data.text });
    } catch (e: any) {
      alert(e.message || 'Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  // Preprocess / clean all chapter images before OCR
  const handlePreprocessImages = async () => {
    setPreprocessingImages(true);
    setPreprocessMessage('Processing images...');
    try {
      const res = await fetch(`/api/chapters/${chapterId}/preprocess`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Image processing failed');
        setPreprocessingImages(false);
        setPreprocessMessage('');
        return;
      }
      setPreprocessMessage(
        `Processed ${data.done}/${data.total} images${data.failed?.length ? ` (${data.failed.length} failed)` : ''}`
      );
      // Refresh pages to show processed images
      const pRes = await fetch(`/api/chapters/${chapterId}/pages`);
      const pData = await pRes.json();
      if (pData.success) setPages(pData.data);
      setTimeout(() => setPreprocessMessage(''), 4500);
    } catch (err) {
      console.error(err);
      alert('Image processing request failed');
    } finally {
      setPreprocessingImages(false);
    }
  };

  // OCR Text Extraction for All Pages — queued via RabbitMQ, polled until done.
  // overwrite = re-extract: replace existing scene narrations with the new result.
  const handleExtractAllOcr = async (overwrite: boolean) => {
    setExtractingOcr(true);
    setOcrSuccessMessage('');
    try {
      const res = await fetch(`/api/chapters/${chapterId}/extract-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: ocrProvider, overwrite }),
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

  // Add pages as full webtoon scenes: read-mode camera scrolling top → bottom, OCR text as narration
  const addPagesAsScenes = async (pageList: any[]) => {
    if (pageList.length === 0) return;
    setBatchAdding(true);
    try {
      const ordered = [...pageList].sort((a, b) => a.order - b.order);
      const created: any[] = [];
      for (let i = 0; i < ordered.length; i++) {
        const page = ordered[i];
        setAddProgress(`Adding page ${i + 1}/${ordered.length}…`);
        const image = pageImage(page);
        let size: { width: number; height: number };
        try {
          size = await loadImageSize(image);
        } catch {
          console.warn(`Skipping page ${page.order}: image failed to load`);
          continue;
        }
        const res = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId,
            pageId: page._id,
            order: nextOrder(created.length),
            title: `Page ${page.order}`,
            narration: page.extractedText || '',
            narrationHi: page.extractedTextHi || '',
            dialogue: '',
            duration: defaultDurationSeconds(aspect, size.width, size.height),
            image,
            imageWidth: size.width,
            imageHeight: size.height,
            camera: defaultCamera(aspect, size.width, size.height),
            effects: 'none',
            visualEffect: 'none',
            transition: 'none',
            zoom: 1,
          }),
        });
        const data = await res.json();
        if (data.success) created.push(cleanScene(data.data));
      }
      setScenes((prev) => [...prev, ...created]);
      if (created.length > 0 && !activeSceneId) setActiveSceneId(created[0]._id);
      setSelectedPageIds([]);
    } catch (err) {
      console.error(err);
      alert('Error adding pages to the video');
    } finally {
      setBatchAdding(false);
      setAddProgress('');
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

  // Toggle Scene Selection Checkbox
  const toggleSceneSelection = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSceneIds((prev) =>
      prev.includes(sceneId) ? prev.filter((id) => id !== sceneId) : [...prev, sceneId]
    );
  };

  const deleteScenes = async (ids: string[]) => {
    await Promise.all(ids.map((id) => fetch(`/api/scenes/${id}`, { method: 'DELETE' })));
    const remaining = scenes.filter((s) => !ids.includes(s._id));
    setScenes(remaining);
    if (activeSceneId && ids.includes(activeSceneId)) setActiveSceneId(remaining[0]?._id || null);
    setSelectedSceneIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  // Batch Delete Selected Scenes
  const handleBatchDeleteScenes = async () => {
    if (selectedSceneIds.length === 0) return;
    if (!confirm(`Delete ${selectedSceneIds.length} selected scenes?`)) return;

    setBatchDeleting(true);
    try {
      await deleteScenes(selectedSceneIds);
    } catch (e) {
      console.error(e);
      alert('Failed to delete some scenes');
    } finally {
      setBatchDeleting(false);
    }
  };

  // Batch Set Duration for Selected Scenes
  const handleBatchSetDuration = (seconds: number) => {
    selectedSceneIds.forEach((id) => patchScene(id, { duration: seconds }));
  };

  // Swap a scene with its neighbour in the sequence
  const handleMoveScene = async (sceneId: string, dir: -1 | 1) => {
    const idx = scenes.findIndex((s) => s._id === sceneId);
    const other = scenes[idx + dir];
    if (idx < 0 || !other) return;
    const a = scenes[idx];
    const reordered = [...scenes];
    reordered[idx] = { ...other, order: a.order };
    reordered[idx + dir] = { ...a, order: other.order };
    setScenes(reordered);
    setSaveStatus('saving');
    try {
      await Promise.all([
        fetch(`/api/scenes/${a._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: other.order }),
        }),
        fetch(`/api/scenes/${other._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: a.order }),
        }),
      ]);
      markSaved();
    } catch {
      setSaveStatus('unsaved');
    }
  };

  // Cut the scene under the playhead into two scenes whose cameras meet at the cut
  const handleSplitAtPlayhead = async () => {
    if (playheadSceneIdx < 0) return;
    const vs = videoProps.scenes[playheadSceneIdx];
    const sceneIdx = scenes.findIndex((s) => s._id === vs.id);
    const scene = scenes[sceneIdx];
    const local = playheadFrame - timeline.starts[playheadSceneIdx];
    if (local < FPS * 0.5 || vs.durationInFrames - local < FPS * 0.5) {
      alert('Move the playhead at least 0.5s inside a scene to split it.');
      return;
    }
    setSplitting(true);
    try {
      const [camA, camB] = splitCamera(vs.camera, local / (vs.durationInFrames - 1));
      const durA = Math.round((local / FPS) * 10) / 10;
      const durB = Math.max(0.5, Math.round(((vs.durationInFrames - local) / FPS) * 10) / 10);

      // Make room right after the split scene
      const after = scenes.slice(sceneIdx + 1);
      await Promise.all(
        after.map((s) =>
          fetch(`/api/scenes/${s._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: (s.order || 0) + 1 }),
          })
        )
      );
      await fetch(`/api/scenes/${scene._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera: camA, duration: durA }),
      });
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          pageId: scene.pageId,
          order: (scene.order || 0) + 1,
          title: `${scene.title} (cont.)`,
          narration: '',
          narrationHi: '',
          dialogue: '',
          duration: durB,
          image: scene.image,
          imageWidth: scene.imageWidth,
          imageHeight: scene.imageHeight,
          cuts: scene.cuts || [],
          hideBoxes: scene.hideBoxes || [],
          camera: camB,
          effects: scene.effects,
          visualEffect: 'none',
          transition: 'none',
          zoom: 1,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Split failed');

      setScenes([
        ...scenes.slice(0, sceneIdx),
        { ...scene, camera: camA, duration: durA },
        cleanScene(data.data),
        ...after.map((s) => ({ ...s, order: (s.order || 0) + 1 })),
      ]);
      setActiveSceneId(data.data._id);
      markSaved();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to split scene');
    } finally {
      setSplitting(false);
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
        setScenes((prev) => prev.map((s) => (s._id === data.data._id ? cleanScene(data.data) : s)));
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

  const totalSeconds = timeline.durationInFrames / FPS;
  const activeVideoIdx = activeScene ? videoProps.scenes.findIndex((s) => s.id === activeScene._id) : -1;
  const activeCamera = activeScene?.imageWidth ? sceneCamera(activeScene, aspect) : null;
  const liveKeyframe =
    activeCamera && activeVideoIdx >= 0 && activeVideoIdx === playheadSceneIdx
      ? interpolateCamera(
          activeCamera,
          (playheadFrame - timeline.starts[activeVideoIdx]) /
            Math.max(1, videoProps.scenes[activeVideoIdx].durationInFrames - 1)
        )
      : null;
  const selectedProviderInfo = ocrProviders.find((p) => p.id === ocrProvider);
  const activeCleanupCount = (activeScene?.cuts?.length || 0) + (activeScene?.hideBoxes?.length || 0);
  const cameraFxValue = ['none', 'shake', 'pulse', 'float', 'heartbeat', 'zoom-pulse', 'breathe'].includes(activeScene?.effects) ? activeScene.effects : 'none';

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
                <span>Webtoon Video Studio</span>
              </h1>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                Ch. {chapter?.chapterNumber}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {chapter?.title} • {scenes.length} Scenes • {totalSeconds.toFixed(1)}s • {frameSize.width}×{frameSize.height} @ {FPS}fps
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setShowPublishPanel(true)}
            className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow"
          >
            <Youtube className="w-3.5 h-3.5" />
            <span>Export / Publish</span>
          </button>

          {/* Manual Save (when auto-save is off) */}
          {!autoSave && saveStatus === 'unsaved' && (
            <button
              type="button"
              onClick={saveAllPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          )}

          {/* Auto-save toggle */}
          <button
            type="button"
            onClick={toggleAutoSave}
            className="flex items-center space-x-1.5 text-xs text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800 hover:text-white transition-colors"
            title={autoSave ? 'Auto-save is ON — changes save automatically' : 'Auto-save is OFF — click Save to persist changes'}
          >
            {autoSave ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-neutral-500" />}
            <span>Auto-Save</span>
          </button>

          <div className="flex items-center space-x-2 text-xs text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
            {saveStatus === 'saving' && (
              <span className="text-amber-400 flex items-center space-x-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </span>
            )}
            {saveStatus === 'saved' && <span className="text-emerald-400">Saved ({lastSaved})</span>}
            {saveStatus === 'unsaved' && <span className="text-amber-400">Unsaved changes</span>}
          </div>
        </div>
      </header>

      {/* Main Studio Layout */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 xl:h-[calc(100vh-120px)] overflow-hidden">
        {/* Left: Scenes Sequence & Pages */}
        <div className="xl:col-span-3 bg-neutral-900 border-r border-neutral-800 p-4 flex flex-col overflow-y-auto space-y-6">
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
                    {[3, 5, 10].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => handleBatchSetDuration(sec)}
                        className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-[10px] rounded text-neutral-300"
                      >
                        {sec}s
                      </button>
                    ))}
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
                No scenes yet. Use <strong className="text-neutral-300">Add All Pages to Video</strong> below to build the
                webtoon video.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {scenes.map((scene, idx) => {
                  const isChecked = selectedSceneIds.includes(scene._id);
                  const isCurrent = activeScene?._id === scene._id;
                  return (
                    <div
                      key={scene._id}
                      onClick={() => seekToScene(scene._id)}
                      className={`p-2 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition-all ${
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

                      <div className="relative w-9 h-12 rounded-md overflow-hidden bg-neutral-900 flex-shrink-0 border border-neutral-800">
                        <img
                          src={scene.image}
                          alt={scene.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-top"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold truncate">
                            {idx + 1}. {scene.title}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">{scene.duration || 5}s</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                          {scene.narration ? scene.narration : <span className="italic text-neutral-600">No narration</span>}
                        </p>
                      </div>

                      <div className="flex flex-col">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveScene(scene._id, -1);
                          }}
                          disabled={idx === 0}
                          className="text-neutral-500 hover:text-white disabled:opacity-20"
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveScene(scene._id, 1);
                          }}
                          disabled={idx === scenes.length - 1}
                          className="text-neutral-500 hover:text-white disabled:opacity-20"
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
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
                Chapter Pages ({pages.length})
              </h3>
              <button
                onClick={toggleSelectAllPages}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                {selectedPageIds.length === pages.length ? 'Clear' : 'Select All'}
              </button>
            </div>

            <div className="mb-3 space-y-2">
              {/* OCR provider + Extract / Re-extract */}
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">OCR Provider</label>
                <select
                  value={ocrProvider}
                  onChange={(e) => changeOcrProvider(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {ocrProviders.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.available}>
                      {p.label}
                      {p.available ? '' : ' — not configured'}
                    </option>
                  ))}
                </select>
                {selectedProviderInfo && (
                  <p className="text-[10px] text-neutral-500 mt-1">{selectedProviderInfo.note}</p>
                )}
              </div>
              {/* Step 0: Process images (clean before OCR) */}
              <button
                type="button"
                onClick={handlePreprocessImages}
                disabled={preprocessingImages || pages.length === 0}
                className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-semibold py-2 px-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
                title="Clean all page images: denoise, enhance contrast, remove watermarks, sharpen text. Run this BEFORE OCR for best results."
              >
                {preprocessingImages ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>{preprocessingImages ? preprocessMessage || 'Processing...' : '0. Process Images (Clean)'}</span>
              </button>
              {preprocessMessage && !preprocessingImages && (
                <div className="p-2 bg-cyan-950/60 border border-cyan-800/80 rounded-xl text-[11px] text-cyan-300 text-center animate-fade-in">
                  {preprocessMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleExtractAllOcr(false)}
                  disabled={extractingOcr}
                  className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-semibold py-2 px-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
                  title="Extract English + Hindi text; fills scenes that have no narration yet"
                >
                  {extractingOcr ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ScanText className="w-3.5 h-3.5 text-purple-400" />
                  )}
                  <span>1. Extract Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Re-extract all pages with the selected provider and REPLACE the English + Hindi narration of existing scenes?'))
                      handleExtractAllOcr(true);
                  }}
                  disabled={extractingOcr}
                  className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-semibold py-2 px-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
                  title="Run OCR again with the selected provider and overwrite scene narrations"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Re-extract</span>
                </button>
              </div>

              {ocrSuccessMessage && (
                <div className="p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-[11px] text-emerald-300 text-center animate-fade-in">
                  ✓ {ocrSuccessMessage}
                </div>
              )}

              <button
                type="button"
                onClick={() => addPagesAsScenes(selectedPageIds.length > 0 ? pages.filter((p) => selectedPageIds.includes(p._id)) : pages)}
                disabled={batchAdding || pages.length === 0}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all disabled:opacity-50"
              >
                {batchAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{addProgress || 'Adding…'}</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    <span>
                      {selectedPageIds.length > 0
                        ? `2. Add Selected (${selectedPageIds.length}) to Video`
                        : `2. Add All Pages to Video (${pages.length})`}
                    </span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-neutral-500 leading-relaxed">
                Pages are added in reading order as full webtoon scenes that scroll top → bottom, with OCR text as
                narration. Adjust the camera, cut scenes at the playhead, and add effects in the editor.
              </p>
            </div>

            {/* Pages Grid */}
            <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[360px] pr-1">
              {pages.map((page) => {
                const isSelected = selectedPageIds.includes(page._id);
                const hasOcr = Boolean(page.extractedText && page.extractedText.trim().length > 0);
                return (
                  <div
                    key={page._id}
                    className={`group relative aspect-[3/4] bg-neutral-950 rounded-lg overflow-hidden border transition-all ${
                      isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <img
                      src={pageImage(page)}
                      alt={`Page ${page.order}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />

                    {/* Checkbox Toggle */}
                    <div
                      onClick={(e) => togglePageSelection(page._id, e)}
                      className="absolute top-1 left-1 z-10 bg-neutral-950/80 rounded p-0.5 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-neutral-400 hover:text-white" />
                      )}
                    </div>

                    {/* OCR Indicator Badge */}
                    {hasOcr && (
                      <div
                        title={`${page.ocrProvider || 'OCR'} • EN: ${page.extractedText.slice(0, 100)}…${
                          page.extractedTextHi ? `\nHI: ${page.extractedTextHi.slice(0, 100)}…` : ''
                        }`}
                        className="absolute top-1 right-1 z-10 bg-purple-600/90 text-white rounded px-1 py-0.5 text-[8px] font-bold shadow flex items-center space-x-0.5"
                      >
                        <Sparkles className="w-2 h-2" />
                        <span>OCR</span>
                      </div>
                    )}

                    {/* Hover Add Button */}
                    <div
                      onClick={() => !batchAdding && addPagesAsScenes([page])}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                      title="Add this page to the video"
                    >
                      <span className="bg-indigo-600 text-white p-1.5 rounded-full shadow">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="absolute bottom-1 right-1 bg-neutral-950/80 px-1 py-0.5 rounded text-[9px] font-bold text-neutral-300 pointer-events-none">
                      #{page.order}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Player + Timeline */}
        <div className="xl:col-span-6 flex flex-col bg-neutral-950 overflow-y-auto">
          <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] text-neutral-400 font-semibold uppercase mr-1">Format:</span>
              <button
                type="button"
                onClick={() => changeAspect('16:9')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  aspect === '16:9' ? 'bg-indigo-600 text-white shadow' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>16:9 YouTube</span>
              </button>
              <button
                type="button"
                onClick={() => changeAspect('9:16')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  aspect === '9:16' ? 'bg-indigo-600 text-white shadow' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>9:16 Shorts</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSplitAtPlayhead}
                disabled={splitting || playheadSceneIdx < 0}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white disabled:opacity-40"
                title="Cut the scene under the playhead into two scenes"
              >
                {splitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5 text-amber-400" />}
                <span>Split at Playhead</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSubtitles((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
                  showSubtitles
                    ? 'bg-purple-950 border-purple-600 text-purple-200'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                }`}
              >
                {showSubtitles ? <Eye className="w-3.5 h-3.5 text-purple-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>Subtitles EN + HI: {showSubtitles ? 'On' : 'Off'}</span>
              </button>
            </div>
          </div>

          {/* Remotion Player — frame-accurate preview of the exported video */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-[420px]">
            <div
              className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800"
              style={aspect === '16:9' ? { width: '100%', aspectRatio: '16 / 9' } : { height: '64vh', aspectRatio: '9 / 16' }}
            >
              <Player
                ref={playerRef}
                component={WebtoonVideo}
                inputProps={videoProps}
                durationInFrames={timeline.durationInFrames}
                compositionWidth={frameSize.width}
                compositionHeight={frameSize.height}
                fps={FPS}
                controls
                allowFullscreen
                clickToPlay
                doubleClickToFullscreen
                spaceKeyToPlayOrPause
                style={{ width: '100%', height: '100%' }}
              />
              {videoProps.scenes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 text-sm space-y-2 pointer-events-none">
                  <Layers className="w-10 h-10 text-neutral-700" />
                  <span>Add pages to start building the video</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline track — block widths are proportional to scene duration */}
          <div className="bg-neutral-900 border-t border-neutral-800 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-400 uppercase flex items-center space-x-1.5">
                <Timer className="w-3.5 h-3.5" />
                <span>
                  Timeline • {(playheadFrame / FPS).toFixed(1)}s / {totalSeconds.toFixed(1)}s
                </span>
              </span>
              <input
                type="range"
                min={4}
                max={60}
                value={pxPerSecond}
                onChange={(e) => setPxPerSecond(Number(e.target.value))}
                className="w-28 accent-indigo-500"
                title="Timeline zoom"
              />
            </div>
            <div className="overflow-x-auto pb-1">
              <div
                className="relative h-16"
                style={{ width: Math.max(totalSeconds * pxPerSecond, 200) }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const f = Math.round(((e.clientX - rect.left) / pxPerSecond) * FPS);
                  const clamped = Math.max(0, Math.min(timeline.durationInFrames - 1, f));
                  playerRef.current?.seekTo(clamped);
                  setPlayheadFrame(clamped);
                }}
              >
                {videoProps.scenes.map((vs, i) => {
                  const scene = scenes.find((s) => s._id === vs.id);
                  const isCurrent = activeScene?._id === vs.id;
                  return (
                    <div
                      key={vs.id}
                      onClick={() => setActiveSceneId(vs.id)}
                      className={`absolute top-0 h-full rounded-lg border overflow-hidden cursor-pointer ${
                        isCurrent ? 'border-indigo-400 ring-1 ring-indigo-400/60' : 'border-neutral-700 hover:border-neutral-500'
                      }`}
                      style={{
                        left: (timeline.starts[i] / FPS) * pxPerSecond,
                        width: Math.max(8, (vs.durationInFrames / FPS) * pxPerSecond - 2),
                        backgroundImage: `url("${vs.src}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'top',
                      }}
                      title={`${scene?.title} • ${(vs.durationInFrames / FPS).toFixed(1)}s`}
                    >
                      <div className="absolute inset-0 bg-black/45" />
                      <span className="relative text-[10px] font-bold text-white px-1.5 truncate block">
                        {i + 1}. {scene?.title}
                      </span>
                      {vs.transition !== 'none' && i > 0 && (
                        <span className="absolute bottom-0.5 left-1 text-[8px] bg-purple-600/90 text-white px-1 rounded">
                          {vs.transition}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div
                  className="absolute top-0 h-full w-0.5 bg-amber-400 pointer-events-none z-10"
                  style={{ left: (playheadFrame / FPS) * pxPerSecond }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Scene Inspector */}
        <div className="xl:col-span-3 bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto space-y-5">
          {!activeScene ? (
            <div className="text-xs text-neutral-500 text-center py-10">Select a scene to edit its camera and effects.</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <input
                  value={activeScene.title || ''}
                  onChange={(e) => handleUpdateActiveScene('title', e.target.value)}
                  className="flex-1 bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-indigo-500 mr-2"
                />
                <button
                  type="button"
                  onClick={() => confirm('Delete this scene?') && deleteScenes([activeScene._id])}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800"
                  title="Delete scene"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Camera: which part of the page is visible and how much */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Scene Image</h4>
                  <div className="flex bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setInspectorTab('camera')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1 ${
                        inspectorTab === 'camera' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Video className="w-3 h-3" />
                      <span>Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorTab('remove')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1 ${
                        inspectorTab === 'remove' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Eraser className="w-3 h-3" />
                      <span>Remove Parts{activeCleanupCount > 0 ? ` (${activeCleanupCount})` : ''}</span>
                    </button>
                  </div>
                </div>
                {activeCamera && inspectorTab === 'camera' ? (
                  <CameraEditor
                    src={activeScene.image}
                    imageWidth={activeScene.imageWidth}
                    imageHeight={effectiveImageHeight(activeScene)}
                    segments={keptSegments(activeScene.cuts)}
                    hideBoxes={normalizeHideBoxes(activeScene.hideBoxes)}
                    aspect={aspect}
                    camera={activeCamera}
                    liveKeyframe={liveKeyframe}
                    onChange={(cam) => handleUpdateActiveScene('camera', cam)}
                  />
                ) : activeCamera ? (
                  <SceneCleanupEditor
                    src={activeScene.image}
                    analysisSrc={toVideoSrc(activeScene.image)}
                    imageWidth={activeScene.imageWidth}
                    imageHeight={activeScene.imageHeight}
                    cuts={activeScene.cuts || []}
                    hideBoxes={activeScene.hideBoxes || []}
                    onChange={({ cuts, hideBoxes }) => patchScene(activeScene._id, { cuts, hideBoxes })}
                    onRefitDuration={() => {
                      const effH = effectiveImageHeight(activeScene);
                      patchScene(activeScene._id, {
                        duration: defaultDurationSeconds(aspect, activeScene.imageWidth, effH),
                        camera: defaultCamera(aspect, activeScene.imageWidth, effH),
                      });
                    }}
                  />
                ) : (
                  <div className="text-xs text-neutral-500 flex items-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Measuring image…</span>
                  </div>
                )}
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">Duration (s)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="300"
                    step="0.5"
                    value={activeScene.duration || 5}
                    onChange={(e) => handleUpdateActiveScene('duration', Math.max(0.5, Number(e.target.value)))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  {activeScene.audio?.duration > 0 && (
                    <button
                      type="button"
                      onClick={() => handleUpdateActiveScene('duration', Math.ceil(activeScene.audio.duration * 2) / 2)}
                      className="mt-1 text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      Fit to audio ({activeScene.audio.duration}s)
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">Transition In</label>
                  <select
                    value={activeScene.transition === 'dissolve' ? 'fade' : activeScene.transition || 'none'}
                    onChange={(e) => handleUpdateActiveScene('transition', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">Cut (continuous)</option>
                    <option value="fade">Crossfade</option>
                    <option value="slide">Slide</option>
                    <option value="wipe">Wipe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">Camera FX</label>
                  <select
                    value={cameraFxValue}
                    onChange={(e) => handleUpdateActiveScene('effects', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">None</option>
                    <optgroup label="Action">
                      <option value="shake">Impact Shake</option>
                      <option value="pulse">Breathing Pulse</option>
                      <option value="heartbeat">Heartbeat</option>
                      <option value="zoom-pulse">Zoom Pulse</option>
                    </optgroup>
                    <optgroup label="Mood">
                      <option value="float">Gentle Float</option>
                      <option value="breathe">Slow Breathe</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">Visual FX</label>
                  <select
                    value={activeScene.visualEffect || 'none'}
                    onChange={(e) => handleUpdateActiveScene('visualEffect', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">None (clean art)</option>
                    <optgroup label="Cinematic">
                      <option value="vignette">Dark Vignette</option>
                      <option value="letterbox">Letterbox Bars</option>
                      <option value="focus-blur">Depth of Field</option>
                      <option value="film-grain">Film Grain</option>
                    </optgroup>
                    <optgroup label="Action / Impact">
                      <option value="speed-lines">Manga Speed Lines</option>
                      <option value="flash">Impact Flash</option>
                      <option value="bloom">Vivid Glow</option>
                    </optgroup>
                    <optgroup label="Color / Tone">
                      <option value="sepia">Sepia (Flashback)</option>
                      <option value="noir">Noir (B&W)</option>
                      <option value="high-contrast">High Contrast</option>
                      <option value="color-wash-warm">Warm Tint</option>
                      <option value="color-wash-cool">Cool Tint</option>
                    </optgroup>
                    <optgroup label="Atmosphere">
                      <option value="rain">Rain</option>
                      <option value="particles">Floating Particles</option>
                      <option value="manga-tone">Manga Screentone</option>
                    </optgroup>
                  </select>
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-neutral-400 uppercase">Narration — English</label>
                    {activeScene.narration && (
                      <span className="text-[10px] text-neutral-500">{activeScene.narration.length} chars</span>
                    )}
                  </div>
                  <textarea
                    value={activeScene.narration || ''}
                    onChange={(e) => handleUpdateActiveScene('narration', e.target.value)}
                    rows={4}
                    placeholder="What the narrator explains during this scene…"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600 select-text"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-neutral-400 uppercase">Narration — हिन्दी (Hindi)</label>
                    <button
                      type="button"
                      onClick={handleTranslateToHindi}
                      disabled={translating || !activeScene.narration?.trim() || !canTranslate}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-40 flex items-center space-x-1"
                      title={canTranslate ? 'Translate the English narration to Hindi' : 'Set GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY to enable'}
                    >
                      {translating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                      <span>Translate EN → HI</span>
                    </button>
                  </div>
                  <textarea
                    value={activeScene.narrationHi || ''}
                    onChange={(e) => handleUpdateActiveScene('narrationHi', e.target.value)}
                    rows={4}
                    placeholder="हिन्दी कथन / Hindi narration…"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600 select-text"
                  />
                </div>
              </section>

              {/* Audio Upload & Microphone Voiceover */}
              <section>
                <label className="block text-[11px] font-semibold text-neutral-400 uppercase mb-1">Scene Audio (Voiceover)</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white cursor-pointer mb-2"
                />
                <div className="flex items-center space-x-3">
                  {isRecording ? (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 animate-pulse"
                    >
                      <div className="w-2.5 h-2.5 bg-white rounded-full" />
                      <span>Stop Recording</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={uploadingAudio}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Record Voiceover</span>
                    </button>
                  )}
                  {uploadingAudio && <span className="text-xs text-neutral-400">Uploading audio...</span>}
                </div>
                {(activeScene.audio?.url || activeScene.audio?.cloudinaryUrl) && (
                  <div className="mt-2 flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/50">
                    <Volume2 className="w-4 h-4" />
                    <span>
                      Audio attached: {activeScene.audio.format} ({activeScene.audio.duration}s)
                    </span>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {showPublishPanel && (
        <YouTubePublishPanel
          chapterId={chapterId}
          chapterTitle={chapter?.title}
          scenes={scenes}
          aspect={aspect}
          showSubtitles={showSubtitles}
          onClose={() => setShowPublishPanel(false)}
        />
      )}
    </div>
  );
}
