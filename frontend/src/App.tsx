import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Sparkles,
  Sliders,
  Plus,
  Layers,
  Film,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { SlideManager } from './components/SlideManager';
import { SubtitleInspector } from './components/SubtitleInspector';
import { AIGenerateModal } from './components/AIGenerateModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { AnimeLibraryModal } from './components/AnimeLibraryModal';
import { RemotionComposition } from './components/videoEditor/RemotionComposition';
import { Scene, VideoProject, ASPECT_RATIOS, DEFAULT_SUBTITLE_STYLE } from './types/video';
import { api } from './services/api';

const DEFAULT_SCENES: Scene[] = [
  {
    id: 'scene_1',
    slideNumber: 1,
    title: 'The Cyberpunk Metropolis',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1920&q=80',
    duration: 5,
    effect: 'kenburns',
    narration: 'Deep within the neon glow of Neo-Tokyo, shadows whispered secrets of tomorrow.',
    subtitles: [
      {
        id: 'sub_1_1',
        text: 'Deep within the neon glow of Neo-Tokyo...',
        startTime: 0.2,
        endTime: 2.8,
        style: { ...DEFAULT_SUBTITLE_STYLE },
      },
      {
        id: 'sub_1_2',
        text: 'Shadows whispered secrets of tomorrow.',
        startTime: 2.8,
        endTime: 4.8,
        style: { ...DEFAULT_SUBTITLE_STYLE },
      },
    ],
    audioClips: [],
  },
  {
    id: 'scene_2',
    slideNumber: 2,
    title: 'Echoes of the Past',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80',
    duration: 5,
    effect: 'pan-left',
    narration: 'Every tower reached for the stars, yet remained grounded in forgotten history.',
    subtitles: [
      {
        id: 'sub_2_1',
        text: 'Every tower reached for the stars...',
        startTime: 0.2,
        endTime: 4.8,
        style: { ...DEFAULT_SUBTITLE_STYLE },
      },
    ],
    audioClips: [],
  },
  {
    id: 'scene_3',
    slideNumber: 3,
    title: 'Dawn of Discovery',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80',
    duration: 5,
    effect: 'zoom-in',
    narration: 'A new dawn rises over the digital horizon.',
    subtitles: [
      {
        id: 'sub_3_1',
        text: 'A new dawn rises over the digital horizon.',
        startTime: 0.2,
        endTime: 4.8,
        style: { ...DEFAULT_SUBTITLE_STYLE },
      },
    ],
    audioClips: [],
  },
];

export default function App() {
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [scenes, setScenes] = useState<Scene[]>(DEFAULT_SCENES);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [projectTitle, setProjectTitle] = useState('Cyberpunk Chronicles');
  const [projectDesc, setProjectDesc] = useState('AI Generated Cinematic Storyboard');

  // Player state
  const playerRef = useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [isAnimeLibraryOpen, setIsAnimeLibraryOpen] = useState(false);
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [bgMusicUrl, setBgMusicUrl] = useState<string>('');

  // API Key & Backend status
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [backendStatus, setBackendStatus] = useState({
    status: 'checking',
    geminiConfigured: false,
    ffmpegAvailable: false,
  });

  const fps = 30;

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return scenes.reduce((sum, s) => sum + s.duration, 0);
  }, [scenes]);

  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  const isProjectInitialMount = useRef(true);

  // Check backend status and restore auto-saved project from MongoDB on mount
  useEffect(() => {
    api.getStatus().then((status) => {
      setBackendStatus(status);
    });

    // Auto-restore last saved project from MongoDB silently
    api.getCurrentProject().then((proj) => {
      if (proj && proj.scenes && proj.scenes.length > 0) {
        setScenes(proj.scenes);
        if (proj.title) setProjectTitle(proj.title);
        if (proj.description) setProjectDesc(proj.description);
        if (proj.aspectRatio) setAspectRatio(proj.aspectRatio);
        if (proj.bgMusicUrl) setBgMusicUrl(proj.bgMusicUrl);
      }
    }).catch(() => {});
  }, []);

  // Continuous silent auto-save of active studio project into MongoDB (no prompts or alerts)
  useEffect(() => {
    if (isProjectInitialMount.current) {
      isProjectInitialMount.current = false;
      return;
    }
    if (!scenes || scenes.length === 0) return;

    const timer = setTimeout(() => {
      api.saveCurrentProject({
        title: projectTitle,
        description: projectDesc,
        aspectRatio,
        fps,
        scenes,
        bgMusicUrl,
        totalDuration,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [scenes, projectTitle, projectDesc, aspectRatio, bgMusicUrl, totalDuration]);

  // Sync player timecode
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    let animId: number;
    const loop = () => {
      if (player) {
        setCurrentFrame(player.getCurrentFrame());
        setIsPlaying(player.isPlaying());
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, []);

  // Save API key
  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey);
  };

  // Play / Pause toggle
  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  };

  // Seek to specific frame or slide
  const seekToSlide = (slideIndex: number) => {
    setSelectedSceneIndex(slideIndex);
    const startSeconds = scenes.slice(0, slideIndex).reduce((sum, s) => sum + s.duration, 0);
    const targetFrame = Math.round(startSeconds * fps);
    playerRef.current?.seekTo(targetFrame);
  };

  // Scene CRUD
  const handleUpdateScene = (index: number, updated: Partial<Scene>) => {
    setScenes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updated };
      return next;
    });
  };

  const handleAddSlide = () => {
    const newScene: Scene = {
      id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      slideNumber: scenes.length + 1,
      title: `Scene ${scenes.length + 1}`,
      imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1920&q=80',
      duration: 5,
      effect: 'kenburns',
      narration: '',
      subtitles: [
        {
          id: `sub_${Date.now()}`,
          text: 'New Scene Caption',
          startTime: 0.5,
          endTime: 4.5,
          style: { ...DEFAULT_SUBTITLE_STYLE },
        },
      ],
      audioClips: [],
    };
    setScenes((prev) => [...prev, newScene]);
    setSelectedSceneIndex(scenes.length);
  };

  const handleDeleteSlide = (index: number) => {
    if (scenes.length <= 1) return;
    setScenes((prev) => prev.filter((_, i) => i !== index));
    setSelectedSceneIndex((prev) => Math.max(0, Math.min(prev, scenes.length - 2)));
  };

  const handleDuplicateSlide = (index: number) => {
    const target = scenes[index];
    const duplicated: Scene = {
      ...target,
      id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      slideNumber: scenes.length + 1,
      title: `${target.title || 'Scene'} (Copy)`,
    };
    const next = [...scenes];
    next.splice(index + 1, 0, duplicated);
    setScenes(next);
    setSelectedSceneIndex(index + 1);
  };

  const handleMoveSlide = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= scenes.length) return;
    const next = [...scenes];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setScenes(next);
    setSelectedSceneIndex(toIndex);
  };

  // AI Generated callback
  const handleAIGenerated = (newScenes: Scene[], title: string, description: string) => {
    setScenes(newScenes);
    setProjectTitle(title);
    setProjectDesc(description);
    setSelectedSceneIndex(0);
    playerRef.current?.seekTo(0);
  };

  // Anime Chapter Panels import callback
  const handleImportAnimeScenes = (
    newScenes: Scene[],
    title: string,
    description: string,
    globalAudioUrl?: string
  ) => {
    setScenes(newScenes);
    setProjectTitle(title);
    setProjectDesc(description);
    if (globalAudioUrl) {
      setBgMusicUrl(globalAudioUrl);
    }
    setSelectedSceneIndex(0);
    playerRef.current?.seekTo(0);
  };

  // Dimensions
  const currentDim = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['16:9'];
  const currentTimeSec = (currentFrame / fps).toFixed(1);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        onOpenAnimeLibrary={() => setIsAnimeLibraryOpen(true)}
        onOpenAIGenerator={() => setIsAIGeneratorOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        backendStatus={backendStatus}
      />

      {/* Main Studio Work Area */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 380px',
        gap: '16px',
        padding: '0 16px 16px 16px',
        alignItems: 'start',
      }}>
        {/* Left / Center Column: Video Player & Slide Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Player Container */}
          <div className="glass-panel" style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '440px',
            background: 'rgba(10, 13, 20, 0.85)',
          }}>
            {/* Aspect Ratio Box */}
            <div
              style={{
                width: '100%',
                maxWidth: aspectRatio === '9:16' ? '300px' : aspectRatio === '1:1' ? '460px' : '720px',
                aspectRatio: aspectRatio === '9:16' ? '9 / 16' : aspectRatio === '1:1' ? '1 / 1' : '16 / 9',
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), var(--shadow-glow)',
                border: '1px solid var(--border-color)',
                backgroundColor: '#000000',
                position: 'relative',
              }}
            >
              <Player
                ref={playerRef}
                component={RemotionComposition}
                inputProps={{ scenes, bgMusicUrl }}
                durationInFrames={totalFrames}
                compositionWidth={currentDim.width}
                compositionHeight={currentDim.height}
                fps={fps}
                style={{ width: '100%', height: '100%' }}
                controls={false}
                loop
              />
            </div>

            {/* Custom Playback Controls Bar */}
            <div style={{
              width: '100%',
              maxWidth: '720px',
              marginTop: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '8px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}>
              {/* Play / Pause / Replay */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn-icon"
                  onClick={togglePlay}
                  style={{
                    background: 'var(--grad-cyan-violet)',
                    color: '#ffffff',
                    border: 'none',
                    width: '36px',
                    height: '36px',
                  }}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <button
                  className="btn-icon"
                  onClick={() => playerRef.current?.seekTo(0)}
                  title="Replay from start"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              {/* Scrubber Slider */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '34px', fontFamily: 'monospace' }}>
                  {currentTimeSec}s
                </span>
                <input
                  type="range"
                  min="0"
                  max={totalFrames}
                  value={currentFrame}
                  onChange={(e) => playerRef.current?.seekTo(Number(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: 'var(--primary-cyan)',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '34px', fontFamily: 'monospace' }}>
                  {totalDuration.toFixed(1)}s
                </span>
              </div>

              {/* Mute & Fullscreen */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn-icon"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Slide Manager & Timeline Strip */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="var(--primary-cyan)" />
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Slideshow Timeline ({scenes.length} Scenes)
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Drag or click to navigate &bull; Total: {totalDuration}s
              </span>
            </div>

            <SlideManager
              scenes={scenes}
              selectedSceneIndex={selectedSceneIndex}
              onSelectScene={seekToSlide}
              onUpdateScene={handleUpdateScene}
              onAddSlide={handleAddSlide}
              onDeleteSlide={handleDeleteSlide}
              onDuplicateSlide={handleDuplicateSlide}
              onMoveSlide={handleMoveSlide}
              onOpenAnimeLibrary={() => setIsAnimeLibraryOpen(true)}
            />
          </div>
        </div>

        {/* Right Inspector Column: Subtitles, Narration, Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Project Overview Card */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Film size={18} color="var(--primary-violet)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                Storyboard Info
              </h3>
            </div>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Project Title"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '14px',
                marginBottom: '8px',
              }}
            />
            <textarea
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              placeholder="Short Description"
              rows={2}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                resize: 'none',
              }}
            />
          </div>

          {/* Subtitle & Narration Inspector for Selected Scene */}
          {scenes[selectedSceneIndex] && (
            <SubtitleInspector
              scene={scenes[selectedSceneIndex]}
              onUpdateScene={(updated) => handleUpdateScene(selectedSceneIndex, updated)}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <AIGenerateModal
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        onGenerated={handleAIGenerated}
        aspectRatio={aspectRatio}
        apiKey={apiKey}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={{
          id: 'proj_1',
          title: projectTitle,
          description: projectDesc,
          aspectRatio,
          fps,
          width: currentDim.width,
          height: currentDim.height,
          scenes,
          totalDuration,
          bgMusicUrl,
        }}
      />

      <AnimeLibraryModal
        isOpen={isAnimeLibraryOpen}
        onClose={() => setIsAnimeLibraryOpen(false)}
        onImportScenes={handleImportAnimeScenes}
        apiKey={apiKey}
        backendStatus={backendStatus}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        backendStatus={backendStatus}
      />
    </div>
  );
}
