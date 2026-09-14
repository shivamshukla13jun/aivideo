import React, { useState, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  Plus,
  BookOpen,
  Check,
  Flame,
  ArrowUpDown,
  Compass,
  Puzzle,
  FolderPlus,
  FileArchive,
  Trash2,
  UploadCloud,
  Sparkles,
} from 'lucide-react';
import { Manga, Category } from '../types.js';

interface LibraryViewProps {
  mangas: Manga[];
  categories: Category[];
  selectedCategory: number | null;
  onSelectCategory: (id: number | null) => void;
  onSelectManga: (manga: Manga) => void;
  onQuickRead: (manga: Manga) => void;
  onCreateCategory: (name: string) => void;
  onNavigateToBrowse: () => void;
  onNavigateToExtensions?: () => void;
  onOpenUploadCbzModal?: () => void;
  onDeleteManga?: (mangaId: number) => void;
  onUploadChapter?: (manga: Manga) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  mangas,
  categories,
  selectedCategory,
  onSelectCategory,
  onSelectManga,
  onQuickRead,
  onCreateCategory,
  onNavigateToBrowse,
  onNavigateToExtensions,
  onOpenUploadCbzModal,
  onDeleteManga,
  onUploadChapter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'unread' | 'title' | 'lastRead' | 'total'>('lastRead');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Filter & Sort
  const filteredMangas = useMemo(() => {
    let result = mangas.filter((m) => m.inLibrary === true);

    if (selectedCategory !== null) {
      result = result.filter((m) => m.categories && m.categories.includes(selectedCategory));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.author && m.author.toLowerCase().includes(q)) ||
          (m.genre && m.genre.some((g) => g.toLowerCase().includes(q)))
      );
    }

    return result.sort((a, b) => {
      if (sortBy === 'unread') return (b.unreadCount || 0) - (a.unreadCount || 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'total') return (b.chaptersCount || 0) - (a.chaptersCount || 0);
      // default: lastRead
      const aTime = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
      const bTime = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [mangas, selectedCategory, searchQuery, sortBy]);

  const handleCreateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    onCreateCategory(newCategoryName.trim());
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2">
          <button
            id="cat-tab-all"
            onClick={() => onSelectCategory(null)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === null
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            All Manga ({mangas.filter((m) => m.inLibrary === true).length})
          </button>

          {categories.map((cat) => {
            const count = mangas.filter((m) => m.inLibrary === true && m.categories.includes(cat.id)).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`cat-tab-${cat.id}`}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}

          {/* Add Category Button / Form */}
          {isAddingCategory ? (
            <form onSubmit={handleCreateCategorySubmit} className="flex items-center gap-1">
              <input
                id="input-new-category"
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name..."
                autoFocus
                className="px-2.5 py-1 rounded-lg text-xs bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                id="btn-save-new-category"
                className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddingCategory(false)}
                className="px-2 py-1 rounded-lg text-xs bg-zinc-800 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              id="btn-add-category-toggle"
              onClick={() => setIsAddingCategory(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900/80 border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Sort & CBZ Upload Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-library-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter library manga..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
          />
        </div>

        {/* Sort Selector & CBZ Upload Button */}
        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          {onOpenUploadCbzModal && (
            <button
              id="btn-upload-cbz-library"
              onClick={onOpenUploadCbzModal}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold shadow-md shadow-rose-950/40 transition-all cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Upload CBZ / Manga</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-zinc-400" />
            <span className="text-xs text-zinc-400">Sort:</span>
            <select
              id="select-library-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="lastRead">Recently Read</option>
              <option value="unread">Unread Chapters</option>
              <option value="title">Title (A-Z)</option>
              <option value="total">Total Chapters</option>
            </select>
          </div>
        </div>
      </div>

      {/* Manga Grid */}
      {filteredMangas.length === 0 ? (
        <div className="py-16 text-center bg-zinc-900/30 rounded-2xl border border-zinc-800/80 p-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400">
            <BookOpen className="w-7 h-7 text-rose-400" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200">Your Library is Empty</h3>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search query or switching categories.'
              : 'Upload your local `.cbz` or `.zip` manga files directly into your database, or generate chapters with AI Webtoon Studio.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {onOpenUploadCbzModal && (
              <button
                id="btn-empty-upload-cbz"
                onClick={onOpenUploadCbzModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950/50 transition-all cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                Upload CBZ / Local Manga
              </button>
            )}

            {onNavigateToExtensions && (
              <button
                id="btn-empty-browse"
                onClick={onNavigateToExtensions}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                Create AI Webtoon
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {filteredMangas.map((manga) => (
            <div
              key={manga.id}
              id={`manga-card-${manga.id}`}
              className="group relative flex flex-col bg-zinc-900/60 rounded-xl overflow-hidden border border-zinc-800/80 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/50 transition-all cursor-pointer"
              onClick={() => onSelectManga(manga)}
            >
              {/* Cover Container */}
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950">
                {manga.thumbnailUrl ? (
                  <img
                    src={manga.thumbnailUrl}
                    alt={manga.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600 font-bold text-xs p-2 text-center">
                    {manga.title}
                  </div>
                )}

                {/* Unread Chapter Badge */}
                {manga.unreadCount && manga.unreadCount > 0 ? (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-rose-600/90 backdrop-blur-md text-[11px] font-bold text-white shadow-md">
                    {manga.unreadCount} unread
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-emerald-600/90 backdrop-blur-md text-[10px] font-bold text-white shadow-md flex items-center gap-1">
                    <Check className="w-3 h-3" />
                  </div>
                )}

                {/* Status Pill */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-zinc-950/80 backdrop-blur-md text-[10px] font-medium text-zinc-300 uppercase tracking-wider">
                  {manga.status}
                </div>

                {/* Hover Quick Read & Delete Button Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5 gap-1.5">
                  <button
                    id={`btn-quick-read-${manga.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickRead(manga);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Read
                  </button>
                  {onUploadChapter && (
                    <button
                      id={`btn-quick-upload-${manga.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUploadChapter(manga);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-600 text-zinc-300 hover:text-white border border-zinc-700/60 shadow transition-all cursor-pointer"
                      title="Upload Chapter (.cbz, .zip, or images)"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDeleteManga && (
                    <button
                      id={`btn-quick-delete-${manga.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Permanently delete "${manga.title}" and all its chapters?`)) {
                          onDeleteManga(manga.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-600 text-red-300 hover:text-white border border-red-800/60 shadow transition-all cursor-pointer"
                      title="Delete Manga"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Info Details */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-zinc-100 line-clamp-1 group-hover:text-rose-400 transition-colors">
                    {manga.title}
                  </h4>
                  <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                    {manga.author || manga.artist || 'Unknown Author'}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/60">
                  <span className="capitalize">{manga.sourceId}</span>
                  <span>{manga.chaptersCount || 0} ch</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
