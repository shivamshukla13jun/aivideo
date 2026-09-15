import React, { useState, useEffect } from 'react';
import {
  Film,
  Sparkles,
  ArrowLeft,
  BookOpen,
  Search,
  ChevronRight,
  Loader2,
  Layers,
  Play,
  Mic,
  Video,
  AlertCircle,
} from 'lucide-react';
import { Manga, Chapter } from '../types.js';
import { WebtoonVideoStudioModal } from './WebtoonVideoStudioModal.js';

interface AiGeneratorViewProps {
  mangas: Manga[];
  onNavigateToLibrary: () => void;
  initialManga?: Manga | null;
  initialChapter?: Chapter | null;
}

export const AiGeneratorView: React.FC<AiGeneratorViewProps> = ({
  mangas,
  onNavigateToLibrary,
  initialManga = null,
  initialChapter = null,
}) => {
  const [selectedManga, setSelectedManga] = useState<Manga | null>(initialManga);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(initialChapter);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch chapters when selectedManga changes
  useEffect(() => {
    if (!selectedManga) {
      setChapters([]);
      setSelectedChapter(null);
      return;
    }

    let isMounted = true;
    setIsLoadingChapters(true);

    fetch(`/api/v1/manga/${selectedManga.id}/chapters`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load chapters');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const chList: Chapter[] = data || [];
        setChapters(chList);
        if (chList.length > 0 && !selectedChapter) {
          setSelectedChapter(chList[0]);
        }
      })
      .catch((err) => {
        console.error('Error fetching chapters for AI Generator:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingChapters(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedManga]);

  // Filtered manga list based on search
  const filteredMangas = mangas.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.author && m.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // If a manga and chapter are actively selected, render the full Studio in page mode!
  if (selectedManga && selectedChapter) {
    return (
      <WebtoonVideoStudioModal
        manga={selectedManga}
        chapter={selectedChapter}
        onClose={() => {
          setSelectedChapter(null);
          setSelectedManga(null);
        }}
        isPageMode={true}
        onNavigateToLibrary={onNavigateToLibrary}
        allChapters={chapters}
        onSelectChapter={(ch) => setSelectedChapter(ch)}
        onChangeManga={() => {
          setSelectedManga(null);
          setSelectedChapter(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="btn-ai-generator-back-nav"
            onClick={onNavigateToLibrary}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0"
            title="Return to Library"
          >
            <ArrowLeft className="w-4 h-4 text-rose-400" />
            <span>Back to Library</span>
          </button>
          <div className="h-6 w-px bg-zinc-800 hidden sm:block shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2 truncate">
              <Film className="w-5 h-5 text-rose-500 shrink-0" />
              <span>AI Webtoon &amp; Manga Video Generator</span>
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                Powered by Gemini 3.1 Pro (Best AI Model)
              </span>
              <span className="text-[10px] text-zinc-400">
                Deep reasoning, multimodal vision & authentic dialogues
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Manga Selection Hero */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Step 1: Choose Manga &amp; Chapter to Generate</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Select any manga from your library to analyze panels, extract Hindi dialogues, and produce narration reels.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library manga..."
              className="w-full pl-9 pr-4 py-2 bg-zinc-950/80 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>
        </div>

        {/* Selected Manga Chapters Picker (if a manga is tapped but no chapter selected) */}
        {selectedManga && (
          <div className="p-4 bg-zinc-950/80 border border-rose-500/30 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <h3 className="text-sm font-bold text-white truncate">
                  Selected: {selectedManga.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedManga(null);
                  setSelectedChapter(null);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
              >
                Change Manga
              </button>
            </div>

            {isLoadingChapters ? (
              <div className="flex items-center gap-2 py-4 text-zinc-400 text-xs">
                <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
                <span>Loading chapters...</span>
              </div>
            ) : chapters.length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">
                No chapters found for this manga. Please upload a chapter or sync from online source.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-300">
                  Select chapter to open in AI Video Studio:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                  {chapters.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => setSelectedChapter(ch)}
                      className="p-2.5 rounded-xl bg-zinc-900 hover:bg-rose-600/20 hover:border-rose-500/50 border border-zinc-800 text-left transition-all cursor-pointer group"
                    >
                      <div className="text-xs font-semibold text-zinc-200 group-hover:text-rose-300 truncate">
                        {ch.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {ch.pageCount ? `${ch.pageCount} pages` : 'Tap to generate video'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manga Grid */}
        {filteredMangas.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 space-y-3">
            <BookOpen className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-sm font-medium">No manga found in your library.</p>
            <button
              onClick={onNavigateToLibrary}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700 cursor-pointer"
            >
              Go to Library &amp; Add Manga
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredMangas.map((manga) => {
              const isSelected = selectedManga?.id === manga.id;
              return (
                <div
                  key={manga.id}
                  onClick={() => setSelectedManga(manga)}
                  className={`group relative rounded-xl overflow-hidden bg-zinc-950 border transition-all duration-200 cursor-pointer flex flex-col ${
                    isSelected
                      ? 'border-rose-500 ring-2 ring-rose-500/40 shadow-lg shadow-rose-950/50'
                      : 'border-zinc-800/80 hover:border-zinc-700 hover:shadow-xl'
                  }`}
                >
                  <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-900 relative">
                    {manga.thumbnailUrl ? (
                      <img
                        src={manga.thumbnailUrl}
                        alt={manga.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-zinc-500 font-bold">
                        {manga.title}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow">
                        AI Ready
                      </span>
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <h4 className="text-xs font-bold text-zinc-200 group-hover:text-rose-400 line-clamp-2 transition-colors">
                      {manga.title}
                    </h4>
                    <div className="mt-2 pt-2 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-500">
                      <span className="truncate">{manga.sourceId || 'Local'}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feature Highlights Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-2">
            <Mic className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-zinc-200">Hindi Voice Narration</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Record or upload custom voice samples or use Hindi speech synthesis for chapter scenes.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
            <Video className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-zinc-200">Incident Storyboard</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Auto-extracts incidents, character actions, and dialogue subtitles for dynamic pacing.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
            <Film className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-zinc-200">Export Video Reels</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Render directly in the browser to MP4/WebM video with burned-in subtitles and background music.
          </p>
        </div>
      </div>
    </div>
  );
};
