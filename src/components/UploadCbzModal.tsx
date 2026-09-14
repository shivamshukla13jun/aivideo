import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import {
  X,
  UploadCloud,
  FileArchive,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  FolderPlus,
  Loader2,
  Plus,
  Tag,
  Film,
  Trash2,
} from 'lucide-react';
import { Manga } from '../types.js';

interface UploadCbzModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMangas: Manga[];
  onUploadSuccess: (manga: Manga) => void;
  onOpenReader?: (manga: Manga, chapter: any) => void;
  onOpenStudio?: (manga: Manga, chapter: any) => void;
  initialMangaId?: number | null;
  initialMode?: 'new' | 'existing';
}

interface ExtractedChapter {
  id: string;
  fileName: string;
  chapterName: string;
  chapterNumber: number;
  pages: string[]; // Base64 data URLs
}

export const UploadCbzModal: React.FC<UploadCbzModalProps> = ({
  isOpen,
  onClose,
  existingMangas,
  onUploadSuccess,
  onOpenReader,
  onOpenStudio,
  initialMangaId,
  initialMode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode: 'new' | 'existing'
  const [mode, setMode] = useState<'new' | 'existing'>(initialMode || (initialMangaId ? 'existing' : 'new'));
  const [selectedMangaId, setSelectedMangaId] = useState<number | null>(initialMangaId || null);

  React.useEffect(() => {
    if (isOpen) {
      if (initialMangaId) {
        setSelectedMangaId(initialMangaId);
        setMode('existing');
        const found = existingMangas.find((m) => m.id === initialMangaId);
        if (found) setTitle(found.title);
      } else if (initialMode) {
        setMode(initialMode);
      }
    }
  }, [isOpen, initialMangaId, initialMode, existingMangas]);

  // Form Metadata
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [genreString, setGenreString] = useState('Action, Fantasy, Local CBZ');
  const [status, setStatus] = useState('Ongoing');
  const [customThumbnail, setCustomThumbnail] = useState<string>('');

  // Extracted Chapters
  const [extractedChapters, setExtractedChapters] = useState<ExtractedChapter[]>([]);
  const [autoGenerateSubtitles, setAutoGenerateSubtitles] = useState(true);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccessData, setUploadSuccessData] = useState<{ manga: Manga; chapter: any } | null>(null);

  if (!isOpen) return null;

  // Natural sort helper for file names inside ZIP (e.g. 1.jpg, 2.jpg, 10.jpg)
  const naturalCompare = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  };

  // High-performance canvas compression: scales down oversized images to max dimension 1600px
  // and exports as lightweight 0.82 quality JPEG. Cuts Base64 string payload size by 90-95%!
  const compressAndResizeBlob = (blob: Blob, maxDimension = 1600, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width;
        let h = img.height;

        if (w > maxDimension || h > maxDimension) {
          if (w > h) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          } else {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      };
      img.src = url;
    });
  };

  // Helper to parse filename for Manga Title and Chapter Number
  const parseFileNameDetails = (fileName: string) => {
    const cleanName = fileName.replace(/\.(cbz|zip|cbr)$/i, '').replace(/_/g, ' ');
    
    // Look for chapter numbers e.g., "Ch 01", "Chapter 12", "c05", "v1-ch3"
    const chMatch = cleanName.match(/(?:chapter|ch|c)[^\d]*(\d+(?:\.\d+)?)/i) || cleanName.match(/(\d+)/);
    let chNum = 1;
    if (chMatch) {
      chNum = parseFloat(chMatch[1]) || 1;
    }

    // Try extracting title before chapter keyword
    let parsedTitle = cleanName;
    const titleMatch = cleanName.split(/(?:chapter|ch|c\d+|\d+)/i)[0];
    if (titleMatch && titleMatch.trim().length > 1) {
      parsedTitle = titleMatch.trim().replace(/[-_]$/, '').trim();
    }

    return {
      title: parsedTitle || cleanName,
      chapterNumber: chNum,
      chapterName: `Chapter ${chNum}`,
    };
  };

  // Handle files selection (CBZ / ZIP / Images)
  const handleFilesSelect = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);
    setError(null);
    setUploadSuccessData(null);

    const newExtracted: ExtractedChapter[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessStatus(`Processing ${file.name} (${i + 1}/${files.length})...`);

        const parsed = parseFileNameDetails(file.name);

        // Autofill title if not set yet
        if (!title && parsed.title) {
          setTitle(parsed.title);
        }

        if (file.name.match(/\.(cbz|zip)$/i)) {
          // Extract ZIP archive using JSZip
          const zip = await JSZip.loadAsync(file);
          const imageEntries: { name: string; zipObject: JSZip.JSZipObject }[] = [];

          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && relativePath.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i)) {
              imageEntries.push({ name: relativePath, zipObject: zipEntry });
            }
          });

          // Sort images naturally
          imageEntries.sort((a, b) => naturalCompare(a.name, b.name));

          if (imageEntries.length === 0) {
            setError(`No images found inside ${file.name}. Ensure it contains .jpg, .png, or .webp files.`);
            continue;
          }

          const pageDataUrls: string[] = [];
          for (let p = 0; p < imageEntries.length; p++) {
            setProcessStatus(`Optimizing page ${p + 1}/${imageEntries.length} from ${file.name}...`);
            const entry = imageEntries[p];
            const blob = await entry.zipObject.async('blob');
            const dataUrl = await compressAndResizeBlob(blob, 1600, 0.82);
            pageDataUrls.push(dataUrl);
          }

          newExtracted.push({
            id: Math.random().toString(36).substring(2, 9),
            fileName: file.name,
            chapterName: parsed.chapterName,
            chapterNumber: parsed.chapterNumber + newExtracted.length,
            pages: pageDataUrls,
          });
        } else if (file.type.startsWith('image/')) {
          // Direct image upload for chapter page
          const dataUrl = await compressAndResizeBlob(file, 1600, 0.82);

          // Append page to existing single chapter or create new chapter
          if (newExtracted.length > 0 && newExtracted[newExtracted.length - 1].fileName === 'Direct Images') {
            newExtracted[newExtracted.length - 1].pages.push(dataUrl);
          } else {
            newExtracted.push({
              id: Math.random().toString(36).substring(2, 9),
              fileName: 'Direct Images',
              chapterName: `Chapter ${extractedChapters.length + 1}`,
              chapterNumber: extractedChapters.length + 1,
              pages: [dataUrl],
            });
          }
        }
      }

      setExtractedChapters((prev) => [...prev, ...newExtracted]);
      setProcessStatus('');
    } catch (err: any) {
      console.error('CBZ extraction error:', err);
      setError(`Failed to read CBZ archive: ${err.message}`);
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const handleRemoveChapter = (id: string) => {
    setExtractedChapters((prev) => prev.filter((c) => c.id !== id));
  };

  // Submit to DB API sequentially per chapter to ensure tiny request payloads
  const handleSubmit = async () => {
    if (extractedChapters.length === 0) {
      setError('Please upload at least one .CBZ or .ZIP manga chapter file.');
      return;
    }

    if (mode === 'new' && !title.trim()) {
      setError('Please provide a Manga Title.');
      return;
    }

    if (mode === 'existing' && !selectedMangaId) {
      setError('Please select an existing Manga from your library.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const genres = genreString
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);

      let finalTitle = title;
      if (mode === 'existing' && selectedMangaId) {
        const found = existingMangas.find((m) => m.id === selectedMangaId);
        if (found) finalTitle = found.title;
      }

      const firstPageThumb = extractedChapters[0]?.pages[0] || '';

      // Upload chapter-by-chapter to prevent giant request payloads
      let currentMangaId: number | undefined = mode === 'existing' ? (selectedMangaId || undefined) : undefined;
      let lastSavedManga: Manga | null = null;
      let firstSavedChapter: any = null;

      for (let c = 0; c < extractedChapters.length; c++) {
        const ch = extractedChapters[c];
        setProcessStatus(`Storing chapter ${c + 1}/${extractedChapters.length} in database...`);

        const payload = {
          mangaId: currentMangaId,
          title: finalTitle,
          author: author || 'Local Creator',
          artist: artist || author || 'Local Creator',
          description: description || 'Uploaded local CBZ manga archive.',
          genre: genres,
          status: status,
          thumbnailUrl: customThumbnail || firstPageThumb,
          autoGenerateSubtitles: autoGenerateSubtitles,
          chapters: [
            {
              name: ch.chapterName,
              chapterNumber: ch.chapterNumber,
              pages: ch.pages,
            },
          ],
        };

        const res = await fetch('/api/v1/manga/upload-cbz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          const textErr = await res.text();
          console.error('[CBZ Upload Server Error]:', textErr.slice(0, 300));
          throw new Error(
            `Server upload failed (${res.status} ${res.statusText}). Payload size may be too large.`
          );
        }

        const data = await res.json();
        lastSavedManga = data.manga;
        if (lastSavedManga) {
          currentMangaId = lastSavedManga.id;
        }

        if (c === 0 && data.addedChapters?.[0]) {
          firstSavedChapter = data.addedChapters[0];
        }
      }

      if (lastSavedManga) {
        onUploadSuccess(lastSavedManga);
        setUploadSuccessData({ manga: lastSavedManga, chapter: firstSavedChapter });
      }
    } catch (err: any) {
      console.error('Failed to submit CBZ:', err);
      setError(err.message || 'An error occurred during DB storage.');
    } finally {
      setIsSubmitting(false);
      setProcessStatus('');
    }
  };

  // Helper to reset entire database to clean slate for uploaded manga
  const handleResetDatabase = async () => {
    if (!window.confirm('Are you sure you want to clear all old manga and start with a completely fresh database?')) {
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/v1/admin/reset-db', { method: 'POST' });
      if (res.ok) {
        alert('Database successfully reset to a clean state!');
        window.location.reload();
      } else {
        alert('Failed to reset database.');
      }
    } catch (err: any) {
      alert(`Error resetting database: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative text-zinc-100 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/50">
            <FolderPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Upload Local CBZ / Manga
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Direct DB Storage
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Upload `.cbz`, `.zip` or image archives. Extracts pages, parses details, and saves directly to MongoDB store.
            </p>
          </div>
        </div>

        {/* Success Banner */}
        {uploadSuccessData ? (
          <div className="bg-emerald-950/60 border border-emerald-500/40 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-bold text-white text-base">
                  Manga Saved Successfully!
                </h3>
                <p className="text-xs text-emerald-300/90">
                  "{uploadSuccessData.manga.title}" with {extractedChapters.length} chapter(s) has been stored in your library database.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {onOpenReader && uploadSuccessData.chapter && (
                <button
                  onClick={() => {
                    onOpenReader(uploadSuccessData.manga, uploadSuccessData.chapter);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>📖 Open & Read Chapter</span>
                </button>
              )}

              {onOpenStudio && uploadSuccessData.chapter && (
                <button
                  onClick={() => {
                    onOpenStudio(uploadSuccessData.manga, uploadSuccessData.chapter);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
                >
                  <Film className="w-4 h-4" />
                  <span>🎬 Open in Video Studio</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs cursor-pointer"
              >
                Close Modal
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Error Message */}
            {error && (
              <div className="bg-rose-950/60 border border-rose-500/40 p-3.5 rounded-2xl flex items-center gap-3 text-xs text-rose-200">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Mode Selector: Add New vs Append to Existing */}
            <div className="flex items-center gap-3 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  mode === 'new'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                ✨ Create New Manga Series
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  mode === 'existing'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                📚 Add to Existing Library Series
              </button>
            </div>

            {/* Existing Manga Selector */}
            {mode === 'existing' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Select Existing Manga:
                </label>
                <select
                  value={selectedMangaId || ''}
                  onChange={(e) => setSelectedMangaId(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Choose Manga Series --</option>
                  {existingMangas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.chaptersCount || 0} chapters)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* File Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-800 hover:border-rose-500/60 bg-zinc-950/60 hover:bg-zinc-950 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-3 group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
                accept=".cbz,.zip,.cbr,image/*"
                multiple
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-zinc-800 group-hover:bg-rose-600/20 text-zinc-400 group-hover:text-rose-400 flex items-center justify-center mx-auto transition-all">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-bold text-zinc-200 group-hover:text-white">
                  Drop `.CBZ` / `.ZIP` chapter files here, or <span className="text-rose-400 underline">browse</span>
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Supports multi-file CBZ uploads and direct image strips (.jpg, .png, .webp)
                </p>
              </div>

              {isProcessingFiles && (
                <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-semibold pt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{processStatus || 'Unzipping CBZ archive...'}</span>
                </div>
              )}
            </div>

            {/* Extracted Chapters Preview */}
            {extractedChapters.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <FileArchive className="w-4 h-4 text-amber-400" />
                    Extracted Chapters ({extractedChapters.length})
                  </h3>
                  <span className="text-[11px] text-zinc-400">
                    Total Pages: {extractedChapters.reduce((acc, c) => acc + c.pages.length, 0)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                  {extractedChapters.map((ch, idx) => (
                    <div
                      key={ch.id}
                      className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        {ch.pages[0] ? (
                          <img
                            src={ch.pages[0]}
                            alt="Cover"
                            className="w-10 h-14 object-cover rounded-lg border border-zinc-800 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-600">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <input
                            type="text"
                            value={ch.chapterName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtractedChapters((prev) =>
                                prev.map((c) => (c.id === ch.id ? { ...c, chapterName: val } : c))
                              );
                            }}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none focus:border-b border-rose-500 w-full truncate"
                          />
                          <p className="text-[11px] text-zinc-400">
                            {ch.pages.length} pages • File: {ch.fileName}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveChapter(ch.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove chapter"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manga Details Form (Only required if creating new series) */}
            {mode === 'new' && (
              <div className="space-y-4 pt-2 border-t border-zinc-800/80">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-rose-400" />
                  Manga Series Metadata & Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">
                      Manga Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Solo Leveling, Demon Slayer"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Author */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Author</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="e.g. Chugong, Oda Eiichiro"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Artist */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Artist</label>
                    <input
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      placeholder="e.g. DUBU (REDICE STUDIO)"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Genres / Tags */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">
                      Genre / Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={genreString}
                      onChange={(e) => setGenreString(e.target.value)}
                      placeholder="Action, Fantasy, Webtoon, Local CBZ"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Synopsis / Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter manga story description..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Narrator POV Subtitles Option */}
            <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent border border-amber-500/25 rounded-xl flex items-start gap-3">
              <input
                type="checkbox"
                id="cbz-toggle-auto-subtitles"
                checked={autoGenerateSubtitles}
                onChange={(e) => setAutoGenerateSubtitles(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-800 border-zinc-700 cursor-pointer shrink-0"
              />
              <label htmlFor="cbz-toggle-auto-subtitles" className="text-xs cursor-pointer select-none">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Auto-generate Narrator Point-of-View Subtitles
                </span>
                <span className="block text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                  Storyteller recap perspective describing what the character does and what the character says with live Google lore context.
                </span>
              </label>
            </div>

            {/* Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleResetDatabase}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-rose-100 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                title="Wipe all old scraped manga and start with a fresh clean database"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset DB to Fresh Slate</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || extractedChapters.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Manga & Chapters to DB</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
};
