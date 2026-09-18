import React, { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { chapterService } from '../services/chapterService';
import { sceneService } from '../services/sceneService';
import { setCurrentChapter } from '../redux/slices/chapterSlice';
import { setScenes, addSceneItem, updateSceneItem, removeSceneItem } from '../redux/slices/sceneSlice';
import { setZoom, setFitWidth, setIsFullscreen, openSceneDrawerForPage, closeSceneDrawer } from '../redux/slices/readerSlice';
import { useNavigate } from 'react-router-dom';
import { setActiveChapterId, showNotification } from '../redux/slices/uiSlice';
import { setRenderProgress } from '../redux/slices/videoEditorSlice';
import { videoProjectService } from '../services/videoProjectService';
import { getSocket } from '../services/socketService';
import { Scene, Page, RenderProgressPayload } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  X,
  FileText,
  Sparkles,
  Save,
  Copy,
  SlidersHorizontal,
  BookOpen,
  RotateCcw,
  AlertCircle,
  Wand2,
  Download,
  Film
} from 'lucide-react';

export const ReaderView: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentChapter, items: chapters } = useAppSelector((state) => state.chapter);
  const { items: scenes } = useAppSelector((state) => state.scene);
  const { zoom, fitWidth, isFullscreen, showSceneDrawer, activePageIdForScene } = useAppSelector((state) => state.reader);
  const { renderProgress } = useAppSelector((state) => state.videoEditor);

  const [chapterPages, setChapterPages] = useState<Page[]>([]);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [exportingSceneId, setExportingSceneId] = useState<string | null>(null);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const [sceneForm, setSceneForm] = useState({
    sceneNumber: 1,
    characters: 'Jin, Mr. Song',
    narration: 'Deep beneath the city streets, an unranked gate opened into a pitch black cavern.',
    dialogue: 'Mr. Song: "Keep your eyes sharp, everyone."',
    emotion: 'Tension',
    duration: 6
  });

  // Load chapter pages & scenes
  const loadChapterData = useCallback(async (chapterId: string) => {
    setIsLoading(true);
    try {
      const data = await chapterService.getChapterById(chapterId);
      setChapterPages(data.pages || []);
      dispatch(setScenes(data.scenes || []));
      setFailedImages({});
    } catch (err) {
      console.error('Failed to load chapter data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (currentChapter) {
      loadChapterData(currentChapter.id);
    } else if (chapters.length > 0) {
      dispatch(setCurrentChapter(chapters[0]));
      dispatch(setActiveChapterId(chapters[0].id));
    }
  }, [currentChapter, chapters, loadChapterData, dispatch]);

  // Real-time socket listener to update reader when upload completes
  useEffect(() => {
    const socket = getSocket();

    const handleUploadComplete = (data: any) => {
      if (currentChapter && (data.chapterId === currentChapter.id || !data.chapterId)) {
        loadChapterData(currentChapter.id);
      }
    };

    socket.on('chapter-upload:complete', handleUploadComplete);
    return () => {
      socket.off('chapter-upload:complete', handleUploadComplete);
    };
  }, [currentChapter, loadChapterData]);

  // Listen for video render progress so per-scene exports work inside the reader
  useEffect(() => {
    const socket = getSocket();

    const handleRenderEvent = (data: RenderProgressPayload) => {
      dispatch(setRenderProgress(data));
      if (data.status === 'complete') {
        dispatch(showNotification({ message: 'Scene video render complete!', type: 'success' }));
      }
    };

    socket.on('render:progress', handleRenderEvent);
    socket.on('render:complete', handleRenderEvent);
    return () => {
      socket.off('render:progress', handleRenderEvent);
      socket.off('render:complete', handleRenderEvent);
    };
  }, [dispatch]);

  const handleOpenAddScene = (pageId: string) => {
    dispatch(openSceneDrawerForPage(pageId));
    setEditingScene(null);
    setSceneForm({
      sceneNumber: scenes.length + 1,
      characters: '',
      narration: '',
      dialogue: '',
      emotion: 'Tension',
      duration: 5
    });
  };

  const handleOpenEditScene = (scene: Scene) => {
    dispatch(openSceneDrawerForPage(scene.pageId));
    setEditingScene(scene);
    setSceneForm({
      sceneNumber: scene.sceneNumber,
      characters: scene.characters.join(', '),
      narration: scene.narration,
      dialogue: scene.dialogue,
      emotion: scene.emotion,
      duration: scene.duration
    });
  };

  const handleSaveScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChapter || !activePageIdForScene) return;

    const charsArray = sceneForm.characters.split(',').map((c) => c.trim()).filter(Boolean);

    if (editingScene) {
      const updated = await sceneService.updateScene(editingScene.id, {
        chapterId: currentChapter.id,
        pageId: activePageIdForScene,
        sceneNumber: sceneForm.sceneNumber,
        characters: charsArray,
        narration: sceneForm.narration,
        dialogue: sceneForm.dialogue,
        emotion: sceneForm.emotion,
        duration: sceneForm.duration
      });
      dispatch(updateSceneItem(updated));
      dispatch(showNotification({ message: `Scene ${updated.sceneNumber} updated.`, type: 'success' }));
    } else {
      const created = await sceneService.createScene({
        chapterId: currentChapter.id,
        pageId: activePageIdForScene,
        sceneNumber: sceneForm.sceneNumber,
        characters: charsArray,
        narration: sceneForm.narration,
        dialogue: sceneForm.dialogue,
        emotion: sceneForm.emotion,
        duration: sceneForm.duration
      });
      dispatch(addSceneItem(created));
      dispatch(showNotification({ message: `Scene ${created.sceneNumber} created.`, type: 'success' }));
    }

    dispatch(closeSceneDrawer());
  };

  const handleDeleteScene = async (sceneId: string) => {
    await sceneService.deleteScene(sceneId);
    dispatch(removeSceneItem(sceneId));
    dispatch(showNotification({ message: 'Scene deleted.', type: 'info' }));
  };

  // AI: OCR the attached page image and auto-fill the scene form (Hindi output)
  const handleAiExtract = async () => {
    const page = chapterPages.find((p) => p.id === activePageIdForScene);
    if (!page) {
      dispatch(showNotification({ message: 'No page image attached to this scene.', type: 'error' }));
      return;
    }

    setIsExtracting(true);
    try {
      const extracted = await sceneService.aiExtractScene({ imageUrl: page.imageUrl });
      setSceneForm((prev) => ({
        ...prev,
        characters: extracted.characters.join(', '),
        narration: extracted.narration,
        dialogue: extracted.dialogue,
        emotion: extracted.emotion,
        duration: extracted.duration
      }));
      dispatch(showNotification({ message: 'AI extracted scene script in Hindi!', type: 'success' }));
    } catch (err: any) {
      dispatch(showNotification({ message: 'AI extraction failed: ' + err.message, type: 'error' }));
    } finally {
      setIsExtracting(false);
    }
  };

  // Export a rendered video for this scene — works even if the chapter isn't fully read
  const handleExportSceneVideo = async (scene: Scene) => {
    if (!currentChapter) return;

    setExportingSceneId(scene.id);
    try {
      const projects = await videoProjectService.getVideoProjects();
      let project = projects.find((p) => p.chapterId === currentChapter.id);
      if (!project) {
        project = await videoProjectService.createVideoProject({
          chapterId: currentChapter.id,
          title: `${currentChapter.title} - Video Edit`,
          autoGenerateFromChapter: true
        });
      }

      dispatch(setRenderProgress(null));
      const socket = getSocket();
      await videoProjectService.startRender(project.id, socket.id);
      setIsRenderModalOpen(true);
    } catch (err: any) {
      dispatch(showNotification({ message: 'Export error: ' + err.message, type: 'error' }));
    } finally {
      setExportingSceneId(null);
    }
  };

  // Chapter Navigation
  const currentChapterIdx = chapters.findIndex((c) => c.id === currentChapter?.id);
  const prevChapter = currentChapterIdx > 0 ? chapters[currentChapterIdx - 1] : null;
  const nextChapter = currentChapterIdx < chapters.length - 1 ? chapters[currentChapterIdx + 1] : null;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden relative">
      {/* Reader Control Bar */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 flex items-center justify-between z-20 shrink-0 select-none gap-2">
        <div className="flex items-center gap-3">
          {/* Chapter Selector Dropdown */}
          <select
            value={currentChapter?.id || ''}
            onChange={(e) => {
              const selected = chapters.find((c) => c.id === e.target.value);
              if (selected) {
                dispatch(setCurrentChapter(selected));
                dispatch(setActiveChapterId(selected.id));
              }
            }}
            className="bg-zinc-950 border border-zinc-800 text-indigo-300 font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[180px] sm:max-w-xs truncate"
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                Ch. {ch.chapterNumber}: {ch.title}
              </option>
            ))}
          </select>

          <span className="text-[11px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 whitespace-nowrap">
            {chapterPages.length} Pages
          </span>

          <button
            onClick={() => currentChapter && loadChapterData(currentChapter.id)}
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Reload Pages"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

        {/* Reader Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch(setZoom(zoom - 15))}
            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-zinc-400 w-12 text-center">{zoom}%</span>
          <button
            onClick={() => dispatch(setZoom(zoom + 15))}
            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => dispatch(setFitWidth(!fitWidth))}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              fitWidth ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            Fit Width
          </button>

          <button
            onClick={() => dispatch(setIsFullscreen(!isFullscreen))}
            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => navigate('/story-studio')}
            className="ml-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
          >
            <FileText className="w-3.5 h-3.5" /> Build Complete Story ({scenes.length} Scenes)
          </button>
        </div>
      </div>

      {/* Reader Body & Webtoon Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Vertical Scroll Canvas */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center gap-6 scroll-smooth">
          {isLoading && chapterPages.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <RotateCcw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs text-zinc-400">Loading chapter comic pages...</p>
            </div>
          ) : chapterPages.length === 0 ? (
            <div className="py-20 text-center space-y-3 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 max-w-md">
              <BookOpen className="w-10 h-10 text-zinc-500 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-200">No pages found in this chapter</h3>
              <p className="text-xs text-zinc-400">
                Upload your CBZ comic archive or image files to start reading and extracting scenes.
              </p>
              <button
                onClick={() => navigate('/chapters')}
                className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Upload CBZ / Images
              </button>
            </div>
          ) : (
            chapterPages.map((page) => {
              const pageScenes = scenes.filter((s) => s.pageId === page.id);
              const isImageFailed = failedImages[page.id];

              return (
                <div
                  key={page.id}
                  className="relative group shrink-0 border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-900 shadow-2xl transition-all"
                  style={{
                    width: fitWidth ? '100%' : `${zoom}%`,
                    maxWidth: '800px'
                  }}
                >
                  {/* Page Image */}
                  {isImageFailed ? (
                    <div className="py-16 px-4 flex flex-col items-center justify-center text-center bg-zinc-950/90">
                      <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                      <p className="text-xs text-zinc-200 font-semibold">Page {page.pageNumber} failed to render</p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1 break-all max-w-md">{page.imageUrl}</p>
                      <button
                        onClick={() => setFailedImages((prev) => ({ ...prev, [page.id]: false }))}
                        className="mt-3 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-md"
                      >
                        Retry Loading Page
                      </button>
                    </div>
                  ) : (
                    <img
                      src={page.imageUrl}
                      alt={`Page ${page.pageNumber}`}
                      loading="lazy"
                      onError={() => setFailedImages((prev) => ({ ...prev, [page.id]: true }))}
                      className="w-full h-auto block select-none"
                    />
                  )}

                  {/* Page Overlay Bar */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80 backdrop-blur-md p-2 rounded-lg border border-zinc-800">
                    <span className="text-xs font-mono font-bold text-indigo-400">Page {page.pageNumber}</span>
                    <button
                      onClick={() => handleOpenAddScene(page.id)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-all shadow-md shadow-indigo-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Scene
                    </button>
                  </div>

                  {/* Scene Markers Attached to Page */}
                  {pageScenes.length > 0 && (
                    <div className="p-3 bg-zinc-950/90 border-t border-zinc-800/80 space-y-2">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Attached Scenes ({pageScenes.length})
                      </div>
                      <div className="space-y-1.5">
                        {pageScenes.map((scn) => (
                          <div
                            key={scn.id}
                            className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-indigo-300">Scene {scn.sceneNumber}</span>
                                {scn.emotion && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {scn.emotion}
                                  </span>
                                )}
                                <span className="text-[9px] text-zinc-500">{scn.duration}s</span>
                              </div>
                              {scn.narration && (
                                <p className="text-zinc-300 text-[11px] italic">"{scn.narration}"</p>
                              )}
                              {scn.dialogue && (
                                <p className="text-indigo-200 text-[11px] font-medium">{scn.dialogue}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleExportSceneVideo(scn)}
                                disabled={exportingSceneId === scn.id}
                                className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 disabled:opacity-50"
                                title="Export this scene as a rendered video"
                              >
                                <Film className={`w-3 h-3 ${exportingSceneId === scn.id ? 'animate-pulse' : ''}`} />
                                {exportingSceneId === scn.id ? 'Exporting' : 'Export'}
                              </button>
                              <button
                                onClick={() => handleOpenEditScene(scn)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteScene(scn.id)}
                                className="p-1 rounded text-zinc-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Chapter Navigation Buttons */}
          <div className="flex items-center justify-between w-full max-w-2xl py-8 shrink-0">
            <button
              disabled={!prevChapter}
              onClick={() => prevChapter && dispatch(setCurrentChapter(prevChapter))}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-zinc-200 flex items-center gap-2 border border-zinc-800"
            >
              <ChevronLeft className="w-4 h-4" /> Previous Chapter
            </button>
            <button
              disabled={!nextChapter}
              onClick={() => nextChapter && dispatch(setCurrentChapter(nextChapter))}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              Next Chapter <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Scene Drawer */}
      {showSceneDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-zinc-900 border-l border-zinc-800 p-6 shadow-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                {editingScene ? 'Edit Scene Script' : 'Add Scene Narration Script'}
              </h3>
              <button onClick={() => dispatch(closeSceneDrawer())} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAiExtract}
              disabled={isExtracting}
              className="w-full py-2.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 disabled:opacity-50 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Wand2 className={`w-4 h-4 ${isExtracting ? 'animate-pulse' : ''}`} />
              {isExtracting ? 'AI Reading Page Image...' : 'AI Extract Text from Page (Hindi)'}
            </button>
            <p className="text-[10px] text-zinc-500 -mt-2">
              Uses Gemini to OCR the page and auto-fill narration, dialogue, characters, emotion &amp; duration in Hindi.
            </p>

            <form onSubmit={handleSaveScene} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Scene Number</label>
                  <input
                    type="number"
                    value={sceneForm.sceneNumber}
                    onChange={(e) => setSceneForm({ ...sceneForm, sceneNumber: parseInt(e.target.value) || 1 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Duration (seconds)</label>
                  <input
                    type="number"
                    value={sceneForm.duration}
                    onChange={(e) => setSceneForm({ ...sceneForm, duration: parseInt(e.target.value) || 5 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Characters Involved</label>
                <input
                  type="text"
                  placeholder="e.g. Jin, Master"
                  value={sceneForm.characters}
                  onChange={(e) => setSceneForm({ ...sceneForm, characters: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Narration Script</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Jin slowly walked toward the mysterious gate."
                  value={sceneForm.narration}
                  onChange={(e) => setSceneForm({ ...sceneForm, narration: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Dialogue</label>
                <textarea
                  rows={2}
                  placeholder='e.g. Master: "Do not enter that gate."'
                  value={sceneForm.dialogue}
                  onChange={(e) => setSceneForm({ ...sceneForm, dialogue: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Emotion / Tone</label>
                <select
                  value={sceneForm.emotion}
                  onChange={(e) => setSceneForm({ ...sceneForm, emotion: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Tension">Tension</option>
                  <option value="Awe & Dread">Awe &amp; Dread</option>
                  <option value="Terror">Terror</option>
                  <option value="Dramatic">Dramatic</option>
                  <option value="Calm">Calm</option>
                  <option value="Action">Action</option>
                </select>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => dispatch(closeSceneDrawer())}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Scene
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scene Video Export Modal */}
      {isRenderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                Scene Video Export
              </h3>
              <button onClick={() => setIsRenderModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderProgress && renderProgress.status === 'complete' ? (
              <div className="space-y-4 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
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
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                  <span>Rendering scene video...</span>
                  <span className="text-indigo-400 font-bold">{renderProgress?.progress || 0}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${renderProgress?.progress || 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-400 text-center">
                  Scene {renderProgress?.currentScene || 1} / {renderProgress?.totalScenes || 1} | Encoding MP4...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
