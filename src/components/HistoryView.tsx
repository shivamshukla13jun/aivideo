import React, { useState, useEffect } from 'react';
import { History, BookOpen, Trash2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { HistoryItem, Manga, Chapter } from '../types.js';

interface HistoryViewProps {
  onReadMangaChapterId: (mangaId: number, chapterId: number) => void;
  onSelectMangaId: (mangaId: number) => void;
  onNavigateToLibrary?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onReadMangaChapterId,
  onSelectMangaId,
  onNavigateToLibrary,
}) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = () => {
    setIsLoading(true);
    fetch('/api/v1/history')
      .then((res) => res.json())
      .then((data) => {
        setHistoryItems(data || []);
      })
      .catch((e) => console.error('Failed to load history:', e))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your reading history?')) return;
    try {
      await fetch('/api/v1/history', { method: 'DELETE' });
      setHistoryItems([]);
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          {onNavigateToLibrary && (
            <button
              id="btn-history-back-library"
              onClick={onNavigateToLibrary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0"
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4 text-rose-400" />
              <span>Back</span>
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-rose-500" />
              <span>Reading History</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Continue where you left off across all your manga chapters
            </p>
          </div>
        </div>

        {historyItems.length > 0 && (
          <button
            id="btn-clear-history"
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 border border-zinc-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 text-xs">Loading reading history...</div>
      ) : historyItems.length === 0 ? (
        <div className="py-16 text-center bg-zinc-900/30 rounded-2xl border border-zinc-800 p-8">
          <History className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-200">No reading history</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Chapters you read will automatically be recorded here with your exact page progress.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-900/40">
          {historyItems.map((item) => (
            <div
              key={item.id}
              id={`history-item-${item.chapterId}`}
              className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-800/40 transition-colors"
            >
              <div
                className="flex items-center gap-3.5 min-w-0 cursor-pointer"
                onClick={() => onSelectMangaId(item.mangaId)}
              >
                {item.mangaThumbnail ? (
                  <img
                    src={item.mangaThumbnail}
                    alt={item.mangaTitle}
                    className="w-12 h-16 object-cover rounded-lg bg-zinc-950 shrink-0 shadow"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-16 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-500 font-bold text-xs">
                    {item.mangaTitle.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-zinc-100 truncate hover:text-rose-400 transition-colors">
                    {item.mangaTitle}
                  </h4>
                  <p className="text-xs text-zinc-300 font-medium mt-0.5 truncate">
                    {item.chapterName}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
                    <span>
                      Page {item.lastPageRead} of {item.pageCount}
                    </span>
                    <span>•</span>
                    <span>{new Date(item.readAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <button
                id={`btn-resume-history-${item.chapterId}`}
                onClick={() => onReadMangaChapterId(item.mangaId, item.chapterId)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow flex items-center gap-1.5 transition-all shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
