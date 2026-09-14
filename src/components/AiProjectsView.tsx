import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Film,
  Trash2,
  Clock,
  MessageSquare,
  Users,
  AlertCircle,
  FileText,
  Volume2,
  RefreshCw,
  Eye,
  ArrowLeft,
  X,
} from 'lucide-react';
import { WebtoonScript, Manga, Chapter } from '../types.js';

interface AiProjectsViewProps {
  onOpenReader: (mangaId: number, chapterId: number) => void;
  onOpenVideoStudio: (mangaId: number, chapterId: number) => void;
  onNavigateToLibrary?: () => void;
}

export const AiProjectsView: React.FC<AiProjectsViewProps> = ({
  onOpenReader,
  onOpenVideoStudio,
  onNavigateToLibrary,
}) => {
  const [projects, setProjects] = useState<WebtoonScript[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStoryModal, setSelectedStoryModal] = useState<WebtoonScript | null>(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/ai/saved-projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data || []);
      }
    } catch (err) {
      console.error('Error fetching AI projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDeleteProject = async (mangaId: number, chapterId: number) => {
    if (!window.confirm('Are you sure you want to delete this saved AI subtitle project from DB?')) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/ai/saved-projects/${mangaId}/${chapterId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => !(p.mangaId === mangaId && p.chapterId === chapterId)));
      }
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/60 via-zinc-900 to-zinc-950 border border-amber-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onNavigateToLibrary && (
            <button
              id="btn-ai-projects-back-library"
              onClick={onNavigateToLibrary}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0"
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span>Back</span>
            </button>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Sparkles className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">AI Ongoing Work & Database Projects</h1>
            </div>
            <p className="text-xs text-amber-200/80 max-w-2xl leading-relaxed">
              All manga chapters with saved AI Webtoon Scripts, extracted panel subtitles, custom character voiceovers, and persistent database entries.
            </p>
          </div>
        </div>

        <button
          onClick={fetchProjects}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold flex items-center gap-2 border border-amber-500/30 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="p-12 text-center text-zinc-400 space-y-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/80">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs font-medium">Loading saved AI projects from database...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center text-zinc-400 space-y-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/80">
          <AlertCircle className="w-10 h-10 text-amber-500/50 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-200">No Saved AI Projects Yet</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Open any manga chapter in the reader and toggle "✨ AI Subtitles" to generate and save your first webtoon script and Hindi subtitles!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const activePanelsCount = proj.panels?.filter((p) => !p.skipped)?.length || 0;
            const skippedPanelsCount = proj.panels?.filter((p) => p.skipped)?.length || 0;

            return (
              <div
                key={`${proj.mangaId}_${proj.chapterId}`}
                className="bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-amber-500/60 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-3">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                        AI DB Saved
                      </span>
                      <h3 className="font-bold text-sm text-white mt-1 line-clamp-1">{proj.mangaTitle}</h3>
                      <p className="text-xs text-zinc-400">{proj.chapterName}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteProject(proj.mangaId, proj.chapterId)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/50 transition-all cursor-pointer"
                      title="Delete from DB"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Badges / Stats */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-medium">
                    <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-300 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                      <span>{activePanelsCount} Panel Dialogues</span>
                    </div>

                    <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{proj.characters?.length || 0} Characters</span>
                    </div>
                  </div>

                  {/* Story Summary Preview */}
                  <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-semibold text-amber-300">Overall Story Summary</span>
                      <button
                        onClick={() => setSelectedStoryModal(proj)}
                        className="text-amber-400 hover:underline flex items-center gap-1 text-[10px] cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Full</span>
                      </button>
                    </div>
                    <p className="text-xs text-zinc-300 line-clamp-2 italic leading-relaxed">
                      "{proj.overallStory || 'No story summary available.'}"
                    </p>
                  </div>

                  {skippedPanelsCount > 0 && (
                    <p className="text-[11px] text-rose-400/80">
                      ⚠️ {skippedPanelsCount} panels marked as skipped from narration.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => onOpenReader(proj.mangaId, proj.chapterId)}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Read AI Subtitles</span>
                  </button>

                  <button
                    onClick={() => onOpenVideoStudio(proj.mangaId, proj.chapterId)}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video Studio</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Story Summary Modal Popup */}
      {selectedStoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">AI Story Popup</span>
                <h3 className="text-sm font-bold text-white">{selectedStoryModal.mangaTitle}</h3>
                <p className="text-xs text-zinc-400">{selectedStoryModal.chapterName}</p>
              </div>
              <button
                onClick={() => setSelectedStoryModal(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-amber-950/20 border border-amber-500/30 p-3.5 rounded-xl space-y-1">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Story Outline & Chapter Narration</span>
                </h4>
                <p className="text-xs text-amber-100 leading-relaxed font-medium">
                  {selectedStoryModal.overallStory}
                </p>
              </div>

              {selectedStoryModal.characters && selectedStoryModal.characters.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>Manga Characters Identified ({selectedStoryModal.characters.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedStoryModal.characters.map((c, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{c.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            {c.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStoryModal(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
