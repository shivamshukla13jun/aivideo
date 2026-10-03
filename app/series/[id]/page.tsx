'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import {
  BookOpen,
  Film,
  Library,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Server,
  Upload,
  FileArchive,
  Scissors,
  CheckCircle2,
  X,
  Plus,
  Sparkles,
} from 'lucide-react';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export default function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const seriesId = resolvedParams.id;

  const [series, setSeries] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);

  // CBZ Upload Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [cbzChapterNumber, setCbzChapterNumber] = useState<number>(1);
  const [cbzChapterTitle, setCbzChapterTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCbzExtracting, setIsCbzExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState('');
  const [detectedPagesCount, setDetectedPagesCount] = useState<number | null>(null);
  const [splitTallOption, setSplitTallOption] = useState(true);
  const [uploadError, setUploadError] = useState('');

  // Per-chapter Mihon splitting state
  const [splittingChapterId, setSplittingChapterId] = useState<string | null>(null);
  const [splitResultMap, setSplitResultMap] = useState<Record<string, string>>({});

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

      if (sData.success) {
        setSeries(sData.data);
      }
      if (cData.success) {
        setChapters(cData.data);
        if (cData.data.length > 0) {
          const maxNum = Math.max(...cData.data.map((c: any) => c.chapterNumber || 0));
          setCbzChapterNumber(maxNum + 1);
          setCbzChapterTitle(`Chapter ${maxNum + 1}`);
        } else {
          setCbzChapterNumber(1);
          setCbzChapterTitle('Chapter 1');
        }
      }
      if (lData.success) {
        const found = lData.data.find(
          (item: any) => item.seriesId?._id === seriesId || item.seriesId === seriesId
        );
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
    loadDetails();
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadError('');
    setDetectedPagesCount(null);

    if (file.name.endsWith('.cbz') || file.name.endsWith('.zip')) {
      try {
        const zip = await JSZip.loadAsync(file);
        const imageEntries: string[] = [];
        zip.forEach((relativePath, entry) => {
          if (
            !entry.dir &&
            !relativePath.startsWith('__MACOSX/') &&
            !relativePath.startsWith('.') &&
            /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(relativePath)
          ) {
            imageEntries.push(relativePath);
          }
        });
        setDetectedPagesCount(imageEntries.length);
      } catch (zipErr) {
        console.warn('Could not preview zip contents:', zipErr);
      }
    }
  };

  const handleUploadCbz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a CBZ or ZIP file');
      return;
    }

    setIsCbzExtracting(true);
    setUploadError('');

    try {
      let pageBlobs: { name: string; blob: Blob }[] = [];

      if (selectedFile.name.endsWith('.cbz') || selectedFile.name.endsWith('.zip')) {
        setExtractionProgress('1. Reading CBZ archive in browser...');
        const zip = await JSZip.loadAsync(selectedFile);

        const rawEntries: { name: string; file: JSZip.JSZipObject }[] = [];
        zip.forEach((relativePath, zipEntry) => {
          if (
            !zipEntry.dir &&
            !relativePath.startsWith('__MACOSX/') &&
            !relativePath.startsWith('.') &&
            /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(relativePath)
          ) {
            rawEntries.push({ name: relativePath, file: zipEntry });
          }
        });

        if (rawEntries.length === 0) {
          throw new Error('No supported image files found inside this CBZ archive');
        }

        // Strict natural alphanumeric ordering
        rawEntries.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        setExtractionProgress(`2. Extracting ${rawEntries.length} pages in strict natural order…`);

        for (let i = 0; i < rawEntries.length; i++) {
          const entry = rawEntries[i];
          setExtractionProgress(`Extracting page ${i + 1} of ${rawEntries.length}…`);
          const blob = await entry.file.async('blob');
          pageBlobs.push({ name: entry.name, blob });
        }
      } else {
        pageBlobs.push({ name: selectedFile.name, blob: selectedFile });
      }

      // Upload extracted pages to MongoDB GridFS Bucket Engine
      const uploadedPageUrls: { order: number; originalUrl: string }[] = [];

      for (let i = 0; i < pageBlobs.length; i++) {
        const item = pageBlobs[i];
        setExtractionProgress(`3. Uploading page ${i + 1}/${pageBlobs.length} to MongoDB Bucket Engine…`);

        const formData = new FormData();
        formData.append('file', item.blob, item.name);

        const uploadRes = await fetch('/api/bucket/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadData.success || !uploadData.data?.url) {
          throw new Error(`Failed to upload page ${i + 1} to MongoDB bucket`);
        }

        uploadedPageUrls.push({
          order: i + 1,
          originalUrl: uploadData.data.url,
        });
      }

      // Save Chapter in MongoDB
      setExtractionProgress('4. Finalizing chapter in database…');
      const chapRes = await fetch('/api/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId,
          chapterNumber: cbzChapterNumber,
          title: cbzChapterTitle.trim() || `Chapter ${cbzChapterNumber}`,
          pages: uploadedPageUrls,
        }),
      });

      const chapData = await chapRes.json();
      if (!chapData.success) {
        throw new Error(chapData.error || 'Failed to save chapter');
      }

      const newChapterId = chapData.data._id;

      // Optional Mihon tall image splitting
      if (splitTallOption && newChapterId) {
        setExtractionProgress('5. Mihon Webtoon Splitter: checking for tall strips…');
        try {
          const splitRes = await fetch(`/api/chapters/${newChapterId}/split-tall`, {
            method: 'POST',
          });
          const splitData = await splitRes.json();
          if (splitData.success && splitData.splitCount > 0) {
            setSplitResultMap((prev) => ({
              ...prev,
              [newChapterId]: `Mihon split: ${splitData.splitCount} tall pages divided into ${splitData.newPagesCount} panels!`,
            }));
          }
        } catch (splitErr) {
          console.warn('Mihon auto-split warning:', splitErr);
        }
      }

      setIsCbzExtracting(false);
      setShowUploadModal(false);
      setSelectedFile(null);
      await loadDetails();
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'CBZ upload failed');
      setIsCbzExtracting(false);
    }
  };

  const handleSplitTallImages = async (chapterId: string) => {
    if (splittingChapterId) return;
    setSplittingChapterId(chapterId);

    try {
      const res = await fetch(`/api/chapters/${chapterId}/split-tall`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Splitting failed');
      }

      const msg =
        data.splitCount > 0
          ? `✓ Split ${data.splitCount} tall image(s) into ${data.newPagesCount} panels!`
          : '✓ All pages are already standard webtoon height';
      setSplitResultMap((prev) => ({ ...prev, [chapterId]: msg }));
      setTimeout(() => {
        setSplitResultMap((prev) => {
          const copy = { ...prev };
          delete copy[chapterId];
          return copy;
        });
      }, 6000);
      await loadDetails();
    } catch (err: any) {
      alert(err.message || 'Mihon splitting failed');
    } finally {
      setSplittingChapterId(null);
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
          <p className="text-neutral-400 text-sm mb-4">
            Could not locate this series in your database or Suwayomi library.
          </p>
          <Link href="/" className="text-indigo-400 hover:underline">
            Return to Explore
          </Link>
        </div>
      </div>
    );
  }

  const isLocalSeries = series.source === 'local';

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
            <img
              src={series.coverImage}
              alt={series.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {isLocalSeries ? (
                <span className="bg-purple-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-purple-300" />
                  <span>Local Manga (MongoDB)</span>
                </span>
              ) : (
                <span className="bg-emerald-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
                  <Server className="w-3 h-3" />
                  <span>Suwayomi Sync</span>
                </span>
              )}

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
              <p className="text-sm text-neutral-400 mb-2">
                By <span className="text-neutral-200 font-semibold">{series.author}</span>{' '}
                {series.artist && `• Art by ${series.artist}`}
              </p>
            )}
            <p className="text-sm text-neutral-300 max-w-3xl line-clamp-3 mb-4">{series.description}</p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={toggleLibrary}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${
                  inLibrary
                    ? 'bg-neutral-800 text-indigo-400 border border-indigo-500/30'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <Library className="w-4 h-4" />
                <span>{inLibrary ? 'In My Library' : 'Save to Library'}</span>
              </button>

              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg cursor-pointer"
              >
                <FileArchive className="w-4 h-4" />
                <span>Upload Chapter (CBZ)</span>
              </button>

              {!isLocalSeries && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center space-x-2 bg-neutral-800 hover:bg-neutral-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border border-neutral-700 shadow"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Syncing...' : 'Sync from Suwayomi'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chapters Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>Chapters ({chapters.length})</span>
            </h2>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center space-x-2 bg-neutral-900 hover:bg-neutral-800 text-indigo-400 hover:text-indigo-300 border border-neutral-800 hover:border-indigo-500/40 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New Chapter (CBZ)</span>
          </button>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/50 rounded-3xl border border-neutral-800 space-y-4">
            <FileArchive className="w-12 h-12 text-neutral-600 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-neutral-300">No chapters uploaded yet</p>
              <p className="text-xs text-neutral-500 mt-1">
                Upload a .cbz archive with all images extracted in your browser and saved to MongoDB Bucket Engine.
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Chapter Now (.CBZ)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((chap) => {
              const isSplitting = splittingChapterId === chap._id;
              const splitResult = splitResultMap[chap._id];

              return (
                <div
                  key={chap._id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow hover:border-neutral-700 transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center text-lg flex-shrink-0">
                      {chap.chapterNumber}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-white text-base">{chap.title}</h3>
                        {chap.source === 'local' && (
                          <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/80 px-2 py-0.5 rounded-full font-semibold">
                            Local CBZ
                          </span>
                        )}
                        {chap.audioTrack?.url && (
                          <span className="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/80 px-2 py-0.5 rounded-full font-semibold">
                            Dubbed Audio ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Chapter #{chap.chapterNumber}{' '}
                        {chap.uploadDate && `• Added ${new Date(chap.uploadDate).toLocaleDateString()}`}
                      </p>
                      {splitResult && (
                        <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{splitResult}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => handleSplitTallImages(chap._id)}
                      disabled={isSplitting}
                      title="Split tall webtoon images into readable panels (Mihon gutter algorithm)"
                      className="inline-flex items-center space-x-1.5 bg-neutral-950 hover:bg-neutral-800 text-amber-300 border border-neutral-800 hover:border-amber-500/40 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      {isSplitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      ) : (
                        <Scissors className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>{isSplitting ? 'Splitting…' : 'Split Tall (Mihon)'}</span>
                    </button>

                    <Link
                      href={`/chapters/${chap._id}/reader`}
                      className="inline-flex items-center justify-center space-x-1.5 bg-neutral-800 hover:bg-neutral-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border border-neutral-700"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Reader</span>
                    </Link>

                    <Link
                      href={`/chapters/${chap._id}/studio`}
                      className="inline-flex items-center justify-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Studio</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CBZ Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => !isCbzExtracting && setShowUploadModal(false)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <FileArchive className="w-6 h-6 text-indigo-400" />
                <span>Upload Chapter (.CBZ)</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Images are extracted client-side from the CBZ archive and stored directly in your MongoDB Bucket Engine.
              </p>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadCbz} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Chapter # *
                  </label>
                  <input
                    type="number"
                    required
                    value={cbzChapterNumber}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      setCbzChapterNumber(num);
                      if (!cbzChapterTitle || cbzChapterTitle.startsWith('Chapter ')) {
                        setCbzChapterTitle(`Chapter ${num}`);
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Chapter Title
                  </label>
                  <input
                    type="text"
                    value={cbzChapterTitle}
                    onChange={(e) => setCbzChapterTitle(e.target.value)}
                    placeholder="e.g. The Beginning"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* CBZ File Picker */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  CBZ or ZIP Archive File *
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer transition-all bg-neutral-950/60">
                  <FileArchive className="w-8 h-8 text-indigo-400 mb-2" />
                  <span className="text-xs font-bold text-neutral-200">
                    {selectedFile ? selectedFile.name : 'Select or drag & drop .cbz / .zip'}
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-1">
                    Order inside CBZ is preserved naturally (e.g. 1.jpg, 2.jpg, 10.jpg)
                  </span>
                  {detectedPagesCount !== null && (
                    <span className="mt-2 text-xs bg-indigo-950/80 text-indigo-300 border border-indigo-800/80 px-2.5 py-0.5 rounded-full font-bold">
                      ✓ {detectedPagesCount} pages detected in archive
                    </span>
                  )}
                  <input
                    type="file"
                    accept=".cbz,.zip,application/zip,application/x-cbz"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Mihon Split Tall Images Checkbox */}
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-3 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="splitTallCheck"
                  checked={splitTallOption}
                  onChange={(e) => setSplitTallOption(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-neutral-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="splitTallCheck" className="text-xs text-neutral-300 cursor-pointer">
                  <span className="font-bold text-white block">
                    Split Tall Images (Mihon Webtoon Splitter)
                  </span>
                  <span className="text-neutral-400 text-[11px] leading-tight block mt-0.5">
                    Detects long-strip webtoon pages and splits them along blank panel borders (gutters) into standard reading pages.
                  </span>
                </label>
              </div>

              {/* Extraction Progress Indicator */}
              {isCbzExtracting && (
                <div className="p-3 bg-indigo-950/60 border border-indigo-800/80 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-xs text-indigo-300 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>{extractionProgress}</span>
                  </div>
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full w-full animate-pulse" />
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={isCbzExtracting}
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCbzExtracting || !selectedFile}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-lg flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isCbzExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Extract & Upload to DB Bucket</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
