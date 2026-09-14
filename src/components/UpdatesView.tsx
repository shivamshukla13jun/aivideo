import React, { useState, useEffect } from 'react';
import { Clock, BookOpen, Layers, Check, ArrowLeft } from 'lucide-react';
import { Manga, Chapter } from '../types.js';

interface UpdatesViewProps {
  onReadChapter: (manga: Manga, chapter: Chapter) => void;
  onSelectManga: (manga: Manga) => void;
  onNavigateToLibrary?: () => void;
}

export const UpdatesView: React.FC<UpdatesViewProps> = ({
  onReadChapter,
  onSelectManga,
  onNavigateToLibrary,
}) => {
  const [updates, setUpdates] = useState<{ chapter: Chapter; manga: Manga }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/v1/update/recentChapters/1')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setUpdates(data.items || []);
        }
      })
      .catch((e) => console.error('Failed to load updates:', e))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          {onNavigateToLibrary && (
            <button
              id="btn-updates-back-library"
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
              <Clock className="w-5 h-5 text-rose-500" />
              <span>Recent Updates</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              New chapters released for manga saved in your personal library
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 text-xs">Loading recent updates...</div>
      ) : updates.length === 0 ? (
        <div className="py-16 text-center bg-zinc-900/30 rounded-2xl border border-zinc-800 p-8">
          <Layers className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-200">No recent updates</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Updates will appear here as new chapters release for manga in your library.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-900/40">
          {updates.map(({ chapter, manga }) => (
            <div
              key={`${manga.id}-${chapter.id}`}
              id={`update-row-${chapter.id}`}
              className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-800/40 transition-colors"
            >
              <div
                className="flex items-center gap-3.5 min-w-0 cursor-pointer"
                onClick={() => onSelectManga(manga)}
              >
                {manga.thumbnailUrl ? (
                  <img
                    src={manga.thumbnailUrl}
                    alt={manga.title}
                    className="w-12 h-16 object-cover rounded-lg bg-zinc-950 shrink-0 shadow"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-16 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-500 font-bold text-xs">
                    {manga.title.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-zinc-100 truncate hover:text-rose-400 transition-colors">
                    {manga.title}
                  </h4>
                  <p className="text-xs text-zinc-300 font-medium mt-0.5 truncate">
                    {chapter.name}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-2">
                    <span>{chapter.scanlator || 'Scanlation'}</span>
                    <span>•</span>
                    <span>{new Date(chapter.uploadDate).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {chapter.read && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-500 mr-2">
                    <Check className="w-3.5 h-3.5 text-rose-500" />
                    Read
                  </span>
                )}
                <button
                  id={`btn-read-update-${chapter.id}`}
                  onClick={() => onReadChapter(manga, chapter)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow flex items-center gap-1.5 transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Read</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
