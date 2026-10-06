'use client';

import React, { useEffect, useRef, useState, use } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { BookOpen, Film, Library, RefreshCw, Loader2, Upload, FileArchive, Trash2, AlertTriangle } from 'lucide-react';
import { uploadWithProgress, formatBytes } from '@/lib/uploadWithProgress';

export const dynamic = 'force-dynamic';

export default function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const seriesId = resolvedParams.id;

  const [series, setSeries] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);

  // CBZ upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [cbzFile, setCbzFile] = useState<File | null>(null);
  const [chapterNumber, setChapterNumber] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressLabel, setUploadProgressLabel] = useState('');

  // Delete state
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [confirmDeleteChapter, setConfirmDeleteChapter] = useState<string | null>(null);
  const [deletingSeries, setDeletingSeries] = useState(false);
  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadDetails = async () => {
    try {
      const [seriesRes, chaptersRes, libRes] = await Promise.all([
        fetch(`/api/series/${seriesId}`),
        fetch(`/api/chapters?seriesId=${seriesId}`),
        fetch('/api/library'),
      ]);
      const sData = await seriesRes.json();
      const cData = await chaptersRes.json();
      const lData = await libRes.json();

      if (sData.success) setSeries(sData.data);
      if (cData.success) setChapters(cData.data);
      if (lData.success) {
        const found = lData.data.find((item: any) => item.seriesId?._id === seriesId || item.seriesId === seriesId);
        setInLibrary(Boolean(found));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadDetails, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDetails();
  };

  const toggleLibrary = async () => {
    try {
      if (inLibrary) {
        await fetch(`/api/library?seriesId=${seriesId}`, { method: 'DELETE' });
        setInLibrary(false);
      } else {
        await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesId, isFavorite: true }),
        });
        setInLibrary(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbzFile) return setUploadError('Choose a .cbz file first');
    if (!chapterNumber.trim()) return setUploadError('Chapter number is required');
    setUploading(true);
    setUploadError('');
    setUploadProgress(0);
    setUploadProgressLabel('');
    try {
      const fd = new FormData();
      fd.append('cbz', cbzFile);
      fd.append('seriesId', seriesId);
      fd.append('chapterNumber', chapterNumber);
      if (chapterTitle.trim()) fd.append('title', chapterTitle.trim());
      const data = await uploadWithProgress('/api/chapters', fd, (pct, loaded, total) => {
        setUploadProgress(pct);
        setUploadProgressLabel(`${formatBytes(loaded)} / ${formatBytes(total)}`);
      });
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setUploadProgress(100);
      setCbzFile(null);
      setChapterNumber('');
      setChapterTitle('');
      if (fileRef.current) fileRef.current.value = '';
      await loadDetails();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadProgressLabel('');
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    setDeletingChapterId(chapterId);
    setDeleteError('');
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      setConfirmDeleteChapter(null);
      setChapters((prev) => prev.filter((c) => c._id !== chapterId));
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete chapter');
    } finally {
      setDeletingChapterId(null);
    }
  };

  const handleDeleteSeries = async () => {
    setDeletingSeries(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/series/${seriesId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      // Navigate away — series no longer exists
      window.location.href = '/';
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete series');
      setDeletingSeries(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-xl font-bold mb-2">Series Not Found</h1>
          <p className="text-neutral-400 text-sm mb-4">Create a series first, then upload chapter .cbz files.</p>
          <Link href="/" className="text-indigo-400 hover:underline">Return to Explore</Link>
        </div>
      </div>
    );
  }

  const inputCls =
    'bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-all';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar />

      {/* Banner & Header */}
      <div className="relative w-full h-[340px] sm:h-[420px] overflow-hidden">
        {series.bannerImage && (
          <img
            src={series.bannerImage}
            alt={series.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-30 blur-xs scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <div className="relative w-36 sm:w-48 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-900 flex-shrink-0 bg-neutral-900">
            {series.coverImage ? (
              <img
                src={series.coverImage}
                alt={series.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-700">
                <BookOpen className="w-10 h-10" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-indigo-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase">
                {series.status}
              </span>
              <span className="bg-neutral-800 text-neutral-300 text-xs font-medium px-3 py-1 rounded-full">
                {series.releaseYear}
              </span>
              <span className="bg-neutral-800 text-neutral-300 text-xs font-medium px-3 py-1 rounded-full">
                {series.language}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white mb-2">{series.title}</h1>
            {series.author && (
              <p className="text-sm text-neutral-400 mb-2">By <span className="text-neutral-200 font-semibold">{series.author}</span> {series.artist && `• Art by ${series.artist}`}</p>
            )}
            <p className="text-sm text-neutral-300 max-w-3xl line-clamp-3 mb-4">{series.description}</p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={toggleLibrary}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${
                  inLibrary ? 'bg-neutral-800 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <Library className="w-4 h-4" />
                <span>{inLibrary ? 'In My Library' : 'Save to Library'}</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-neutral-800 hover:bg-neutral-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border border-neutral-700 shadow"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              {!confirmDeleteSeries ? (
                <button
                  onClick={() => { setConfirmDeleteSeries(true); setDeleteError(''); }}
                  className="flex items-center space-x-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border border-red-500/30"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Series</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDeleteSeries}
                    disabled={deletingSeries}
                    className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow"
                  >
                    {deletingSeries ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{deletingSeries ? 'Deleting...' : 'Confirm Delete'}</span>
                  </button>
                  <button
                    onClick={() => setConfirmDeleteSeries(false)}
                    disabled={deletingSeries}
                    className="text-neutral-400 hover:text-white text-sm px-3 py-2.5 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chapter Upload */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
        <form onSubmit={handleUpload} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2 uppercase tracking-wider">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Upload Chapter (.cbz)</span>
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center space-x-2 bg-neutral-800 hover:bg-neutral-700 border border-dashed border-neutral-600 hover:border-indigo-500 text-neutral-300 px-4 py-2.5 rounded-xl text-sm transition-all"
            >
              <FileArchive className="w-4 h-4 text-indigo-400" />
              <span className="truncate max-w-[220px]">{cbzFile ? cbzFile.name : 'Choose .cbz file'}</span>
            </button>
            <input ref={fileRef} type="file" accept=".cbz,.zip" onChange={(e) => setCbzFile(e.target.files?.[0] || null)} className="hidden" />
            <input
              className={`${inputCls} w-28`}
              placeholder="Ch. #"
              type="number"
              step="any"
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
            />
            <input
              className={`${inputCls} flex-1`}
              placeholder="Chapter title (optional)"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
            />
            <button
              type="submit"
              disabled={uploading || !cbzFile}
              className="inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? 'Uploading…' : 'Upload'}</span>
            </button>
          </div>
          {/* Upload progress */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>{uploadProgressLabel || 'Preparing…'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
          <p className="text-[11px] text-neutral-500">A .cbz is a ZIP archive of the chapter&apos;s page images. Pages are extracted and stored in MinIO.</p>
        </form>

        {deleteError && (
          <div className="bg-red-600/20 border border-red-500/30 rounded-xl px-4 py-3 flex items-center space-x-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError('')} className="ml-auto text-red-400 hover:text-white text-xs">Dismiss</button>
          </div>
        )}

        {/* Chapters Section */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Chapters ({chapters.length})</span>
          </h2>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/50 rounded-2xl border border-neutral-800">
            <FileArchive className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-sm text-neutral-400">No chapters yet — upload a .cbz above to create the first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((chap) => (
              <div
                key={chap._id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow hover:border-neutral-700 transition-all"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center text-lg flex-shrink-0">
                    {chap.chapterNumber}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{chap.title}</h3>
                    <p className="text-xs text-neutral-400">
                      Chapter #{chap.chapterNumber} • {chap.pages?.length || 0} pages • {chap.status}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                  <Link
                    href={`/chapters/${chap._id}/reader`}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all border border-neutral-700"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Reader</span>
                  </Link>
                  <Link
                    href={`/chapters/${chap._id}/studio`}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video Studio</span>
                  </Link>
                  {confirmDeleteChapter === chap._id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteChapter(chap._id)}
                        disabled={deletingChapterId === chap._id}
                        className="inline-flex items-center justify-center space-x-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow"
                      >
                        {deletingChapterId === chap._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        <span>{deletingChapterId === chap._id ? 'Deleting...' : 'Confirm'}</span>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteChapter(null)}
                        disabled={deletingChapterId === chap._id}
                        className="text-neutral-400 hover:text-white text-xs px-2 py-2 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setConfirmDeleteChapter(chap._id); setDeleteError(''); }}
                      className="flex-shrink-0 inline-flex items-center justify-center space-x-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 px-4 py-2 rounded-xl text-xs font-semibold transition-all border border-red-500/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
