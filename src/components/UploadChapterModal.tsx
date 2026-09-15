import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import {
  X,
  UploadCloud,
  FileArchive,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Loader2,
  Trash2,
  Sparkles,
  Plus,
  Layers,
} from 'lucide-react';
import { Manga, Chapter } from '../types.js';

interface UploadChapterModalProps {
  isOpen: boolean;
  onClose: () => void;
  manga: Manga;
  currentChaptersCount: number;
  onUploadSuccess: (updatedManga: Manga, newChapters: Chapter[]) => void;
  onReadChapter?: (chapter: Chapter) => void;
}

interface QueuedChapter {
  id: string;
  fileName: string;
  chapterName: string;
  chapterNumber: number;
  pages: string[]; // Base64 data URLs
}

export const UploadChapterModal: React.FC<UploadChapterModalProps> = ({
  isOpen,
  onClose,
  manga,
  currentChaptersCount,
  onUploadSuccess,
  onReadChapter,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [queuedChapters, setQueuedChapters] = useState<QueuedChapter[]>([]);
  const [autoGenerateSubtitles, setAutoGenerateSubtitles] = useState(true);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ updatedManga: Manga; addedChapters: Chapter[] } | null>(null);

  if (!isOpen) return null;

  // Natural sort helper for file names inside ZIP (e.g. 1.jpg, 2.jpg, 10.jpg)
  const naturalCompare = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  };

  // High-performance canvas compression: scales down oversized images to max dimension 1600px
  // and exports as lightweight 0.82 quality JPEG
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

  // Parse chapter number and title from filename
  const parseFileNameDetails = (fileName: string, fallbackIndex: number) => {
    const cleanName = fileName.replace(/\.(cbz|zip|cbr)$/i, '').replace(/_/g, ' ');
    const chMatch = cleanName.match(/(?:chapter|ch|c)[^\d]*(\d+(?:\.\d+)?)/i) || cleanName.match(/(\d+(?:\.\d+)?)/);

    let chNum = currentChaptersCount + fallbackIndex + 1;
    if (chMatch) {
      const parsed = parseFloat(chMatch[1]);
      if (!isNaN(parsed) && parsed > 0) {
        chNum = parsed;
      }
    }

    return {
      chapterNumber: chNum,
      chapterName: cleanName.trim() || `Chapter ${chNum}`,
    };
  };

  // Handle files drop or selection
  const handleFilesSelect = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);
    setError(null);
    setUploadResult(null);

    const newExtracted: QueuedChapter[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessStatus(`Reading ${file.name} (${i + 1}/${files.length})...`);

        const parsed = parseFileNameDetails(file.name, queuedChapters.length + newExtracted.length);

        if (file.name.match(/\.(cbz|zip|cbr)$/i)) {
          const zip = await JSZip.loadAsync(file);
          const imageEntries: { name: string; zipObject: JSZip.JSZipObject }[] = [];

          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && relativePath.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i)) {
              imageEntries.push({ name: relativePath, zipObject: zipEntry });
            }
          });

          imageEntries.sort((a, b) => naturalCompare(a.name, b.name));

          if (imageEntries.length === 0) {
            setError(`No images found in ${file.name}. Ensure it contains .jpg, .png, or .webp images.`);
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
            chapterNumber: parsed.chapterNumber,
            pages: pageDataUrls,
          });
        } else if (file.type.startsWith('image/')) {
          setProcessStatus(`Optimizing image ${file.name}...`);
          const dataUrl = await compressAndResizeBlob(file, 1600, 0.82);

          // Append to last queued direct-images chapter or create a new chapter
          if (newExtracted.length > 0 && newExtracted[newExtracted.length - 1].fileName === 'Image Pages') {
            newExtracted[newExtracted.length - 1].pages.push(dataUrl);
          } else {
            const nextChNum = currentChaptersCount + queuedChapters.length + newExtracted.length + 1;
            newExtracted.push({
              id: Math.random().toString(36).substring(2, 9),
              fileName: 'Image Pages',
              chapterName: `Chapter ${nextChNum}`,
              chapterNumber: nextChNum,
              pages: [dataUrl],
            });
          }
        }
      }

      setQueuedChapters((prev) => [...prev, ...newExtracted]);
      setProcessStatus('');
    } catch (err: any) {
      console.error('[UploadChapterModal] Error:', err);
      setError(`Failed to process chapter file: ${err.message}`);
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
    setQueuedChapters((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateChapterField = (id: string, field: 'chapterName' | 'chapterNumber', val: any) => {
    setQueuedChapters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  // Submit chapters to server
  const handleSubmit = async () => {
    if (queuedChapters.length === 0) {
      setError('Please add at least one chapter file (.CBZ, .ZIP, or image pages).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let finalUpdatedManga: Manga = manga;
      const allAddedChapters: Chapter[] = [];

      // Send chapter by chapter to prevent payload exceeding memory limits
      for (let i = 0; i < queuedChapters.length; i++) {
        const ch = queuedChapters[i];
        setProcessStatus(`Uploading ${ch.chapterName} (${i + 1}/${queuedChapters.length})...`);

        const payload = {
          mangaId: manga.id,
          title: manga.title,
          autoGenerateSubtitles: autoGenerateSubtitles,
          chapters: [
            {
              name: ch.chapterName,
              chapterNumber: Number(ch.chapterNumber),
              pages: ch.pages,
            },
          ],
        };

        const res = await fetch(`/api/v1/manga/${manga.id}/chapter/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${res.status}`);
        }

        const data = await res.json();
        if (data.manga) {
          finalUpdatedManga = data.manga;
        }
        if (Array.isArray(data.addedChapters)) {
          allAddedChapters.push(...data.addedChapters);
        }
      }

      setUploadResult({
        updatedManga: finalUpdatedManga,
        addedChapters: allAddedChapters,
      });

      onUploadSuccess(finalUpdatedManga, allAddedChapters);
    } catch (err: any) {
      console.error('[UploadChapterModal] Submit error:', err);
      setError(err.message || 'Failed to upload chapter.');
    } finally {
      setIsSubmitting(false);
      setProcessStatus('');
    }
  };

  const resetForm = () => {
    setQueuedChapters([]);
    setError(null);
    setUploadResult(null);
    setProcessStatus('');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 relative text-zinc-100 flex flex-col space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/50 shrink-0">
            <UploadCloud className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
              Upload Chapter to <span className="text-rose-400 truncate">"{manga.title}"</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Add new chapters via `.cbz`, `.zip`, `.cbr`, or image files directly to your database.
            </p>
          </div>
        </div>

        {/* Success Screen */}
        {uploadResult ? (
          <div className="bg-emerald-950/60 border border-emerald-500/40 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-bold text-white text-base">
                  Chapter(s) Uploaded Successfully!
                </h3>
                <p className="text-xs text-emerald-300/90 mt-0.5">
                  Added {uploadResult.addedChapters.length} chapter(s) to "{manga.title}". Current total: {uploadResult.updatedManga.chaptersCount} chapters.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {onReadChapter && uploadResult.addedChapters[0] && (
                <button
                  id="btn-read-new-chapter"
                  onClick={() => {
                    onReadChapter(uploadResult.addedChapters[0]);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Read Chapter Now</span>
                </button>
              )}

              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Another</span>
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs cursor-pointer ml-auto"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Error Message */}
            {error && (
              <div className="bg-rose-950/60 border border-rose-500/40 p-3 rounded-xl flex items-center gap-2.5 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-rose-500/60 bg-zinc-950/70 hover:bg-zinc-950 rounded-xl p-6 text-center cursor-pointer transition-all space-y-3 group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
                accept=".cbz,.zip,.cbr,image/*"
                multiple
                className="hidden"
              />

              <div className="w-12 h-12 rounded-xl bg-zinc-800 group-hover:bg-rose-600/20 group-hover:text-rose-400 text-zinc-400 flex items-center justify-center mx-auto transition-colors">
                <FileArchive className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-200">
                  Click to browse or drop chapter archives here
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Supports <strong className="text-zinc-400">.cbz</strong>, <strong className="text-zinc-400">.zip</strong>, <strong className="text-zinc-400">.cbr</strong> or multiple image pages (<strong className="text-zinc-400">.jpg, .png, .webp</strong>)
                </p>
              </div>

              {isProcessingFiles && (
                <div className="flex items-center justify-center gap-2 text-xs text-rose-400 pt-2 animate-pulse font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{processStatus || 'Processing images...'}</span>
                </div>
              )}
            </div>

            {/* Queued Chapters List */}
            {queuedChapters.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-rose-400" />
                    Chapters Ready to Upload ({queuedChapters.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setQueuedChapters([])}
                    className="text-zinc-500 hover:text-red-400 text-[11px] cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {queuedChapters.map((ch, idx) => (
                    <div
                      key={ch.id}
                      className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* First page thumbnail preview */}
                        {ch.pages[0] ? (
                          <img
                            src={ch.pages[0]}
                            alt={ch.chapterName}
                            className="w-10 h-14 object-cover rounded-md border border-zinc-700 shrink-0 bg-zinc-900"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-zinc-800 rounded-md flex items-center justify-center text-zinc-500 shrink-0">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={ch.chapterName}
                              onChange={(e) => handleUpdateChapterField(ch.id, 'chapterName', e.target.value)}
                              placeholder="Chapter Name"
                              className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-medium focus:outline-none focus:border-rose-500 flex-1 min-w-[140px]"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] text-zinc-400">Ch. #</span>
                              <input
                                type="number"
                                step="any"
                                value={ch.chapterNumber}
                                onChange={(e) => handleUpdateChapterField(ch.id, 'chapterNumber', parseFloat(e.target.value) || 0)}
                                className="w-16 bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-rose-500"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                            <span className="text-zinc-500 truncate max-w-[180px]">{ch.fileName}</span>
                            <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300 font-mono">
                              {ch.pages.length} pages
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveChapter(ch.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer self-end sm:self-center shrink-0"
                        title="Remove chapter"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Narrator POV Subtitles Option */}
            <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent border border-amber-500/25 rounded-xl flex items-start gap-3">
              <input
                type="checkbox"
                id="toggle-auto-subtitles"
                checked={autoGenerateSubtitles}
                onChange={(e) => setAutoGenerateSubtitles(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-800 border-zinc-700 cursor-pointer shrink-0"
              />
              <label htmlFor="toggle-auto-subtitles" className="text-xs cursor-pointer select-none">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Auto-generate Narrator Point-of-View Subtitles
                </span>
                <span className="block text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                  Storyteller recap perspective describing what the character does and what the character says with live Google lore context.
                </span>
              </label>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
              <div className="text-xs text-zinc-400">
                {isSubmitting && (
                  <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{processStatus || 'Uploading to database...'}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-upload-chapter"
                  type="button"
                  disabled={queuedChapters.length === 0 || isSubmitting || isProcessingFiles}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload {queuedChapters.length > 0 ? `(${queuedChapters.length})` : ''} Chapter</span>
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
