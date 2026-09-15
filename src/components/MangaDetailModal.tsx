import React, { useState, useEffect } from 'react';
import {
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
} from 'lucide-react';
import { Manga, Chapter, Category, TrackerItem } from '../types.js';
import { WebtoonVideoStudioModal } from './WebtoonVideoStudioModal.js';
import { UploadChapterModal } from './UploadChapterModal.js';

interface MangaDetailModalProps {
  manga: Manga | null;
  categories: Category[];
  onClose: () => void;
  onToggleLibrary: (manga: Manga) => void;
  onUpdateCategories: (mangaId: number, categoryIds: number[]) => void;
  onReadChapter: (manga: Manga, chapter: Chapter) => void;
  onToggleChapterRead: (chapter: Chapter) => void;
  onToggleChapterBookmark: (chapter: Chapter) => void;
  onMarkAllRead: (mangaId: number, read: boolean) => void;
  onMangaUpdated?: (updatedManga: Manga) => void;
  onDeleteManga?: (mangaId: number) => void;
}

export const MangaDetailModal: React.FC<MangaDetailModalProps> = ({
  manga,
  categories,
  onClose,
  onToggleLibrary,
  onUpdateCategories,
  onReadChapter,
  onToggleChapterRead,
  onToggleChapterBookmark,
  onMarkAllRead,
  onMangaUpdated,
  onDeleteManga,
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
  const [selectedVideoChapter, setSelectedVideoChapter] = useState<Chapter | null>(null);

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

  // Chapter Upload modal state
  const [isUploadChapterModalOpen, setIsUploadChapterModalOpen] = useState(false);

  useEffect(() => {
    if (!manga) return;
    let isMounted = true;
    setIsLoadingChapters(true);

    // Initial edit states
    setEditTitle(manga.title);
    setEditAuthor(manga.author || '');
    setEditArtist(manga.artist || '');
    setEditStatus(manga.status || 'ONGOING');
    setEditDescription(manga.description || '');

    // Fetch chapters
    fetch(`/api/v1/manga/${manga.id}/chapters`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setChapters(data || []);
        }
      })
      .catch((err) => console.error('Failed to load chapters:', err))
      .finally(() => {
        if (isMounted) setIsLoadingChapters(false);
      });

    // Fetch trackers
    fetch(`/api/v1/track/${manga.id}`)
      .then(async (res) => {
        if (!res.ok) return [];
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return [];
        return res.json();
      })
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setTrackers(data);
          if (data.length > 0) {
            setTrackerStatus(data[0].status || 'reading');
            setTrackerScore(data[0].score || 8);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [manga]);

  if (!manga) return null;

  const firstUnreadChapter =
    chapters.slice().reverse().find((c) => !c.read) || chapters[0];

  const handleCategoryToggle = (catId: number) => {
    const current = manga.categories || [];
    const updated = current.includes(catId)
      ? current.filter((id) => id !== catId)
      : [...current, catId];
    onUpdateCategories(manga.id, updated);
  };

  const handleDownloadSingle = async (chapterId: number) => {
    try {
      const res = await fetch(`/api/v1/download/${chapterId}`, { method: 'POST' });
      if (res.ok) {
        showDownloadNotice('Chapter queued for download');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadBatch = async (count: number | 'all') => {
    const unread = chapters.filter((c) => !c.read);
    const toDownload = count === 'all' ? unread : unread.slice(0, count);
    if (toDownload.length === 0) {
      showDownloadNotice('No unread chapters to download');
      return;
    }

    try {
      const chapterIds = toDownload.map((c) => c.id);
      const res = await fetch('/api/v1/download/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIds }),
      });
      if (res.ok) {
        showDownloadNotice(`Queued ${toDownload.length} chapters for download`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const showDownloadNotice = (msg: string) => {
    setDownloadNotice(msg);
    setTimeout(() => setDownloadNotice(''), 3000);
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
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
        showDownloadNotice('Manga metadata updated');
        setActiveTab('chapters');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveTracker = async () => {
    try {
      const res = await fetch('/api/v1/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mangaId: manga.id,
          trackerService,
          title: manga.title,
          status: trackerStatus,
          score: trackerScore,
          lastChapterRead: chapters.filter((c) => c.read).length,
          totalChapters: chapters.length,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setTrackers([saved]);
        showDownloadNotice(`Synced with ${trackerService}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete manga completely
  const handleDeleteManga = async () => {
    if (!manga) return;
    setIsDeletingManga(true);
    try {
      const res = await fetch(`/api/v1/manga/${manga.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (onDeleteManga) {
          onDeleteManga(manga.id);
        }
        onClose();
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

  // Delete single chapter
  const handleDeleteChapter = async (chapter: Chapter) => {
    setIsDeletingChapter(true);
    try {
      const res = await fetch(`/api/v1/chapter/${chapter.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setChapters((prev) => prev.filter((c) => c.id !== chapter.id));
        showDownloadNotice(`Deleted ${chapter.name}`);
        if (onMangaUpdated && manga) {
          onMangaUpdated({
            ...manga,
            chaptersCount: data.chaptersCount !== undefined ? data.chaptersCount : Math.max(0, chapters.length - 1),
            unreadCount: data.unreadCount !== undefined ? data.unreadCount : manga.unreadCount,
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
      setConfirmDeleteChapterId(null);
    }
  };

  // Batch delete selected chapters
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
        if (onMangaUpdated && manga) {
          onMangaUpdated({
            ...manga,
            chaptersCount: remainingCount,
          });
        }
      } else {
        const err = await res.json();
        alert(`Failed to delete chapters: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Failed to delete chapters: ${err.message}`);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Delete all read chapters
  const handleDeleteAllReadChapters = async () => {
    const readChapterIds = chapters.filter((c) => c.read).map((c) => c.id);
    if (readChapterIds.length === 0) {
      showDownloadNotice('No read chapters to delete');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${readChapterIds.length} read chapter(s)?`)) {
      return;
    }
    setIsDeletingBatch(true);
    try {
      const res = await fetch('/api/v1/chapter/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIds: readChapterIds }),
      });
      if (res.ok) {
        setChapters((prev) => prev.filter((c) => !readChapterIds.includes(c.id)));
        showDownloadNotice(`Deleted ${readChapterIds.length} read chapters`);
        const remainingCount = Math.max(0, chapters.length - readChapterIds.length);
        if (onMangaUpdated && manga) {
          onMangaUpdated({
            ...manga,
            chaptersCount: remainingCount,
          });
        }
      }
    } catch (err: any) {
      alert(`Failed to delete read chapters: ${err.message}`);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Backdrop Banner */}
        <div className="relative h-40 sm:h-52 w-full overflow-hidden bg-zinc-900 shrink-0">
          {manga.thumbnailUrl ? (
            <img
              src={manga.thumbnailUrl}
              alt={manga.title}
              className="w-full h-full object-cover blur-xl opacity-30 scale-110"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

          {/* Close Button */}
          <button
            id="btn-close-manga-modal"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/50 backdrop-blur transition-all cursor-pointer z-20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Info Layout */}
        <div className="relative px-6 -mt-20 sm:-mt-24 flex flex-col sm:flex-row gap-6 shrink-0 z-10">
          {/* Cover Poster */}
          <div className="w-28 sm:w-36 aspect-[2/3] shrink-0 rounded-xl overflow-hidden shadow-2xl border-2 border-zinc-800 bg-zinc-900 mx-auto sm:mx-0 flex items-center justify-center">
            {manga.thumbnailUrl ? (
              <img
                src={manga.thumbnailUrl}
                alt={manga.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-xs p-2 text-center">
                {manga.title}
              </div>
            )}
          </div>

          {/* Titles & Meta */}
          <div className="flex-1 flex flex-col justify-end space-y-2.5 text-center sm:text-left">
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                  {manga.status}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-300 capitalize">
                  {manga.sourceId}
                </span>
                {downloadNotice && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 animate-fadeIn">
                    <CheckCircle2 className="w-3 h-3" />
                    {downloadNotice}
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{manga.title}</h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                {manga.author ? `By ${manga.author}` : ''}
                {manga.artist && manga.artist !== manga.author ? ` • Art by ${manga.artist}` : ''}
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              {firstUnreadChapter && (
                <button
                  id="btn-read-first-unread"
                  onClick={() => onReadChapter(manga, firstUnreadChapter)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {chapters.some((c) => c.read)
                      ? `Continue Ch. ${firstUnreadChapter.chapterNumber}`
                      : 'Start Reading'}
                  </span>
                </button>
              )}

              {/* Library Button */}
              <button
                id="btn-modal-toggle-library"
                onClick={() => onToggleLibrary(manga)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  manga.inLibrary
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                }`}
              >
                {manga.inLibrary ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>In Library</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add to Library</span>
                  </>
                )}
              </button>

              {/* Shelves / Category Picker */}
              {manga.inLibrary && (
                <div className="relative">
                  <button
                    onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Categories</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  {isCategoryPickerOpen && (
                    <div className="absolute top-full mt-2 left-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-30 space-y-1">
                      <p className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-1">
                        Select Shelves
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

        {/* Navigation Tabs (Chapters, Tracking, Edit Metadata, Upload Chapter) */}
        <div className="px-6 pt-4 border-b border-zinc-800/80 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('chapters')}
            className={`px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'chapters'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Chapters ({chapters.length})
          </button>

          <button
            onClick={() => setActiveTab('trackers')}
            className={`px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'trackers'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tracking {trackers.length > 0 && `(${trackers.length})`}
          </button>

          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'edit'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Edit Metadata
          </button>

          <button
            id="tab-upload-chapter-btn"
            onClick={() => setIsUploadChapterModalOpen(true)}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/15 hover:bg-rose-600/30 text-rose-300 hover:text-white border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1.5"
            title="Upload Chapter to this series"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>+ Upload Chapter</span>
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: CHAPTERS */}
          {activeTab === 'chapters' && (
            <>
              {/* Synopsis */}
              {manga.description && (
                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/80">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
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

              {/* Chapters List & Download Controls Header */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/80">
                  {/* Download batch buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-zinc-400 mr-1 flex items-center gap-1">
                      <ArrowDownToLine className="w-3.5 h-3.5 text-rose-400" />
                      Download:
                    </span>
                    <button
                      onClick={() => handleDownloadBatch(1)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                    >
                      Next 1
                    </button>
                    <button
                      onClick={() => handleDownloadBatch(5)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                    >
                      Next 5
                    </button>
                    <button
                      onClick={() => handleDownloadBatch('all')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                    >
                      All Unread
                    </button>
                  </div>

                  {/* Action buttons on right */}
                  <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                    <button
                      id="btn-upload-chapter-list"
                      onClick={() => setIsUploadChapterModalOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition-colors cursor-pointer"
                      title="Upload chapter (.cbz, .zip, or images) to this manga"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Upload Chapter</span>
                    </button>

                    {chapters.some((c) => c.read) && (
                      <button
                        id="btn-delete-read-chapters"
                        onClick={handleDeleteAllReadChapters}
                        disabled={isDeletingBatch}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/40 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete all read chapters from database"
                      >
                        <Trash2 className="w-3 h-3" />
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
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                          isBatchMode
                            ? 'bg-rose-600 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                        title="Toggle batch selection to delete multiple chapters"
                      >
                        <CheckSquare className="w-3 h-3" />
                        <span>{isBatchMode ? 'Cancel Select' : 'Select'}</span>
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
                        className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        {chapters.every((c) => c.read) ? 'Mark unread' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Batch Delete Bar when isBatchMode */}
                {isBatchMode && (
                  <div className="flex items-center justify-between gap-3 bg-red-950/30 border border-red-800/50 p-2.5 rounded-xl animate-fadeIn">
                    <div className="flex items-center gap-2 text-xs">
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
                        className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        {selectedChapterIdsForBatch.length === chapters.length ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>

                    <button
                      id="btn-delete-selected-batch"
                      disabled={selectedChapterIdsForBatch.length === 0 || isDeletingBatch}
                      onClick={handleDeleteBatchChapters}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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

                {/* Chapter Filter & Sort Controls */}
                {chapters.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={chapterFilter}
                          onChange={(e) => {
                            setChapterFilter(e.target.value);
                            setChapterPage(1);
                          }}
                          placeholder="Search chapter title or number..."
                          className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                        />
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
                        {chapterFilter && (
                          <button
                            onClick={() => {
                              setChapterFilter('');
                              setChapterPage(1);
                            }}
                            className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <button
                        id="btn-toggle-chapter-sort"
                        onClick={() => {
                          setChapterSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                          setChapterPage(1);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer shrink-0"
                        title={chapterSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-rose-400" />
                        <span>{chapterSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                      </button>
                    </div>

                    {/* Pagination Bar Header */}
                    {(() => {
                      const filteredChs = chapters
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
                        });

                      const totalFiltered = filteredChs.length;
                      if (totalFiltered === 0) return null;

                      const effSize = pageSize === 'all' ? totalFiltered || 1 : (pageSize as number);
                      const maxP = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalFiltered / effSize));
                      const curP = Math.min(Math.max(1, chapterPage), maxP);
                      const sIdx = (curP - 1) * effSize;
                      const eIdx = pageSize === 'all' ? totalFiltered : Math.min(sIdx + effSize, totalFiltered);

                      return (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs text-zinc-400">
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
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-zinc-500">Per page:</span>
                              <select
                                value={pageSize}
                                onChange={(e) => {
                                  const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                                  setPageSize(val as any);
                                  setChapterPage(1);
                                }}
                                className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
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
                                  className="p-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                                  title="First Page"
                                >
                                  <ChevronsLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={curP === 1}
                                  onClick={() => setChapterPage((p) => Math.max(1, p - 1))}
                                  className="p-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
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
                                  className="p-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                                  title="Next Page"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={curP >= maxP}
                                  onClick={() => setChapterPage(maxP)}
                                  className="p-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
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

                {isLoadingChapters ? (
                  <div className="py-8 text-center text-zinc-500 text-xs">Loading chapters...</div>
                ) : chapters.length === 0 ? (
                  <div className="py-10 px-4 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                      <UploadCloud className="w-6 h-6 text-rose-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-zinc-200">No chapters available yet</h4>
                      <p className="text-xs text-zinc-400 max-w-sm">
                        Upload your local .cbz, .zip, or image pages to add chapters to this series.
                      </p>
                    </div>
                    <button
                      id="btn-empty-upload-chapter"
                      type="button"
                      onClick={() => setIsUploadChapterModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-950/50 transition-all cursor-pointer mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload First Chapter</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-900/30">
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
                            if (chapterSortOrder === 'asc') {
                              return a.chapterNumber - b.chapterNumber;
                            }
                            return b.chapterNumber - a.chapterNumber;
                          });

                        const totalFiltered = filtered.length;
                        const effSize = pageSize === 'all' ? totalFiltered || 1 : (pageSize as number);
                        const maxP = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalFiltered / effSize));
                        const curP = Math.min(Math.max(1, chapterPage), maxP);
                        const sIdx = (curP - 1) * effSize;
                        const eIdx = pageSize === 'all' ? totalFiltered : Math.min(sIdx + effSize, totalFiltered);

                        const pageItems = filtered.slice(sIdx, eIdx);

                        if (pageItems.length === 0) {
                          return <div className="py-8 text-center text-zinc-500 text-xs">No matching chapters found.</div>;
                        }

                        return pageItems.map((ch) => (
                          <div
                            key={ch.id}
                            id={`chapter-row-${ch.id}`}
                            className={`flex items-center justify-between p-3.5 hover:bg-zinc-800/50 transition-colors ${
                              ch.read ? 'opacity-60 bg-zinc-950/20' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-4">
                              {isBatchMode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedChapterIdsForBatch((prev) =>
                                      prev.includes(ch.id) ? prev.filter((id) => id !== ch.id) : [...prev, ch.id]
                                    );
                                  }}
                                  className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                                  title="Select chapter"
                                >
                                  {selectedChapterIdsForBatch.includes(ch.id) ? (
                                    <CheckSquare className="w-4 h-4 text-rose-500" />
                                  ) : (
                                    <Square className="w-4 h-4 text-zinc-600" />
                                  )}
                                </button>
                              )}

                              <button
                                id={`btn-chapter-check-${ch.id}`}
                                onClick={() => {
                                  onToggleChapterRead(ch);
                                  setChapters((prev) =>
                                    prev.map((c) => (c.id === ch.id ? { ...c, read: !c.read } : c))
                                  );
                                }}
                                className={`w-5 h-5 rounded flex items-center justify-center border transition-all cursor-pointer ${
                                  ch.read
                                    ? 'bg-rose-600 border-rose-600 text-white'
                                    : 'border-zinc-700 hover:border-zinc-500 text-transparent'
                                }`}
                                title={ch.read ? 'Mark Unread' : 'Mark Read'}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-zinc-200 truncate">
                                  {ch.name}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                                  <span>{ch.scanlator || 'Scanlation'}</span>
                                  <span>•</span>
                                  <span>{new Date(ch.uploadDate).toLocaleDateString()}</span>
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

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleDownloadSingle(ch.id)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Download Chapter"
                              >
                                <ArrowDownToLine className="w-4 h-4" />
                              </button>

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

                              <button
                                id={`btn-video-chapter-${ch.id}`}
                                onClick={() => setSelectedVideoChapter(ch)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                title="AI Webtoon Video & Story Studio"
                              >
                                <Film className="w-3.5 h-3.5 text-rose-400" />
                                <span className="hidden sm:inline">Video & Story</span>
                              </button>

                              <button
                                id={`btn-read-chapter-${ch.id}`}
                                onClick={() => onReadChapter(manga, ch)}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-rose-600 hover:text-white text-zinc-300 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>Read</span>
                              </button>

                              {/* Chapter Delete Button with Inline Confirmation */}
                              {confirmDeleteChapterId === ch.id ? (
                                <div className="flex items-center gap-1 bg-red-950/90 border border-red-800 rounded-lg p-1 animate-fadeIn">
                                  <span className="text-[11px] text-red-300 font-medium px-1">Delete?</span>
                                  <button
                                    id={`btn-confirm-delete-ch-${ch.id}`}
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

                    {/* Pagination Bar Footer */}
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
                      if (totalFiltered <= 25 || pageSize === 'all') return null;

                      const effSize = pageSize as number;
                      const maxP = Math.max(1, Math.ceil(totalFiltered / effSize));
                      const curP = Math.min(Math.max(1, chapterPage), maxP);

                      return (
                        <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs text-zinc-400">
                          <span>
                            Page <strong className="text-zinc-200">{curP}</strong> of <strong className="text-zinc-200">{maxP}</strong>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              disabled={curP === 1}
                              onClick={() => setChapterPage(1)}
                              className="p-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                              title="First Page"
                            >
                              <ChevronsLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={curP === 1}
                              onClick={() => setChapterPage((p) => Math.max(1, p - 1))}
                              className="p-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                              title="Previous Page"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 text-xs text-zinc-300 font-medium">
                              {curP} / {maxP}
                            </span>
                            <button
                              disabled={curP >= maxP}
                              onClick={() => setChapterPage((p) => Math.min(maxP, p + 1))}
                              className="p-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                              title="Next Page"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={curP >= maxP}
                              onClick={() => setChapterPage(maxP)}
                              className="p-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                              title="Last Page"
                            >
                              <ChevronsRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: TRACKERS */}
          {activeTab === 'trackers' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-rose-500" />
                    Manga Tracking Sync
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTrackerService('AniList')}
                      className={`px-2.5 py-1 rounded text-xs font-medium ${
                        trackerService === 'AniList'
                          ? 'bg-rose-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      AniList
                    </button>
                    <button
                      onClick={() => setTrackerService('MyAnimeList')}
                      className={`px-2.5 py-1 rounded text-xs font-medium ${
                        trackerService === 'MyAnimeList'
                          ? 'bg-rose-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      MyAnimeList
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Reading Status</label>
                    <select
                      value={trackerStatus}
                      onChange={(e) => setTrackerStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="reading">Reading</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                      <option value="dropped">Dropped</option>
                      <option value="plan_to_read">Plan to Read</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Score (0 - 10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={trackerScore}
                      onChange={(e) => setTrackerScore(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="text-xs text-zinc-400 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
                  <p>
                    Progress will be synchronized to {trackerService}:{' '}
                    <span className="text-white font-semibold">
                      {chapters.filter((c) => c.read).length} of {chapters.length} chapters read
                    </span>
                  </p>
                </div>

                <button
                  onClick={handleSaveTracker}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition-all cursor-pointer"
                >
                  Sync to {trackerService}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EDIT METADATA */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveMetadata} className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Author</label>
                  <input
                    type="text"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Artist</label>
                  <input
                    type="text"
                    value={editArtist}
                    onChange={(e) => setEditArtist(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="ONGOING">ONGOING</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="HIATUS">HIATUS</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Description</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>

              {/* Danger Zone */}
              <div className="pt-6 mt-6 border-t border-red-900/30">
                <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Danger Zone
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Permanently delete this manga, its {chapters.length} chapters, reading history, and studio data.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="btn-danger-zone-delete-manga"
                    onClick={() => setIsConfirmingDeleteManga(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/50 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Manga</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Delete Manga Confirmation Modal Dialog */}
      {isConfirmingDeleteManga && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-900 border border-red-800/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-800/60 flex items-center justify-center shrink-0 text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Manga Permanently?</h3>
                <p className="text-xs text-zinc-400">This operation is irreversible.</p>
              </div>
            </div>

            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 space-y-1">
              <p>
                Are you sure you want to delete <span className="font-semibold text-white">"{manga.title}"</span>?
              </p>
              <ul className="list-disc list-inside text-[11px] text-zinc-400 pt-1 space-y-0.5">
                <li>All <strong className="text-zinc-300">{chapters.length} chapters</strong> will be deleted.</li>
                <li>Reading history, progress, and bookmarks will be removed.</li>
                <li>Associated AI Webtoon studio scripts and subtitles will be cleared.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingManga}
                onClick={() => setIsConfirmingDeleteManga(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-manga"
                type="button"
                disabled={isDeletingManga}
                onClick={handleDeleteManga}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-950/60 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingManga ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Manga</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVideoChapter && manga && (
        <WebtoonVideoStudioModal
          manga={manga}
          chapter={selectedVideoChapter}
          onClose={() => setSelectedVideoChapter(null)}
        />
      )}

      {isUploadChapterModalOpen && manga && (
        <UploadChapterModal
          isOpen={isUploadChapterModalOpen}
          onClose={() => setIsUploadChapterModalOpen(false)}
          manga={manga}
          currentChaptersCount={chapters.length}
          onUploadSuccess={(updatedManga, addedChapters) => {
            setChapters((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              const newItems = addedChapters.filter((c) => !existingIds.has(c.id));
              return [...prev, ...newItems];
            });
            showDownloadNotice(`Uploaded ${addedChapters.length} chapter(s) successfully!`);
            if (onMangaUpdated) {
              onMangaUpdated(updatedManga);
            }
          }}
          onReadChapter={(chapter) => {
            onReadChapter(manga, chapter);
          }}
        />
      )}
    </div>
  );
};
