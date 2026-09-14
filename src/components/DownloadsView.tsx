import React, { useState, useEffect } from 'react';
import {
  ArrowDownToLine,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  FolderDown,
  ArrowLeft,
  X,
} from 'lucide-react';
import { DownloadQueueItem } from '../types.js';

interface DownloadsViewProps {
  onNavigateToLibrary: () => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({ onNavigateToLibrary }) => {
  const [queue, setQueue] = useState<DownloadQueueItem[]>([]);
  const [status, setStatus] = useState<{ isRunning: boolean; isPaused: boolean }>({
    isRunning: false,
    isPaused: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const [queueRes, statusRes] = await Promise.all([
        fetch('/api/v1/download/queue'),
        fetch('/api/v1/download/status'),
      ]);
      if (queueRes.ok) setQueue(await queueRes.json());
      if (statusRes.ok) setStatus(await statusRes.json());
    } catch (e) {
      console.error('Failed to fetch downloads queue:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Poll queue every 1.5s for live download progress updates
    const interval = setInterval(fetchQueue, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    await fetch('/api/v1/download/start', { method: 'POST' });
    fetchQueue();
  };

  const handlePause = async () => {
    await fetch('/api/v1/download/pause', { method: 'POST' });
    fetchQueue();
  };

  const handleClearCompleted = async () => {
    await fetch('/api/v1/download/clear?completed=true', { method: 'DELETE' });
    fetchQueue();
  };

  const handleClearAll = async () => {
    await fetch('/api/v1/download/clear', { method: 'DELETE' });
    fetchQueue();
  };

  const handleRemoveItem = async (chapterId: number) => {
    await fetch(`/api/v1/download/${chapterId}`, { method: 'DELETE' });
    fetchQueue();
  };

  const activeCount = queue.filter((i) => i.status === 'DOWNLOADING' || i.status === 'QUEUED').length;
  const completedCount = queue.filter((i) => i.status === 'DOWNLOADED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Downloader Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            id="btn-downloads-back-library"
            onClick={onNavigateToLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0"
            title="Back to Library"
          >
            <ArrowLeft className="w-4 h-4 text-rose-400" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Download Queue</h1>
              <p className="text-xs text-zinc-400">
                Offline manga chapter downloader • {activeCount} active, {completedCount} completed
              </p>
            </div>
          </div>
        </div>

        {/* Global Downloader Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {status.isPaused ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md shadow-emerald-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Resume Downloads
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={queue.length === 0}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              Pause
            </button>
          )}

          {completedCount > 0 && (
            <button
              onClick={handleClearCompleted}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-zinc-700/60"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Clear Completed
            </button>
          )}

          {queue.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Queue Items List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading download queue...</span>
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto text-zinc-400">
            <FolderDown className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">No Downloads in Queue</h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              You can download chapters for offline reading from the Manga details view or Library.
            </p>
          </div>
          <button
            onClick={onNavigateToLibrary}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors cursor-pointer"
          >
            Go to Library
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => {
            const isDownloading = item.status === 'DOWNLOADING';
            const isCompleted = item.status === 'DOWNLOADED';
            const isQueued = item.status === 'QUEUED';
            const isPausedState = item.status === 'PAUSED';

            return (
              <div
                key={item.id || item.chapterId}
                className="bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-4 flex items-center gap-4 transition-all"
              >
                {/* Thumbnail */}
                {item.mangaThumbnail ? (
                  <img
                    src={item.mangaThumbnail}
                    alt={item.mangaTitle}
                    className="w-12 h-16 rounded-lg object-cover bg-zinc-800 shrink-0 border border-zinc-700/50"
                  />
                ) : (
                  <div className="w-12 h-16 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-500">
                    <ArrowDownToLine className="w-5 h-5" />
                  </div>
                )}

                {/* Info & Progress */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{item.mangaTitle}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDownloading && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Downloading
                        </span>
                      )}
                      {isQueued && (
                        <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
                          Queued
                        </span>
                      )}
                      {isPausedState && (
                        <span className="text-[11px] font-medium text-amber-500/80 bg-zinc-800 px-2 py-0.5 rounded-md">
                          Paused
                        </span>
                      )}
                      {isCompleted && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Downloaded
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 truncate">{item.chapterName}</p>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        Page {item.pagesDownloaded} of {item.totalPages}
                      </span>
                      <span>{item.progress}%</span>
                    </div>
                  </div>
                </div>

                {/* Cancel / Remove Button */}
                <button
                  onClick={() => handleRemoveItem(item.chapterId)}
                  title="Remove from queue"
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
