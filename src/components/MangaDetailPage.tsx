import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  BookOpen,
  Check,
  Plus,
  Star,
  Tag,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FolderPlus,
  ArrowDownToLine,
  Edit3,
  ExternalLink,
  Save,
  CheckCircle2,
  Bookmark,
  ArrowUpDown,
  Search,
  Film,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckSquare,
  Square,
  UploadCloud,
  Scissors,
  Share2,
} from 'lucide-react';
import { Manga, Chapter, Category, TrackerItem } from '../types.js';
import { WebtoonVideoStudioModal } from './WebtoonVideoStudioModal.js';
import { UploadChapterModal } from './UploadChapterModal.js';
import { PanelCropperModal } from './PanelCropperModal.js';

interface MangaDetailPageProps {
  manga: Manga | null;
  categories: Category[];
  onBack: () => void;
  onToggleLibrary: (manga: Manga) => void;
  onUpdateCategories: (mangaId: number, categoryIds: number[]) => void;
  onReadChapter: (manga: Manga, chapter: Chapter) => void;
  onToggleChapterRead: (chapter: Chapter) => void;
  onToggleChapterBookmark: (chapter: Chapter) => void;
  onMarkAllRead: (mangaId: number, read: boolean) => void;
  onMangaUpdated?: (updatedManga: Manga) => void;
  onDeleteManga?: (mangaId: number) => void;
  onOpenPanelCropper?: (manga: Manga, chapter: Chapter) => void;
  onOpenVideoStudio?: (manga: Manga, chapter: Chapter) => void;
}

export const MangaDetailPage: React.FC<MangaDetailPageProps> = ({
  manga,
  categories,
  onBack,
  onToggleLibrary,
  onUpdateCategories,
  onReadChapter,
  onToggleChapterRead,
  onToggleChapterBookmark,
  onMarkAllRead,
  onMangaUpdated,
  onDeleteManga,
  onOpenPanelCropper,
  onOpenVideoStudio,
}) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterSortOrder, setChapterSortOrder] = useState<'desc' | 'asc'>('desc');
  const [chapterFilter, setChapterFilter] = useState('');
  const [chapterPage, setChapterPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chapters' | 'trackers' | 'edit'>('chapters');

  // Modal states
  const [selectedVideoChapter, setSelectedVideoChapter] = useState<Chapter | null>(null);
  const [selectedCropChapter, setSelectedCropChapter] = useState<Chapter | null>(null);
  const [isUploadChapterModalOpen, setIsUploadChapterModalOpen] = useState(false);

  // Trackers state
  const [trackers, setTrackers] = useState<TrackerItem[]>([]);
  const [trackerStatus, setTrackerStatus] = useState('reading');
  const [trackerScore, setTrackerScore] = useState(8);
  const [trackerService, setTrackerService] = useState<'AniList' | 'MyAnimeList'>('AniList');

  // Edit metadata state
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editStatus, setEditStatus] = useState('ONGOING');
  const [editDescription, setEditDescription] = useState('');

  // Download feedback toast
  const [downloadNotice, setDownloadNotice] = useState('');

  // Delete states
  const [isConfirmingDeleteManga, setIsConfirmingDeleteManga] = useState(false);
  const [isDeletingManga, setIsDeletingManga] = useState(false);
  const [confirmDeleteChapterId, setConfirmDeleteChapterId] = useState<number | null>(null);
  const [isDeletingChapter, setIsDeletingChapter] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedChapterIdsForBatch, setSelectedChapterIdsForBatch] = useState<number[]>([]);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Load chapters and trackers when manga changes
  useEffect(() => {
    if (!manga) return;

    // Reset fields
    setEditTitle(manga.title || '');
    setEditAuthor(manga.author || '');
    setEditArtist(manga.artist || '');
    setEditStatus(manga.status || 'ONGOING');
    setEditDescription(manga.description || '');
    setIsBatchMode(false);
    setSelectedChapterIdsForBatch([]);
    setChapterPage(1);

    setIsLoadingChapters(true);
    fetch(`/api/v1/manga/${manga.id}/chapters`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setChapters(data);
        }
      })
      .catch((err) => console.error('Failed to load chapters:', err))
      .finally(() => setIsLoadingChapters(false));

    fetch(`/api/v1/tracker/${manga.id}`)
      .then(async (res) => {
        if (!res.ok) return [];
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return [];
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setTrackers(data);
        } else {
          setTrackers([]);
        }
      })
      .catch((err) => {
        console.warn('Trackers unavailable:', err.message || err);
        setTrackers([]);
      });
  }, [manga?.id]);

  if (!manga) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-zinc-400">No manga selected.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-semibold"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const showDownloadNotice = (msg: string) => {
    setDownloadNotice(msg);
    setTimeout(() => setDownloadNotice(''), 4000);
  };

  const handleCategoryToggle = (catId: number) => {
    const current = manga.categories || [];
    const updated = current.includes(catId)
      ? current.filter((id) => id !== catId)
      : [...current, catId];
    onUpdateCategories(manga.id, updated);
  };

  const handleSaveMetadata = async () => {
    try {
      const res = await fetch(`/api/v1/manga/${manga.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          author: editAuthor,
          artist: editArtist,
          status: editStatus,
          description: editDescription,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (onMangaUpdated) onMangaUpdated(updated);
        showDownloadNotice('Metadata updated successfully');
        setActiveTab('chapters');
      }
    } catch (err) {
      console.error('Failed to update manga metadata:', err);
    }
  };

  const handleSaveTracker = async () => {
    try {
      const res = await fetch(`/api/v1/tracker/${manga.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: trackerService,
          status: trackerStatus,
          score: trackerScore,
          lastChapterRead: chapters.filter((c) => c.read).length,
        }),
      });
      if (res.ok) {
        const newTracker = await res.json();
        setTrackers((prev) => [...prev.filter((t) => t.service !== trackerService), newTracker]);
        showDownloadNotice(`Tracker synced to ${trackerService}`);
      }
    } catch (err) {
      console.error('Failed to sync tracker:', err);
    }
  };

  const handleDownloadBatch = async (amount: number | 'all') => {
    let toDownload: number[] = [];
    const unreadChapters = chapters.filter((c) => !c.read);
    if (amount === 'all') {
      toDownload = unreadChapters.map((c) => c.id);
    } else {
      toDownload = unreadChapters.slice(0, amount).map((c) => c.id);
    }
    if (toDownload.length === 0) {
      showDownloadNotice('No unread chapters to download');
      return;
    }
    try {
      await fetch('/api/v1/download/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIds: toDownload }),
      });
      showDownloadNotice(`Queued ${toDownload.length} chapter(s) for download`);
    } catch (err) {
      console.error('Batch download failed:', err);
    }
  };

  const handleDownloadSingle = async (chapterId: number) => {
    try {
      await fetch(`/api/v1/download/${chapterId}`, { method: 'POST' });
      showDownloadNotice('Chapter queued for download');
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleDeleteChapter = async (chapter: Chapter) => {
    setIsDeletingChapter(true);
    try {
      const res = await fetch(`/api/v1/chapter/${chapter.id}`, { method: 'DELETE' });
      if (res.ok) {
        setChapters((prev) => prev.filter((c) => c.id !== chapter.id));
        setConfirmDeleteChapterId(null);
        showDownloadNotice(`Chapter ${chapter.name || chapter.chapterNumber} deleted`);
        const remainingCount = Math.max(0, chapters.length - 1);
        if (onMangaUpdated) {
          onMangaUpdated({
            ...manga,
            chaptersCount: remainingCount,
          });
        }
      } else {
        const err = await res.json();
        alert(`Failed to delete chapter: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Failed to delete chapter: ${err.message}`);
    } finally {
      setIsDeletingChapter(false);
    }
  };

  const handleDeleteBatchChapters = async () => {
    if (selectedChapterIdsForBatch.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedChapterIdsForBatch.length} selected chapter(s)?`)) {
      return;
    }
    setIsDeletingBatch(true);
    try {
      const res = await fetch('/api/v1/chapter/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIds: selectedChapterIdsForBatch }),
      });
      if (res.ok) {
        setChapters((prev) => prev.filter((c) => !selectedChapterIdsForBatch.includes(c.id)));
        showDownloadNotice(`Deleted ${selectedChapterIdsForBatch.length} chapters`);
        const remainingCount = Math.max(0, chapters.length - selectedChapterIdsForBatch.length);
        setSelectedChapterIdsForBatch([]);
        setIsBatchMode(false);
        if (onMangaUpdated) {
          onMangaUpdated({
            ...manga,
            chaptersCount: remainingCount,
          });
        }
      } else {
        const err = await res.json();
        alert(`Failed to delete batch: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Failed to delete batch: ${err.message}`);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const handleDeleteManga = async () => {
    setIsDeletingManga(true);
    try {
      const res = await fetch(`/api/v1/manga/${manga.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (onDeleteManga) onDeleteManga(manga.id);
        onBack();
      } else {
        const err = await res.json();
        alert(`Failed to delete manga: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Failed to delete manga: ${err.message}`);
    } finally {
      setIsDeletingManga(false);
      setIsConfirmingDeleteManga(false);
    }
  };

  return (
    <div className="w-full min-h-screen pb-20 space-y-6 animate-fadeIn">
      {/* Top Navigation & Breadcrumb Bar */}
      <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="btn-back-to-library"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 transition-all text-xs font-semibold cursor-pointer shrink-0 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-rose-400" />
            <span>Back to Manga List</span>
          </button>
          <div className="h-4 w-px bg-zinc-800 hidden sm:block shrink-0" />
          <span className="text-xs text-zinc-400 font-medium truncate hidden sm:inline-block">
            {manga.title}
          </span>
        </div>

        {/* Quick Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {chapters.length > 0 && (
            <button
              onClick={() => onReadChapter(manga, chapters[0])}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/40 transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Read First Chapter</span>
            </button>
          )}

          <button
            onClick={() => {
              if (chapters.length > 0) {
                setSelectedCropChapter(chapters[0]);
              } else {
                setIsUploadChapterModalOpen(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer"
            title="Crop overall image strips into panels & replace CBZ"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Crop Panels &amp; CBZ</span>
          </button>

          <button
            onClick={() => setIsUploadChapterModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer"
            title="Upload Chapter (.cbz or images)"
          >
            <UploadCloud className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline">+ Upload Chapter</span>
          </button>
        </div>
      </div>

      {/* Main Manga Header / Hero Card */}
      <div className="relative rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl overflow-hidden">
        {/* Blurred Backdrop Banner */}
        <div className="relative h-44 sm:h-56 w-full overflow-hidden bg-zinc-950">
          {manga.thumbnailUrl ? (
            <img
              src={manga.thumbnailUrl}
              alt={manga.title}
              className="w-full h-full object-cover blur-2xl opacity-25 scale-115"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />
        </div>

        {/* Top Info Section */}
        <div className="relative px-6 sm:px-8 -mt-24 sm:-mt-28 flex flex-col md:flex-row gap-6 pb-6">
          {/* Cover Poster */}
          <div className="w-32 sm:w-44 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-700 bg-zinc-900 mx-auto md:mx-0 flex items-center justify-center">
            {manga.thumbnailUrl ? (
              <img
                src={manga.thumbnailUrl}
                alt={manga.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold text-xs p-4 text-center">
                {manga.title}
              </div>
            )}
          </div>

          {/* Titles, Badges & Action Buttons */}
          <div className="flex-1 flex flex-col justify-end space-y-3 text-center md:text-left">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase">
                  {manga.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 capitalize border border-zinc-700">
                  {manga.sourceId}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700">
                  {chapters.length} Chapters
                </span>

                {downloadNotice && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {downloadNotice}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {manga.title}
              </h1>

              {(manga.author || manga.artist) && (
                <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium">
                  {manga.author} {manga.artist && manga.artist !== manga.author ? `• Art: ${manga.artist}` : ''}
                </p>
              )}
            </div>

            {/* Genre Tags */}
            {manga.genre && manga.genre.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                {manga.genre.map((g, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-800/90 text-zinc-300 border border-zinc-700/60"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-2">
              <button
                id="btn-toggle-library"
                onClick={() => onToggleLibrary(manga)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                  manga.inLibrary
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-zinc-700'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                }`}
              >
                {manga.inLibrary ? (
                  <>
                    <Check className="w-4 h-4 text-rose-500" />
                    <span>In Library</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add to Library</span>
                  </>
                )}
              </button>

              {/* Category Picker Popover */}
              {categories.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-rose-400" />
                    <span>Categories ({manga.categories?.length || 0})</span>
                  </button>

                  {isCategoryPickerOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-30 animate-fadeIn">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 py-1">
                        Set Categories
                      </p>
                      {categories.map((cat) => {
                        const checked = manga.categories?.includes(cat.id);
                        return (
                          <label
                            key={cat.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleCategoryToggle(cat.id)}
                              className="rounded accent-rose-600 w-3.5 h-3.5"
                            />
                            <span>{cat.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Crop Panels & CBZ Studio Trigger Button */}
              <button
                id="btn-crop-studio-hero"
                onClick={() => {
                  if (chapters.length > 0) {
                    setSelectedCropChapter(chapters[0]);
                  } else {
                    setIsUploadChapterModalOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 transition-all cursor-pointer"
                title="Crop overall image strips into panels & replace CBZ"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>✂️ Crop Panels / CBZ</span>
              </button>

              {/* Upload Chapter Trigger Button */}
              <button
                id="btn-upload-chapter-trigger"
                onClick={() => setIsUploadChapterModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500/50 transition-all cursor-pointer"
                title="Upload chapter (.cbz, .zip, or images) to this series"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Chapter</span>
              </button>

              {/* Delete Manga Trigger Button */}
              <button
                id="btn-delete-manga-trigger"
                onClick={() => setIsConfirmingDeleteManga(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/40 hover:border-red-700/60 transition-all cursor-pointer"
                title="Delete this manga and all its chapters permanently"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Manga</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Chapters, Tracking, Edit Metadata) */}
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('chapters')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'chapters'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          📖 Chapters ({chapters.length})
        </button>

        <button
          onClick={() => setActiveTab('trackers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'trackers'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          📊 Tracking {trackers.length > 0 && `(${trackers.length})`}
        </button>

        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'edit'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          ✏️ Edit Metadata
        </button>
      </div>

      {/* TAB 1: CHAPTERS - FULL PAGE VISIBILITY WITHOUT MODAL CONSTRAINTS */}
      {activeTab === 'chapters' && (
        <div className="space-y-6">
          {/* Synopsis */}
          {manga.description && (
            <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Synopsis
              </h4>
              <p
                className={`text-xs sm:text-sm text-zinc-300 leading-relaxed ${
                  !isDescriptionExpanded ? 'line-clamp-3' : ''
                }`}
              >
                {manga.description}
              </p>
              {manga.description.length > 200 && (
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="mt-2 text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  {isDescriptionExpanded ? (
                    <>
                      <span>Show Less</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Read More</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Chapters Controls Header */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/80">
              {/* Download batch buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-zinc-400 mr-1 flex items-center gap-1">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-rose-400" />
                  Download:
                </span>
                <button
                  onClick={() => handleDownloadBatch(1)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  Next 1
                </button>
                <button
                  onClick={() => handleDownloadBatch(5)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  Next 5
                </button>
                <button
                  onClick={() => handleDownloadBatch('all')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  All Unread
                </button>
              </div>

              {/* Action buttons on right */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-upload-chapter-list"
                  onClick={() => setIsUploadChapterModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition-colors cursor-pointer"
                  title="Upload chapter (.cbz, .zip, or images) to this manga"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload Chapter</span>
                </button>

                {chapters.some((c) => c.read) && (
                  <button
                    id="btn-delete-read-chapters"
                    onClick={async () => {
                      const readChapterIds = chapters.filter((c) => c.read).map((c) => c.id);
                      if (readChapterIds.length === 0) return;
                      if (!window.confirm(`Delete all ${readChapterIds.length} read chapters?`)) return;
                      setIsDeletingBatch(true);
                      try {
                        await fetch('/api/v1/chapter/delete-batch', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ chapterIds: readChapterIds }),
                        });
                        setChapters((prev) => prev.filter((c) => !readChapterIds.includes(c.id)));
                        showDownloadNotice(`Deleted ${readChapterIds.length} read chapters`);
                      } finally {
                        setIsDeletingBatch(false);
                      }
                    }}
                    disabled={isDeletingBatch}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/40 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Read ({chapters.filter((c) => c.read).length})</span>
                  </button>
                )}

                {chapters.length > 0 && (
                  <button
                    id="btn-toggle-batch-mode"
                    onClick={() => {
                      setIsBatchMode(!isBatchMode);
                      setSelectedChapterIdsForBatch([]);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isBatchMode
                        ? 'bg-rose-600 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{isBatchMode ? 'Cancel Selection' : 'Select Chapters'}</span>
                  </button>
                )}

                {chapters.length > 0 && (
                  <button
                    id="btn-mark-all-read"
                    onClick={() => {
                      const allRead = chapters.every((c) => c.read);
                      onMarkAllRead(manga.id, !allRead);
                      setChapters((prev) => prev.map((c) => ({ ...c, read: !allRead })));
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer px-2 py-1"
                  >
                    {chapters.every((c) => c.read) ? 'Mark unread' : 'Mark all read'}
                  </button>
                )}
              </div>
            </div>

            {/* Batch Delete Bar */}
            {isBatchMode && (
              <div className="flex items-center justify-between gap-3 bg-red-950/30 border border-red-800/50 p-3 rounded-2xl animate-fadeIn">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-red-300">
                    {selectedChapterIdsForBatch.length} chapter(s) selected
                  </span>
                  <button
                    onClick={() => {
                      if (selectedChapterIdsForBatch.length === chapters.length) {
                        setSelectedChapterIdsForBatch([]);
                      } else {
                        setSelectedChapterIdsForBatch(chapters.map((c) => c.id));
                      }
                    }}
                    className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    {selectedChapterIdsForBatch.length === chapters.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                <button
                  id="btn-delete-selected-batch"
                  disabled={selectedChapterIdsForBatch.length === 0 || isDeletingBatch}
                  onClick={handleDeleteBatchChapters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isDeletingBatch ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected ({selectedChapterIdsForBatch.length})</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Chapter Search & Sort */}
            {chapters.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={chapterFilter}
                      onChange={(e) => {
                        setChapterFilter(e.target.value);
                        setChapterPage(1);
                      }}
                      placeholder="Search chapter title or number..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                    />
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    {chapterFilter && (
                      <button
                        onClick={() => {
                          setChapterFilter('');
                          setChapterPage(1);
                        }}
                        className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    id="btn-toggle-chapter-sort"
                    onClick={() => {
                      setChapterSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                      setChapterPage(1);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer shrink-0"
                    title={chapterSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-rose-400" />
                    <span>{chapterSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                  </button>
                </div>

                {/* Pagination Controls Header */}
                {(() => {
                  const filteredChs = chapters.filter((ch) => {
                    if (!chapterFilter.trim()) return true;
                    const q = chapterFilter.toLowerCase().trim();
                    if (ch.name.toLowerCase().includes(q)) return true;
                    if (ch.scanlator && ch.scanlator.toLowerCase().includes(q)) return true;
                    const cleanNumStr = q.replace(/^(ch|chapter|vol|volume|v)\.?\s*/i, '').trim();
                    const parsedNum = parseFloat(cleanNumStr);
                    if (!isNaN(parsedNum) && cleanNumStr.length > 0) {
                      if (ch.chapterNumber === parsedNum) return true;
                      if (String(ch.chapterNumber) === cleanNumStr || String(ch.chapterNumber).startsWith(cleanNumStr)) {
                        return true;
                      }
                    }
                    return String(ch.chapterNumber).includes(q);
                  });

                  const totalFiltered = filteredChs.length;
                  if (totalFiltered === 0) return null;

                  const effSize = pageSize === 'all' ? totalFiltered || 1 : (pageSize as number);
                  const maxP = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalFiltered / effSize));
                  const curP = Math.min(Math.max(1, chapterPage), maxP);
                  const sIdx = (curP - 1) * effSize;
                  const eIdx = pageSize === 'all' ? totalFiltered : Math.min(sIdx + effSize, totalFiltered);

                  return (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span>
                          Showing <strong className="text-zinc-200">{sIdx + 1}</strong>–<strong className="text-zinc-200">{eIdx}</strong> of <strong className="text-zinc-200">{totalFiltered}</strong> chapters
                        </span>
                        {totalFiltered !== chapters.length && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                            (Filtered from {chapters.length})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-zinc-500">Per page:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                              setPageSize(val as any);
                              setChapterPage(1);
                            }}
                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                          >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value="all">All ({totalFiltered})</option>
                          </select>
                        </div>

                        {pageSize !== 'all' && maxP > 1 && (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={curP === 1}
                              onClick={() => setChapterPage(1)}
                              className="p-1 rounded-lg bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                              title="First Page"
                            >
                              <ChevronsLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={curP === 1}
                              onClick={() => setChapterPage((p) => Math.max(1, p - 1))}
                              className="p-1 rounded-lg bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                              title="Previous Page"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 text-xs text-zinc-300 font-medium">
                              Page {curP} of {maxP}
                            </span>
                            <button
                              disabled={curP >= maxP}
                              onClick={() => setChapterPage((p) => Math.min(maxP, p + 1))}
                              className="p-1 rounded-lg bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                              title="Next Page"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={curP >= maxP}
                              onClick={() => setChapterPage(maxP)}
                              className="p-1 rounded-lg bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                              title="Last Page"
                            >
                              <ChevronsRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Chapters Rows List */}
            {isLoadingChapters ? (
              <div className="py-16 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                <span>Loading chapter list...</span>
              </div>
            ) : chapters.length === 0 ? (
              <div className="py-16 px-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                  <UploadCloud className="w-7 h-7 text-rose-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-zinc-200">No chapters found for this manga</h4>
                  <p className="text-xs text-zinc-400 max-w-md">
                    Upload your local .cbz, .zip, or image folders to start reading and generating panel-by-panel videos!
                  </p>
                </div>
                <button
                  onClick={() => setIsUploadChapterModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-950/50 transition-all cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload First Chapter (.cbz / images)</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-900/30">
                {(() => {
                  const filtered = chapters
                    .filter((ch) => {
                      if (!chapterFilter.trim()) return true;
                      const q = chapterFilter.toLowerCase().trim();
                      if (ch.name.toLowerCase().includes(q)) return true;
                      if (ch.scanlator && ch.scanlator.toLowerCase().includes(q)) return true;
                      const cleanNumStr = q.replace(/^(ch|chapter|vol|volume|v)\.?\s*/i, '').trim();
                      const parsedNum = parseFloat(cleanNumStr);
                      if (!isNaN(parsedNum) && cleanNumStr.length > 0) {
                        if (ch.chapterNumber === parsedNum) return true;
                        if (String(ch.chapterNumber) === cleanNumStr || String(ch.chapterNumber).startsWith(cleanNumStr)) {
                          return true;
                        }
                      }
                      return String(ch.chapterNumber).includes(q);
                    })
                    .sort((a, b) => {
                      if (chapterSortOrder === 'desc') {
                        return b.chapterNumber - a.chapterNumber;
                      }
                      return a.chapterNumber - b.chapterNumber;
                    });

                  const effSize = pageSize === 'all' ? filtered.length || 1 : (pageSize as number);
                  const startIndex = (chapterPage - 1) * effSize;
                  const paginatedChapters =
                    pageSize === 'all' ? filtered : filtered.slice(startIndex, startIndex + effSize);

                  return paginatedChapters.map((ch) => (
                    <div
                      key={ch.id}
                      className={`p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-zinc-800/40 transition-colors ${
                        ch.read ? 'opacity-65' : ''
                      }`}
                    >
                      {/* Left: Checkbox or Read indicator + Chapter Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {isBatchMode ? (
                          <button
                            onClick={() => {
                              setSelectedChapterIdsForBatch((prev) =>
                                prev.includes(ch.id)
                                  ? prev.filter((id) => id !== ch.id)
                                  : [...prev, ch.id]
                              );
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                          >
                            {selectedChapterIdsForBatch.includes(ch.id) ? (
                              <CheckSquare className="w-4 h-4 text-rose-500" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-600" />
                            )}
                          </button>
                        ) : null}

                        <button
                          id={`btn-chapter-read-toggle-${ch.id}`}
                          onClick={() => {
                            onToggleChapterRead(ch);
                            setChapters((prev) =>
                              prev.map((c) => (c.id === ch.id ? { ...c, read: !c.read } : c))
                            );
                          }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            ch.read
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-300'
                          }`}
                          title={ch.read ? 'Mark Unread' : 'Mark Read'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-zinc-200 truncate">
                            {ch.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                            <span>{ch.scanlator || 'Source'}</span>
                            <span>•</span>
                            <span>{new Date(ch.uploadDate).toLocaleDateString()}</span>
                            {ch.pageCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-400">{ch.pageCount} pages</span>
                              </>
                            )}
                            {ch.lastPageRead > 0 && !ch.read && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400">
                                  Page {ch.lastPageRead} of {ch.pageCount}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Download Chapter */}
                        <button
                          onClick={() => handleDownloadSingle(ch.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Download Chapter"
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                        </button>

                        {/* Bookmark Chapter */}
                        <button
                          id={`btn-chapter-bookmark-${ch.id}`}
                          onClick={() => {
                            onToggleChapterBookmark(ch);
                            setChapters((prev) =>
                              prev.map((c) => (c.id === ch.id ? { ...c, bookmark: !c.bookmark } : c))
                            );
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            ch.bookmark
                              ? 'text-amber-400'
                              : 'text-zinc-600 hover:text-zinc-400'
                          }`}
                          title="Bookmark Chapter"
                        >
                          <Star className={`w-4 h-4 ${ch.bookmark ? 'fill-current' : ''}`} />
                        </button>

                        {/* ✂️ Crop Panels & Replace CBZ (User Requested Feature) */}
                        <button
                          id={`btn-crop-chapter-${ch.id}`}
                          onClick={() => setSelectedCropChapter(ch)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-950/40 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="Crop Overall Image into Panels & Replace CBZ"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Crop &amp; CBZ</span>
                        </button>

                        {/* AI Video Studio Button */}
                        <button
                          id={`btn-video-chapter-${ch.id}`}
                          onClick={() => setSelectedVideoChapter(ch)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                          title="AI Webtoon Video & Story Studio"
                        >
                          <Film className="w-3.5 h-3.5 text-rose-400" />
                          <span className="hidden sm:inline">Video Studio</span>
                        </button>

                        {/* Read Chapter Button */}
                        <button
                          id={`btn-read-chapter-${ch.id}`}
                          onClick={() => onReadChapter(manga, ch)}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-rose-600 hover:text-white text-zinc-300 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Read</span>
                        </button>

                        {/* Chapter Delete Button with Confirmation */}
                        {confirmDeleteChapterId === ch.id ? (
                          <div className="flex items-center gap-1 bg-red-950/90 border border-red-800 rounded-lg p-1 animate-fadeIn">
                            <span className="text-[11px] text-red-300 font-medium px-1">Delete?</span>
                            <button
                              disabled={isDeletingChapter}
                              onClick={() => handleDeleteChapter(ch)}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50"
                            >
                              {isDeletingChapter ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteChapterId(null)}
                              className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`btn-delete-chapter-${ch.id}`}
                            onClick={() => setConfirmDeleteChapterId(ch.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Delete Chapter from Database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TRACKERS */}
      {activeTab === 'trackers' && (
        <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800/80 space-y-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Manga Progress Trackers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Service</label>
              <select
                value={trackerService}
                onChange={(e) => setTrackerService(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
              >
                <option value="AniList">AniList</option>
                <option value="MyAnimeList">MyAnimeList</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Status</label>
              <select
                value={trackerStatus}
                onChange={(e) => setTrackerStatus(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
              >
                <option value="reading">Reading</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Score (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={trackerScore}
                onChange={(e) => setTrackerScore(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
          </div>
          <button
            onClick={handleSaveTracker}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow cursor-pointer"
          >
            Save Tracker
          </button>
        </div>
      )}

      {/* TAB 3: EDIT METADATA */}
      {activeTab === 'edit' && (
        <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Edit Manga Metadata
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
              >
                <option value="ONGOING">ONGOING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="HIATUS">HIATUS</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Author</label>
              <input
                type="text"
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Artist</label>
              <input
                type="text"
                value={editArtist}
                onChange={(e) => setEditArtist(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Description</label>
            <textarea
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200"
            />
          </div>
          <button
            onClick={handleSaveMetadata}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      )}

      {/* Delete Manga Confirmation Modal */}
      {isConfirmingDeleteManga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-950 border border-red-800/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Entire Manga Series?</h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">&quot;{manga.title}&quot;</strong> and all{' '}
              <strong className="text-red-400">{chapters.length} chapters</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsConfirmingDeleteManga(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeletingManga}
                onClick={handleDeleteManga}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-950/50 cursor-pointer disabled:opacity-50"
              >
                {isDeletingManga ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✂️ Overall Image Panel Cropper & CBZ Replacer Modal */}
      {selectedCropChapter && (
        <PanelCropperModal
          isOpen={!!selectedCropChapter}
          onClose={() => setSelectedCropChapter(null)}
          manga={manga}
          chapter={selectedCropChapter}
          onSuccessReplace={(updatedChapter) => {
            setChapters((prev) =>
              prev.map((c) => (c.id === updatedChapter.id ? updatedChapter : c))
            );
            showDownloadNotice(`Chapter ${updatedChapter.name || updatedChapter.chapterNumber} replaced with cropped panels!`);
          }}
          onOpenVideoStudio={(m, ch) => {
            setSelectedCropChapter(null);
            setSelectedVideoChapter(ch);
          }}
          onOpenReader={(m, ch) => {
            setSelectedCropChapter(null);
            onReadChapter(m, ch);
          }}
        />
      )}

      {/* AI Video Studio Modal */}
      {selectedVideoChapter && (
        <WebtoonVideoStudioModal
          isOpen={!!selectedVideoChapter}
          onClose={() => setSelectedVideoChapter(null)}
          manga={manga}
          chapter={selectedVideoChapter}
        />
      )}

      {/* Upload Chapter Modal */}
      <UploadChapterModal
        isOpen={isUploadChapterModalOpen}
        onClose={() => setIsUploadChapterModalOpen(false)}
        manga={manga}
        currentChaptersCount={chapters.length}
        onUploadSuccess={(updatedManga, newChapters) => {
          setChapters((prev) => [...newChapters, ...prev]);
          if (onMangaUpdated) onMangaUpdated(updatedManga);
          showDownloadNotice(`Successfully added ${newChapters.length} chapter(s)!`);
        }}
        onReadChapter={(ch) => onReadChapter(manga, ch)}
      />
    </div>
  );
};
