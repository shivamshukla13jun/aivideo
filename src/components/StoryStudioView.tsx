import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { scriptService } from '../services/scriptService';
import { setStory, updateStoryContent } from '../redux/slices/scriptSlice';
import { useNavigate } from 'react-router-dom';
import { showNotification } from '../redux/slices/uiSlice';
import {
  FileText,
  Sparkles,
  Save,
  RotateCcw,
  History,
  CheckCircle2,
  Mic,
  ArrowRight
} from 'lucide-react';

export const StoryStudioView: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentChapter } = useAppSelector((state) => state.chapter);
  const { currentStory } = useAppSelector((state) => state.script);

  const [editorText, setEditorText] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  useEffect(() => {
    if (currentChapter) {
      scriptService.getStoryByChapter(currentChapter.id).then((story) => {
        dispatch(setStory(story));
        if (story) {
          setEditorText(story.content);
        }
      }).catch(console.error);
    }
  }, [currentChapter, dispatch]);

  const handleBuildCompleteStory = async () => {
    if (!currentChapter) return;

    try {
      const generatedStory = await scriptService.buildCompleteStory(currentChapter.id);
      dispatch(setStory(generatedStory));
      setEditorText(generatedStory.content);
      dispatch(showNotification({ message: 'Combined scene scripts into complete chapter story!', type: 'success' }));
    } catch (err: any) {
      dispatch(showNotification({ message: 'Error: ' + err.message, type: 'error' }));
    }
  };

  const handleSaveStory = async () => {
    if (!currentChapter) return;

    try {
      const saved = await scriptService.saveStory(currentChapter.id, editorText, 'saved');
      dispatch(setStory(saved));
      dispatch(showNotification({ message: 'Chapter story saved successfully!', type: 'success' }));
    } catch (err: any) {
      dispatch(showNotification({ message: 'Save error: ' + err.message, type: 'error' }));
    }
  };

  const handleRestoreVersion = async (vNum: number) => {
    if (!currentChapter) return;

    try {
      const restored = await scriptService.restoreStoryVersion(currentChapter.id, vNum);
      dispatch(setStory(restored));
      setEditorText(restored.content);
      setSelectedVersion(vNum);
      dispatch(showNotification({ message: `Restored script version ${vNum}.`, type: 'info' }));
    } catch (err: any) {
      dispatch(showNotification({ message: 'Restore error: ' + err.message, type: 'error' }));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Complete Chapter Story Studio
          </h1>
          <p className="text-xs text-zinc-400">
            Current Chapter: <span className="text-indigo-300 font-semibold">{currentChapter?.title || 'Chapter 1'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleBuildCompleteStory}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Sparkles className="w-4 h-4" /> Build Complete Story
          </button>
          <button
            onClick={handleSaveStory}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            <Save className="w-4 h-4" /> Save Script Draft
          </button>
          <button
            onClick={() => navigate('/voice')}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all border border-zinc-700"
          >
            <Mic className="w-4 h-4 text-pink-400" /> Reference Voice <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Studio Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Text Editor */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <span className="text-xs font-semibold text-zinc-300">Chapter Complete Narrative Script</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {editorText.split(/\s+/).filter(Boolean).length} Words | {editorText.length} Characters
            </span>
          </div>

          <textarea
            rows={18}
            value={editorText}
            onChange={(e) => {
              setEditorText(e.target.value);
              dispatch(updateStoryContent(e.target.value));
            }}
            placeholder="Click 'Build Complete Story' above to assemble all page scene scripts into a narrative chapter story..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
          />
        </div>

        {/* Version History Sidebar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            Script Version History
          </h3>

          {!currentStory || currentStory.versions.length === 0 ? (
            <p className="text-xs text-zinc-500">No previous versions saved yet.</p>
          ) : (
            <div className="space-y-2">
              {currentStory.versions.map((ver) => (
                <div
                  key={ver.version}
                  className={`p-3 rounded-xl border text-xs transition-all space-y-1.5 ${
                    selectedVersion === ver.version
                      ? 'bg-indigo-900/30 border-indigo-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-400">Version {ver.version}</span>
                    <button
                      onClick={() => handleRestoreVersion(ver.version)}
                      className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-indigo-600 text-zinc-300 hover:text-white flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(ver.updatedAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
