import React, { useState, useEffect } from 'react';
import {
  Compass,
  Search,
  Sparkles,
  Clock,
  Plus,
  Check,
  Globe,
  Loader2,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react';
import { Source, Manga } from '../types.js';

interface BrowseViewProps {
  sources: Source[];
  onSelectManga: (manga: Manga) => void;
  onToggleLibrary: (manga: Manga) => void;
  onSourcesUpdated?: () => void;
  initialSourceId?: string;
  onNavigateToLibrary?: () => void;
}

export const BrowseView: React.FC<BrowseViewProps> = ({
  sources,
  onSelectManga,
  onToggleLibrary,
  initialSourceId,
  onNavigateToLibrary,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>(initialSourceId || sources[0]?.id || 'mangafire');
  const [browseMode, setBrowseMode] = useState<'popular' | 'latest' | 'search' | 'global'>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [globalResults, setGlobalResults] = useState<Array<{ source: Source; mangas: Manga[] }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sync selectedSourceId if initialSourceId changes
  useEffect(() => {
    if (initialSourceId && sources.some((s) => s.id === initialSourceId)) {
      setSelectedSourceId(initialSourceId);
    }
  }, [initialSourceId, sources]);

  // Sync selectedSourceId if sources array updates and current isn't in it
  useEffect(() => {
    if (sources.length > 0) {
      if (!selectedSourceId || !sources.some((s) => s.id === selectedSourceId)) {
        setSelectedSourceId(sources[0].id);
      }
    }
  }, [sources, selectedSourceId]);

  // Optimistic library toggle handler for Browse cards
  const handleToggleLibraryInternal = (manga: Manga) => {
    const nextInLib = !manga.inLibrary;
    setMangaList((prev) =>
      prev.map((m) => (m.id === manga.id ? { ...m, inLibrary: nextInLib } : m))
    );
    setGlobalResults((prev) =>
      prev.map((group) => ({
        ...group,
        mangas: group.mangas.map((m) =>
          m.id === manga.id ? { ...m, inLibrary: nextInLib } : m
        ),
      }))
    );
    onToggleLibrary(manga);
  };

  // Fetch manga based on source and mode
  useEffect(() => {
    if (!selectedSourceId || sources.length === 0) {
      setMangaList([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchCatalog = async () => {
      if (browseMode === 'global') {
        if (!searchQuery.trim()) return;
        setIsLoading(true);
        try {
          const res = await fetch(`/api/v1/source/globalSearch?query=${encodeURIComponent(searchQuery.trim())}`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted) setGlobalResults(data);
          }
        } catch (e) {
          console.error('Global search error:', e);
        } finally {
          if (isMounted) setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        let url = `/api/v1/source/${selectedSourceId}/popular/1`;
        if (browseMode === 'latest') {
          url = `/api/v1/source/${selectedSourceId}/latest/1`;
        } else if (browseMode === 'search' && searchQuery.trim()) {
          url = `/api/v1/source/${selectedSourceId}/search?query=${encodeURIComponent(searchQuery.trim())}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        if (isMounted) {
          setMangaList(data.mangaList || []);
        }
      } catch (err) {
        console.error('Failed to fetch source catalog:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, [selectedSourceId, browseMode, searchQuery, sources]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      if (browseMode === 'search') {
        setBrowseMode('popular');
      }
    } else {
      if (browseMode !== 'global') {
        setBrowseMode('search');
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (browseMode !== 'global') {
        setBrowseMode('search');
      }
    }
  };

  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  return (
    <div className="space-y-6">
      {/* Header Banner & Bot Protection Status */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800/80 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onNavigateToLibrary && (
            <button
              id="btn-browse-back-library"
              onClick={onNavigateToLibrary}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0"
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Back to Library</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Compass className="w-5 h-5 text-rose-500" />
                <span>Popular Manga Source Websites</span>
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Anti-Bot Bypassed
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Directly scrape and read full manga catalogs with headers, rotating user-agents, and auto image proxy.
            </p>
          </div>
        </div>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={
              browseMode === 'global' ? 'Search all popular sources...' : `Search on ${selectedSource?.name || 'source'}...`
            }
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
          />
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Sources Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-800 no-scrollbar">
        {/* Global Multi-Source Search tab */}
        <button
          onClick={() => setBrowseMode('global')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
            browseMode === 'global'
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-950/50'
              : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-300" />
          <span>Multi-Source Search</span>
        </button>

        {sources.map((src) => {
          const isSelected = selectedSourceId === src.id && browseMode !== 'global';
          return (
            <button
              key={src.id}
              id={`source-tab-${src.id}`}
              onClick={() => {
                setSelectedSourceId(src.id);
                if (browseMode === 'global') setBrowseMode('popular');
                if (browseMode === 'search' && !searchQuery) setBrowseMode('popular');
              }}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-rose-600/10 text-white border-rose-500/50 shadow-md shadow-rose-950/30'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {src.iconUrl && src.iconUrl.trim().length > 0 ? (
                <img
                  src={src.iconUrl}
                  alt={src.name}
                  className="w-4 h-4 rounded-md object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Globe className="w-4 h-4 text-zinc-400" />
              )}
              <span>{src.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-950/60 text-zinc-400 uppercase font-mono border border-zinc-800">
                {src.lang}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mode Switcher: Popular / Latest */}
      {browseMode !== 'global' && (
        <div className="flex items-center justify-between gap-4 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBrowseMode('popular');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                browseMode === 'popular'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Popular</span>
            </button>

            <button
              onClick={() => {
                setBrowseMode('latest');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                browseMode === 'latest'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Latest Updates</span>
            </button>
          </div>

          <span className="text-xs text-zinc-500 hidden sm:block font-medium">
            Source: <strong className="text-zinc-300">{selectedSource?.name}</strong>
          </span>
        </div>
      )}

      {/* Content Rendering */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
          <p className="text-sm font-medium text-zinc-300">Scraping live catalog & bypassing bot checks...</p>
          <p className="text-xs text-zinc-500">Fetching direct HTML & image CDN headers</p>
        </div>
      ) : browseMode === 'global' ? (
        /* Global Search Results */
        <div className="space-y-8">
          {globalResults.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-12 text-center max-w-md mx-auto">
              <Search className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">Search Across Popular Sources</h3>
              <p className="text-xs text-zinc-400">
                Enter a title above to search across MangaFire, Asura Scans, FlameComics, and more simultaneously.
              </p>
            </div>
          ) : (
            globalResults.map((group) => (
              <div key={group.source.id} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                  <Globe className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white">{group.source.name}</h3>
                  <span className="text-xs text-zinc-500 font-normal">({group.mangas.length} results)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {group.mangas.map((manga) => (
                    <MangaCard
                      key={`${group.source.id}-${manga.id}`}
                      manga={manga}
                      onSelectManga={onSelectManga}
                      onToggleLibrary={handleToggleLibraryInternal}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : mangaList.length === 0 ? (
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-12 text-center max-w-md mx-auto">
          <Zap className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">No Manga Found</h3>
          <p className="text-xs text-zinc-400">
            Try switching to another popular source website tab above or check back shortly.
          </p>
        </div>
      ) : (
        /* Single Source Catalog Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {mangaList.map((manga) => (
            <MangaCard
              key={manga.id}
              manga={manga}
              onSelectManga={onSelectManga}
              onToggleLibrary={handleToggleLibraryInternal}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface MangaCardProps {
  key?: React.Key;
  manga: Manga;
  onSelectManga: (manga: Manga) => void;
  onToggleLibrary: (manga: Manga) => void;
}

/* Individual Manga Card Component */
function MangaCard({
  manga,
  onSelectManga,
  onToggleLibrary,
}: MangaCardProps) {
  return (
    <div
      onClick={() => onSelectManga(manga)}
      className="group relative bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-950/20 transition-all cursor-pointer flex flex-col"
    >
      {/* Thumbnail */}
      <div className="aspect-[3/4] w-full bg-zinc-950 relative overflow-hidden">
        {manga.thumbnailUrl ? (
          <img
            src={manga.thumbnailUrl}
            alt={manga.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&h=450&fit=crop';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600">
            <Compass className="w-8 h-8" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* In Library Badge / Add to Library Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLibrary(manga);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-lg text-xs font-semibold backdrop-blur-md transition-all cursor-pointer shadow-md ${
            manga.inLibrary
              ? 'bg-rose-600 text-white shadow-rose-900/50'
              : 'bg-zinc-950/70 hover:bg-rose-600 text-zinc-300 hover:text-white'
          }`}
          title={manga.inLibrary ? 'In Library' : 'Add to Library'}
        >
          {manga.inLibrary ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 justify-between">
        <h4 className="font-semibold text-xs text-white line-clamp-2 group-hover:text-rose-400 transition-colors leading-snug">
          {manga.title}
        </h4>
        {manga.author && manga.author !== 'Unknown Author' && (
          <p className="text-[11px] text-zinc-400 line-clamp-1 mt-1 font-normal">{manga.author}</p>
        )}
      </div>
    </div>
  );
}
