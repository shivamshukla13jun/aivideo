import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { videoProjectService } from '../services/videoProjectService';
import { chapterService } from '../services/chapterService';
import { assetService } from '../services/assetService';
import { seriesService } from '../services/seriesService';
import { setAssets } from '../redux/slices/assetSlice';
import { setSeriesList, setSelectedSeries } from '../redux/slices/seriesSlice';
import { setChapters, setCurrentChapter } from '../redux/slices/chapterSlice';
import { setActiveChapterId, showNotification } from '../redux/slices/uiSlice';
import {
  setProject,
  setActiveTool,
  setPlayheadTime,
  setIsPlaying,
  setTimelineZoom,
  setSelectedClipId,
  setSelectedTrackId,
  toggleSnapping,
  updateProjectTracks,
  updateSelectedClipTransform,
  addClipToTrack,
  splitClipAtPlayhead,
  deleteSelectedClip,
  undoEditorState,
  redoEditorState,
  setRenderProgress,
  EditorTool
} from '../redux/slices/videoEditorSlice';
import { getSocket } from '../services/socketService';
import { VideoProject, Track, VideoClip, Keyframe, RenderProgressPayload, Page, Scene, GeneratedNarration, Asset } from '../types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Scissors,
  MousePointer,
  Hand,
  Type as TypeIcon,
  PenTool,
  ZoomIn,
  Magnet,
  Film,
  Video,
  Mic,
  Music,
  Volume2,
  Sparkles,
  Download,
  Sliders,
  Maximize2,
  Lock,
  Eye,
  EyeOff,
  VolumeX,
  Plus,
  X,
  Layers,
  ChevronRight,
  Clock,
  Sparkle
} from 'lucide-react';

export const VideoStudioView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentChapter, items: chapters } = useAppSelector((state) => state.chapter);
  const { items: assets } = useAppSelector((state) => state.asset);
  const {
    currentProject,
    activeTool,
    playheadTime,
    isPlaying,
    timelineZoom,
    selectedClipId,
    selectedTrackId,
    isSnappingEnabled,
    renderProgress,
    isRendering,
    autosavedAt
  } = useAppSelector((state) => state.videoEditor);

  const [activeMediaTab, setActiveMediaTab] = useState<'comic_page' | 'video' | 'narration' | 'bgm' | 'sfx' | 'graphic'>('comic_page');
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'transform' | 'effects' | 'audio' | 'text'>('transform');
  const [chapterPages, setChapterPages] = useState<Page[]>([]);
  const [chapterScenes, setChapterScenes] = useState<Scene[]>([]);
  const [chapterNarrations, setChapterNarrations] = useState<GeneratedNarration[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ id: string; data: string } | null>(null);
  const loadedChapterRef = useRef<string | null>(null);

  // Resolve which chapter to edit — if none is selected yet, load the first
  // available chapter so the studio always opens with content
  const ensuredChapterRef = useRef(false);
  useEffect(() => {
    if (ensuredChapterRef.current) return;
    ensuredChapterRef.current = true;

    const ensureChapter = async () => {
      if (currentChapter) return;
      if (chapters.length > 0) {
        dispatch(setCurrentChapter(chapters[0]));
        dispatch(setActiveChapterId(chapters[0].id));
        return;
      }
      try {
        const seriesList = await seriesService.getSeriesList();
        dispatch(setSeriesList(seriesList));
        const firstSeries = seriesList[0];
        if (!firstSeries) return;
        dispatch(setSelectedSeries(firstSeries));
        const data = await seriesService.getSeriesById(firstSeries.id);
        const chapterList = data.chapters || [];
        dispatch(setChapters(chapterList));
        if (chapterList[0]) {
          dispatch(setCurrentChapter(chapterList[0]));
          dispatch(setActiveChapterId(chapterList[0].id));
        }
      } catch (err) {
        console.error('Failed to resolve chapter for video studio:', err);
      }
    };
    ensureChapter();
  }, [currentChapter, chapters, dispatch]);

  // Load or create project for current chapter — always re-syncs so saved
  // scenes/pages are fetched and added to the timeline on open
  useEffect(() => {
    if (currentChapter && loadedChapterRef.current !== currentChapter.id) {
      loadedChapterRef.current = currentChapter.id;
      videoProjectService.getVideoProjects().then((projects) => {
        const found = projects.find((p) => p.chapterId === currentChapter.id);
        if (found) {
          videoProjectService.syncVideoProject(found.id)
            .then((synced) => dispatch(setProject(synced)))
            .catch(() => dispatch(setProject(found)));
        } else {
          // Auto generate project
          videoProjectService.createVideoProject({
            chapterId: currentChapter.id,
            title: `${currentChapter.title} - Video Edit`,
            autoGenerateFromChapter: true
          }).then((p) => {
            dispatch(setProject(p));
          });
        }
      }).catch(console.error);

      // Load chapter pages/scenes/narrations for the media bin
      chapterService.getChapterById(currentChapter.id).then((data) => {
        setChapterPages(data.pages || []);
        setChapterScenes(data.scenes || []);
        setChapterNarrations(data.narrations || []);
      }).catch(console.error);

      // Load user assets for the other media tabs
      assetService.getAssets().then((data) => {
        dispatch(setAssets(data));
      }).catch(console.error);
    }
  }, [currentChapter, dispatch]);

  // Real autosave: debounce project edits and persist them to the server
  useEffect(() => {
    if (!currentProject) return;
    const serialized = JSON.stringify(currentProject);

    if (lastSavedRef.current?.id !== currentProject.id) {
      lastSavedRef.current = { id: currentProject.id, data: serialized };
      return;
    }
    if (serialized === lastSavedRef.current.data) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      videoProjectService.updateVideoProject(currentProject.id, currentProject)
        .then(() => {
          lastSavedRef.current = { id: currentProject.id, data: serialized };
        })
        .catch((err) => console.error('Autosave failed:', err));
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [currentProject]);

  // Listen to Socket.io render events
  useEffect(() => {
    const socket = getSocket();

    const handleProgress = (data: RenderProgressPayload) => {
      dispatch(setRenderProgress(data));
    };

    const handleComplete = (data: RenderProgressPayload) => {
      dispatch(setRenderProgress(data));
      dispatch(showNotification({ message: 'Video render complete!', type: 'success' }));
    };

    socket.on('render:progress', handleProgress);
    socket.on('render:complete', handleComplete);

    return () => {
      socket.off('render:progress', handleProgress);
      socket.off('render:complete', handleComplete);
    };
  }, [dispatch]);

  // Playhead Animation Engine
  useEffect(() => {
    if (isPlaying) {
      let lastTime = performance.now();
      const updateFrame = (now: number) => {
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        dispatch(setPlayheadTime(playheadTime + delta));
        animationFrameRef.current = requestAnimationFrame(updateFrame);
      };
      animationFrameRef.current = requestAnimationFrame(updateFrame);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playheadTime, dispatch]);

  // Canvas Preview Monitor Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentProject) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const clipActive = (c: VideoClip) => playheadTime >= c.start && playheadTime < c.start + c.duration;

    // Tracks are ordered top-first (V5 -> V1): draw bottom-up so the topmost
    // visible track wins
    const visibleVideoTracks = currentProject.tracks
      .filter((t) => t.type === 'video' && !t.hidden)
      .reverse();

    // Render each active image/video clip onto the Canvas
    visibleVideoTracks.forEach((track) => {
      track.clips.filter(clipActive).forEach((clip) => {
        const src = clip.mediaUrl || clip.url;
        if (!src || clip.mediaType === 'text') return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;

        const renderClip = () => {
          if (!img.naturalWidth) return;
          ctx.save();

          const t = clip.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 };
          const posX = canvas.width / 2 + (t.x || 0);
          const posY = canvas.height / 2 + (t.y || 0);
          const fit = Math.min(canvas.width / img.width, canvas.height / img.height);
          const drawWidth = img.width * fit * (t.scaleX ?? 1);
          const drawHeight = img.height * fit * (t.scaleY ?? t.scaleX ?? 1);

          ctx.translate(posX, posY);
          ctx.rotate(((t.rotation || 0) * Math.PI) / 180);
          ctx.globalAlpha = t.opacity ?? 1;

          ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

          // Selection Highlight Border
          if (clip.id === selectedClipId) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 4;
            ctx.strokeRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          }

          ctx.restore();
        };

        if (img.complete && img.naturalWidth > 0) {
          renderClip();
        } else {
          img.onload = renderClip;
        }
      });
    });

    // Render active text/subtitle clips on top
    currentProject.tracks
      .filter((t) => t.type === 'text' && !t.hidden)
      .forEach((track) => {
        track.clips.filter(clipActive).forEach((clip) => {
          if (!clip.text) return;
          const s = clip.textStyle;
          const fontSize = s?.fontSize || 28;
          const lineHeight = fontSize * (s?.lineHeight || 1.3);
          const lines = String(clip.text).split('\n');
          const halfBlock = (lines.length * lineHeight) / 2;
          const centerY = Math.max(
            halfBlock + 16,
            Math.min(canvas.height - halfBlock - 16, canvas.height / 2 + (clip.transform?.y ?? 0))
          );
          const baseY = centerY - halfBlock + lineHeight / 2;

          ctx.save();
          ctx.font = `${s?.fontWeight || '600'} ${fontSize}px ${s?.fontFamily || 'Inter'}, sans-serif`;
          ctx.textAlign = (s?.align as CanvasTextAlign) || 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = clip.transform?.opacity ?? 1;

          lines.forEach((line, i) => {
            const ly = baseY + i * lineHeight;
            if (s?.backgroundColor) {
              const w = ctx.measureText(line).width + fontSize;
              ctx.fillStyle = s.backgroundColor;
              ctx.fillRect(canvas.width / 2 - w / 2, ly - lineHeight / 2, w, lineHeight);
            }
            ctx.fillStyle = s?.color || '#FFFFFF';
            ctx.fillText(line, canvas.width / 2, ly);
          });
          ctx.restore();
        });
      });

    // Timecode Overlay in Monitor
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, 10, 120, 24);
    ctx.fillStyle = '#6366f1';
    ctx.font = '12px monospace';
    ctx.fillText(formatTimecode(playheadTime), 20, 26);

  }, [currentProject, playheadTime, selectedClipId]);

  const formatTimecode = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  // Selected Clip Finder
  let activeSelectedClip: VideoClip | null = null;
  if (currentProject && selectedClipId) {
    for (const t of currentProject.tracks) {
      const found = t.clips.find((c) => c.id === selectedClipId);
      if (found) {
        activeSelectedClip = found;
        break;
      }
    }
  }

  // Media bin items: chapter pages feed the 'comic_page' tab and chapter
  // narrations feed the 'narration' tab; other tabs use uploaded user assets
  const mediaItems: Asset[] =
    activeMediaTab === 'comic_page'
      ? chapterPages.map((pg) => ({
          id: pg.id,
          userId: '',
          title: `Page ${pg.pageNumber}`,
          type: 'comic_page' as const,
          url: pg.imageUrl,
          fileUrl: pg.imageUrl,
          duration: chapterScenes.find((s) => s.pageId === pg.id)?.duration || 5,
          width: pg.width,
          height: pg.height,
          createdAt: pg.createdAt
        }))
      : activeMediaTab === 'narration'
      ? [
          ...chapterNarrations.map((nar) => ({
            id: nar.id,
            userId: '',
            title: `Chapter Narration (${Math.round(nar.duration)}s)`,
            type: 'narration' as const,
            url: nar.audioUrl,
            fileUrl: nar.audioUrl,
            duration: nar.duration,
            createdAt: nar.generatedAt
          })),
          ...assets.filter((a) => a.type === 'narration')
        ]
      : assets.filter((a) => a.type === activeMediaTab);

  // Automation: Auto Sync Scenes to Timeline — fetches latest saved pages,
  // scenes and narrations from the chapter and rebuilds auto tracks
  const handleAutoSyncScenes = async () => {
    if (!currentProject) return;

    try {
      const synced = await videoProjectService.syncVideoProject(currentProject.id);
      dispatch(setProject(synced));
      dispatch(showNotification({ message: 'Timeline synced with latest saved scenes & pages!', type: 'success' }));
    } catch (err: any) {
      dispatch(showNotification({ message: 'Sync failed: ' + err.message, type: 'error' }));
    }
  };

  // Start Render Command
  const handleStartRender = async () => {
    if (!currentProject) return;

    const socket = getSocket();
    await videoProjectService.startRender(currentProject.id, socket.id);
    setIsRenderModalOpen(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      {/* 1. Top Toolbar */}
      <div className="h-11 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between z-20 shrink-0">
        {/* Tool Selector Buttons */}
        <div className="flex items-center gap-1">
          {[
            { id: 'select', label: 'Select (V)', icon: MousePointer },
            { id: 'razor', label: 'Razor Split (C)', icon: Scissors },
            { id: 'hand', label: 'Hand (H)', icon: Hand },
            { id: 'text', label: 'Title Text (T)', icon: TypeIcon },
            { id: 'pen', label: 'Pen Mask (P)', icon: PenTool },
            { id: 'zoom', label: 'Zoom (Z)', icon: ZoomIn }
          ].map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => dispatch(setActiveTool(tool.id as EditorTool))}
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
                title={tool.label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* Undo / Redo / Snapping */}
          <button
            onClick={() => dispatch(undoEditorState())}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => dispatch(redoEditorState())}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            title="Redo (Ctrl+Y)"
          >
            <RotateCcw className="w-3.5 h-3.5 transform -scale-x-100" />
          </button>
          <button
            onClick={() => dispatch(toggleSnapping())}
            className={`p-1.5 rounded-lg transition-all ${
              isSnappingEnabled ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500'
            }`}
            title="Toggle Snapping (S)"
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Title & Autosave status */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-zinc-200">{currentProject?.title || 'Video Edit Project'}</span>
          {autosavedAt && (
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-500" /> Autosaved
            </span>
          )}
        </div>

        {/* Automation & Export Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoSyncScenes}
            className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" /> Webtoon Auto-Sync
          </button>
          <button
            onClick={handleStartRender}
            className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Download className="w-3.5 h-3.5" /> Render MP4 Video
          </button>
        </div>
      </div>

      {/* Main NLE Workspace (Top Half: Media Bin | Preview Monitor | Inspector) */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden border-b border-zinc-800">
        {/* 2. Media Bin Panel (Left 3 cols) */}
        <div className="col-span-3 border-r border-zinc-800 bg-zinc-900/60 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-indigo-400" /> Media Bin
            </h3>
          </div>

          {/* Media Tabs */}
          <div className="flex items-center gap-1 p-2 bg-zinc-950 border-b border-zinc-800 overflow-x-auto text-[11px]">
            {(['comic_page', 'video', 'narration', 'bgm', 'sfx', 'graphic'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveMediaTab(tab)}
                className={`px-2.5 py-1 rounded capitalize shrink-0 font-medium transition-all ${
                  activeMediaTab === tab
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Media Assets Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {mediaItems.map((asset) => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('assetJson', JSON.stringify(asset));
                }}
                className="p-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-2.5 cursor-grab active:cursor-grabbing transition-all group"
              >
                <div className="w-10 h-10 rounded bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                  {asset.type === 'comic_page' || asset.type === 'graphic' ? (
                    <img src={asset.fileUrl} alt={asset.title} draggable={false} className="w-full h-full object-cover" />
                  ) : asset.type === 'video' ? (
                    <Video className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Music className="w-5 h-5 text-pink-400" />
                  )}
                </div>
                <div className="truncate flex-1">
                  <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-300 truncate">
                    {asset.title}
                  </h4>
                  <p className="text-[10px] text-zinc-500">{asset.duration ? `${asset.duration}s` : 'Image'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Video Preview Monitor (Center 6 cols) */}
        <div className="col-span-6 bg-zinc-950 flex flex-col items-center justify-between p-4 overflow-hidden relative">
          {/* Canvas Monitor */}
          <div className="flex-1 w-full max-w-2xl flex items-center justify-center relative">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-auto aspect-video rounded-xl border border-zinc-800 shadow-2xl bg-black"
            />
          </div>

          {/* Playback Transport Controls */}
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => dispatch(setPlayheadTime(0))}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={() => dispatch(setIsPlaying(!isPlaying))}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                onClick={() => dispatch(setPlayheadTime(playheadTime + 5))}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="font-mono text-xs font-bold text-indigo-400 bg-zinc-950 px-3 py-1 rounded border border-zinc-800">
              {formatTimecode(playheadTime)}
            </div>

            {selectedClipId && (
              <button
                onClick={() => dispatch(splitClipAtPlayhead(selectedClipId))}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded flex items-center gap-1"
                title="Split selected clip at playhead position"
              >
                <Scissors className="w-3.5 h-3.5 text-indigo-400" /> Split
              </button>
            )}
          </div>
        </div>

        {/* 4. Inspector Panel (Right 3 cols) */}
        <div className="col-span-3 border-l border-zinc-800 bg-zinc-900/60 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Inspector
            </h3>
          </div>

          {/* Inspector Tabs */}
          <div className="flex items-center justify-between p-2 bg-zinc-950 border-b border-zinc-800 text-xs">
            {(['transform', 'effects', 'audio', 'text'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveInspectorTab(tab)}
                className={`px-2 py-1 rounded capitalize font-medium transition-all ${
                  activeInspectorTab === tab ? 'bg-indigo-600 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Inspector Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!activeSelectedClip ? (
              <p className="text-xs text-zinc-500 text-center py-10">Select a clip on the timeline to inspect properties.</p>
            ) : activeInspectorTab === 'transform' ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">Scale: {activeSelectedClip.transform.scale ?? activeSelectedClip.transform.scaleX ?? 100}%</label>
                  <input
                    type="range"
                    min={10}
                    max={300}
                    value={activeSelectedClip.transform.scale ?? activeSelectedClip.transform.scaleX ?? 100}
                    onChange={(e) =>
                      dispatch(updateSelectedClipTransform({ scale: parseFloat(e.target.value), scaleX: parseFloat(e.target.value), scaleY: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Opacity: {activeSelectedClip.transform.opacity}%</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={activeSelectedClip.transform.opacity}
                    onChange={(e) =>
                      dispatch(updateSelectedClipTransform({ opacity: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Rotation: {activeSelectedClip.transform.rotation}°</label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={activeSelectedClip.transform.rotation}
                    onChange={(e) =>
                      dispatch(updateSelectedClipTransform({ rotation: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                  <div>
                    <label className="block text-zinc-400 mb-1">Pos X</label>
                    <input
                      type="number"
                      value={activeSelectedClip.transform.x}
                      onChange={(e) =>
                        dispatch(updateSelectedClipTransform({ x: parseFloat(e.target.value) || 0 }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Pos Y</label>
                    <input
                      type="number"
                      value={activeSelectedClip.transform.y}
                      onChange={(e) =>
                        dispatch(updateSelectedClipTransform({ y: parseFloat(e.target.value) || 0 }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                    />
                  </div>
                </div>

                <button
                  onClick={() => dispatch(deleteSelectedClip())}
                  className="w-full py-2 bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-500/30 rounded-lg font-semibold flex items-center justify-center gap-1.5"
                >
                  Delete Selected Clip
                </button>
              </div>
            ) : (
              <div className="text-xs text-zinc-400 space-y-2">
                <p>Stackable Effects &amp; Audio Processing enabled.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Multi-Track Timeline Panel (Bottom Half) */}
      <div className="h-64 bg-zinc-950 flex flex-col overflow-hidden relative border-t border-zinc-800">
        {/* Timeline Ruler Header */}
        <div className="h-7 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between z-10 shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Multi-Track Timeline (V1-V5, A1-A4)
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-500">Zoom</span>
            <input
              type="range"
              min={10}
              max={200}
              value={timelineZoom}
              onChange={(e) => dispatch(setTimelineZoom(parseInt(e.target.value)))}
              className="w-24 accent-indigo-500"
            />
          </div>
        </div>

        {/* Multi-Track Canvas & Clips */}
        <div className="flex-1 overflow-y-auto overflow-x-auto relative bg-zinc-950">
          {/* Playhead Vertical Red Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none"
            style={{ left: `${160 + playheadTime * timelineZoom}px` }}
          >
            <div className="w-3 h-3 bg-rose-500 rotate-45 -ml-1.25 -mt-1" />
          </div>

          {/* Render Track Headers & Tracks */}
          {currentProject?.tracks.map((track) => (
            <div key={track.id} className="h-12 border-b border-zinc-800/80 flex items-center relative">
              {/* Track Left Header (Fixed 160px) */}
              <div className="w-40 h-full bg-zinc-900 border-r border-zinc-800 px-3 flex items-center justify-between shrink-0 sticky left-0 z-20">
                <span className="text-xs font-bold text-zinc-200">{track.name}</span>
                <div className="flex items-center gap-1 text-zinc-500">
                  <button
                    onClick={() => {
                      const updated = currentProject.tracks.map((t) =>
                        t.id === track.id ? { ...t, hidden: !t.hidden } : t
                      );
                      dispatch(updateProjectTracks(updated));
                    }}
                  >
                    {track.hidden ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      const updated = currentProject.tracks.map((t) =>
                        t.id === track.id ? { ...t, locked: !t.locked } : t
                      );
                      dispatch(updateProjectTracks(updated));
                    }}
                  >
                    <Lock className={`w-3.5 h-3.5 ${track.locked ? 'text-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Track Timeline Area */}
              <div
                className="flex-1 h-full relative bg-zinc-950/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const assetJson = e.dataTransfer.getData('assetJson');
                  if (assetJson) {
                    const asset = JSON.parse(assetJson);
                    const newClip: VideoClip = {
                      id: `clp_${Date.now()}`,
                      trackId: track.id,
                      title: asset.title,
                      mediaUrl: asset.fileUrl,
                      url: asset.fileUrl,
                      type: track.type,
                      start: playheadTime,
                      duration: asset.duration || 5,
                      transform: { x: 0, y: 0, scale: 100, scaleX: 1.0, scaleY: 1.0, rotation: 0, opacity: 100 },
                      keyframes: [],
                      effects: []
                    };
                    dispatch(addClipToTrack({ trackId: track.id, clip: newClip }));
                  }
                }}
              >
                {/* Clips rendered on track */}
                {track.clips.map((clip) => {
                  const isSelected = clip.id === selectedClipId;
                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(setSelectedClipId(clip.id));
                        dispatch(setSelectedTrackId(track.id));
                      }}
                      className={`absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between text-xs font-semibold cursor-pointer border shadow-sm transition-all overflow-hidden ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/50 z-10'
                          : track.type === 'video'
                          ? 'bg-indigo-950/80 text-indigo-200 border-indigo-800'
                          : 'bg-purple-950/80 text-purple-200 border-purple-800'
                      }`}
                      style={{
                        left: `${clip.start * timelineZoom}px`,
                        width: `${clip.duration * timelineZoom}px`
                      }}
                    >
                      <span className="truncate">{clip.title}</span>
                      <span className="text-[9px] opacity-75 font-mono">{clip.duration}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Render MP4 Export Modal */}
      {isRenderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                FFmpeg Video Render &amp; Export Pipeline
              </h3>
              <button onClick={() => setIsRenderModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderProgress && renderProgress.status === 'rendering' ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                  <span>Rendering Webtoon Cinematic Video...</span>
                  <span className="text-indigo-400 font-bold">{renderProgress.progress}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${renderProgress.progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-400 text-center">
                  Scene {renderProgress.currentScene || 1} / {renderProgress.totalScenes || 5} | FFmpeg encoding MP4...
                </p>
              </div>
            ) : renderProgress && renderProgress.status === 'complete' ? (
              <div className="space-y-4 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Sparkle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-zinc-100">Render Complete!</h4>
                <a
                  href={renderProgress.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-600/30"
                >
                  <Download className="w-4 h-4" /> Download Rendered MP4
                </a>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-zinc-300">
                  Ready to compile timeline into a production MP4 video file.
                </p>
                <button
                  onClick={handleStartRender}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <Play className="w-4 h-4" /> Start Rendering Pipeline
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
