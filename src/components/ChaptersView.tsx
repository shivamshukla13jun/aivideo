import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { chapterService } from '../services/chapterService';
import { uploadService } from '../services/uploadService';
import { setChapters, setCurrentChapter, addChapterItem, updateChapterItem, removeChapterItem } from '../redux/slices/chapterSlice';
import { setExtractedFiles, setIsExtracting, setUploadProgress, clearUploadState } from '../redux/slices/uploadSlice';
import { useNavigate } from 'react-router-dom';
import { setActiveChapterId, showNotification } from '../redux/slices/uiSlice';
import { extractCBZFile, naturalSort, blobToDataUrl } from '../utils/cbzExtractor';
import { getSocket } from '../services/socketService';
import { Chapter, ChapterStatus } from '../types';
import {
  Upload,
  Layers,
  FileArchive,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Play,
  RotateCcw,
  Trash2,
  Eye,
  FileText,
  Video,
  Sparkles,
  ArrowRight,
  Plus,
  BookOpen
} from 'lucide-react';

export const ChaptersView: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selectedSeries } = useAppSelector((state) => state.series);
  const { items: chapters, currentChapter } = useAppSelector((state) => state.chapter);
  const { extractedFiles, isExtracting, activeUpload } = useAppSelector((state) => state.upload);

  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [selectedChapterForUpload, setSelectedChapterForUpload] = useState<Chapter | null>(null);
  const [selectedArchiveFile, setSelectedArchiveFile] = useState<File | null>(null);
  const [lastUploadedChapterId, setLastUploadedChapterId] = useState<string | null>(null);

  // Load chapters for active series
  useEffect(() => {
    if (selectedSeries) {
      chapterService.getChaptersBySeries(selectedSeries.id).then((data) => {
        dispatch(setChapters(data));
        if (data.length > 0 && !currentChapter) {
          dispatch(setCurrentChapter(data[0]));
          dispatch(setActiveChapterId(data[0].id));
        }
      }).catch(console.error);
    }
  }, [selectedSeries, dispatch]);

  // Socket.io Real-time progress listeners
  useEffect(() => {
    const socket = getSocket();

    const handleProgress = (data: any) => {
      dispatch(setUploadProgress(data));
    };

    const handleComplete = (data: any) => {
      dispatch(setUploadProgress(data));
      dispatch(showNotification({ message: 'Chapter comic pages successfully uploaded & stored!', type: 'success' }));

      const targetId = data.chapterId || selectedChapterForUpload?.id || currentChapter?.id;
      if (targetId) {
        setLastUploadedChapterId(targetId);
        chapterService.getChapterById(targetId).then((freshChapter) => {
          dispatch(setCurrentChapter(freshChapter));
          dispatch(setActiveChapterId(targetId));
        }).catch(console.error);
      }

      if (selectedSeries) {
        chapterService.getChaptersBySeries(selectedSeries.id).then((chData) => {
          dispatch(setChapters(chData));
        }).catch(console.error);
      }
    };

    socket.on('chapter-upload:progress', handleProgress);
    socket.on('chapter-upload:complete', handleComplete);

    return () => {
      socket.off('chapter-upload:progress', handleProgress);
      socket.off('chapter-upload:complete', handleComplete);
    };
  }, [dispatch, selectedSeries, selectedChapterForUpload, currentChapter]);

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeries || !newChapterTitle.trim()) return;

    const created = await chapterService.createChapter({
      seriesId: selectedSeries.id,
      title: newChapterTitle,
      chapterNumber: chapters.length + 1
    });

    dispatch(addChapterItem(created));
    dispatch(setCurrentChapter(created));
    dispatch(setActiveChapterId(created.id));
    setSelectedChapterForUpload(created);
    setNewChapterTitle('');
    dispatch(showNotification({ message: `Chapter "${created.title}" created.`, type: 'success' }));
  };

  // Browser CBZ / Image File Selector Event Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    dispatch(setIsExtracting(true));
    const extractedList: { name: string; url: string; file?: File; pageNumber: number }[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.cbz') || lowerName.endsWith('.zip')) {
          setSelectedArchiveFile(file);
          // CBZ extraction for high-speed local preview
          const cbzPages = await extractCBZFile(file);
          cbzPages.forEach((p) => {
            extractedList.push({
              name: p.name,
              url: p.previewUrl,
              file: p.file,
              pageNumber: p.pageNumber
            });
          });
        } else if (file.type.startsWith('image/')) {
          // Direct image files
          const previewUrl = URL.createObjectURL(file);
          extractedList.push({
            name: file.name,
            url: previewUrl,
            file,
            pageNumber: i + 1
          });
        }
      }

      // Natural Sort images so 1, 2, ... 10, ... 103 are ordered correctly
      extractedList.sort((a, b) => naturalSort(a.name, b.name));
      extractedList.forEach((item, idx) => {
        item.pageNumber = idx + 1;
      });

      dispatch(setExtractedFiles(extractedList));
      dispatch(showNotification({ message: `${extractedList.length} comic pages detected & sorted.`, type: 'info' }));
    } catch (err: any) {
      dispatch(showNotification({ message: 'Error extracting CBZ file: ' + err.message, type: 'error' }));
    } finally {
      dispatch(setIsExtracting(false));
    }
  };

  const handleRemovePageFromPreview = (index: number) => {
    const updated = extractedFiles.filter((_, idx) => idx !== index);
    updated.forEach((p, i) => (p.pageNumber = i + 1));
    dispatch(setExtractedFiles(updated));
    // If pages were manually removed, invalidate direct archive upload to preserve custom sequence
    setSelectedArchiveFile(null);
  };

  const handleConfirmUpload = async () => {
    const targetChapter = selectedChapterForUpload || currentChapter || chapters[0];
    if (!targetChapter) {
      dispatch(showNotification({ message: 'Please select a chapter to upload pages into.', type: 'error' }));
      return;
    }

    if (extractedFiles.length === 0) {
      dispatch(showNotification({ message: 'No comic pages to upload. Please select a CBZ or image files.', type: 'error' }));
      return;
    }

    const socket = getSocket();

    try {
      if (selectedArchiveFile) {
        // Fast direct server CBZ upload: unpacks and writes all 100+ images directly
        dispatch(setUploadProgress({
          uploadId: `cbz_${Date.now()}`,
          chapterId: targetChapter.id,
          totalFiles: extractedFiles.length,
          completedFiles: 0,
          currentFile: selectedArchiveFile.name,
          progress: 10,
          status: 'uploading'
        }));

        const result = await uploadService.uploadCBZFile(targetChapter.id, selectedArchiveFile, socket.id);
        dispatch(showNotification({ message: result.message || `Successfully uploaded ${result.completedCount} pages!`, type: 'success' }));
        setLastUploadedChapterId(targetChapter.id);

        const freshChapter = await chapterService.getChapterById(targetChapter.id);
        dispatch(setCurrentChapter(freshChapter));
        dispatch(setActiveChapterId(targetChapter.id));

        if (selectedSeries) {
          const freshChapters = await chapterService.getChaptersBySeries(selectedSeries.id);
          dispatch(setChapters(freshChapters));
        }

        dispatch(setUploadProgress({
          uploadId: `cbz_done`,
          chapterId: targetChapter.id,
          totalFiles: result.completedCount,
          completedFiles: result.completedCount,
          currentFile: 'Done',
          progress: 100,
          status: 'completed'
        }));
      } else {
        // Chunked batch upload for manually curated or loose images
        dispatch(setUploadProgress({
          uploadId: `upl_${Date.now()}`,
          chapterId: targetChapter.id,
          totalFiles: extractedFiles.length,
          completedFiles: 0,
          currentFile: 'Preparing images...',
          progress: 5,
          status: 'uploading'
        }));

        const chunkSize = 10;
        for (let i = 0; i < extractedFiles.length; i += chunkSize) {
          const slice = extractedFiles.slice(i, i + chunkSize);
          const batchImages = await Promise.all(
            slice.map(async (f) => {
              let dataUrl = f.url;
              if (f.file) {
                dataUrl = await blobToDataUrl(f.file);
              }
              return {
                filename: f.name,
                dataUrl,
                pageNumber: f.pageNumber
              };
            })
          );

          await uploadService.uploadChapterImages({
            chapterId: targetChapter.id,
            images: batchImages,
            replaceExisting: i === 0,
            pageOffset: i,
            socketId: socket.id
          });
        }

        setLastUploadedChapterId(targetChapter.id);
        const freshChapter = await chapterService.getChapterById(targetChapter.id);
        dispatch(setCurrentChapter(freshChapter));
        dispatch(setActiveChapterId(targetChapter.id));

        if (selectedSeries) {
          const freshChapters = await chapterService.getChaptersBySeries(selectedSeries.id);
          dispatch(setChapters(freshChapters));
        }
      }
    } catch (err: any) {
      dispatch(showNotification({ message: 'Upload error: ' + err.message, type: 'error' }));
      dispatch(setUploadProgress({
        uploadId: 'err',
        chapterId: targetChapter.id,
        totalFiles: extractedFiles.length,
        completedFiles: 0,
        currentFile: 'Error',
        progress: 0,
        status: 'error'
      }));
    }
  };

  const getStatusBadge = (status: ChapterStatus) => {
    switch (status) {
      case 'unread':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">Unread</span>;
      case 'reading':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Reading</span>;
      case 'read':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Read</span>;
      case 'script-draft':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Script Draft</span>;
      case 'script-completed':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Script Complete</span>;
      case 'narration-ready':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">Narration Ready</span>;
      case 'video-editing':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Video Editing</span>;
      case 'completed':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Completed</span>;
      default:
        return <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Chapter Creation & Select Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Chapter Management &amp; CBZ Importer
            </h1>
            <p className="text-xs text-zinc-400">
              Select or create a chapter, import CBZ comic files, natural sort pages, and upload to Cloudinary.
            </p>
          </div>

          {/* Create Chapter Form */}
          <form onSubmit={handleCreateChapter} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New Chapter Title..."
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-48 md:w-64"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Chapter
            </button>
          </form>
        </div>

        {/* Chapter Selection Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t border-zinc-800">
          {chapters.map((ch) => {
            const isSelected = currentChapter?.id === ch.id;
            return (
              <div
                key={ch.id}
                onClick={() => {
                  dispatch(setCurrentChapter(ch));
                  dispatch(setActiveChapterId(ch.id));
                  setSelectedChapterForUpload(ch);
                }}
                className={`cursor-pointer p-3 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-900/30 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-indigo-400">Ch. {ch.chapterNumber}</span>
                    {getStatusBadge(ch.status)}
                  </div>
                  <h4 className="text-xs font-semibold line-clamp-1">{ch.title}</h4>
                </div>

                <div className="pt-2 mt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(setCurrentChapter(ch));
                      dispatch(setActiveChapterId(ch.id));
                      navigate('/reader');
                    }}
                    className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> Reader
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(setCurrentChapter(ch));
                      dispatch(setActiveChapterId(ch.id));
                      navigate('/video-studio');
                    }}
                    className="text-[10px] font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <Video className="w-3 h-3" /> NLE Video
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CBZ / Image Drag & Drop Importer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <FileArchive className="w-4 h-4 text-indigo-400" />
          CBZ Frontend Extraction &amp; Natural Sorting
        </h2>

        <div className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center bg-zinc-950/50 transition-colors relative">
          <input
            type="file"
            accept=".cbz,.zip,image/*"
            multiple
            onChange={handleFileSelect}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div className="space-y-2 pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-200">
              Drag &amp; Drop <span className="text-indigo-400">.CBZ</span> comic archives or image files here
            </h3>
            <p className="text-[11px] text-zinc-500">
              Frontend extracts images via JSZip &amp; natural-sorts (1.jpg, 2.jpg, 10.jpg).
            </p>
          </div>
        </div>

        {isExtracting && (
          <div className="flex items-center justify-center gap-3 py-4 text-xs text-indigo-400 bg-indigo-950/20 rounded-xl border border-indigo-500/20">
            <Sparkles className="w-4 h-4 animate-spin" />
            Extracting CBZ archive in browser memory...
          </div>
        )}

        {/* Real-Time Upload Progress Socket Payload */}
        {activeUpload && activeUpload.status === 'uploading' && (
          <div className="bg-zinc-950 border border-indigo-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-100">
              <span>Uploading Chapter Images to Cloudinary...</span>
              <span className="text-indigo-400 font-bold">{activeUpload.progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${activeUpload.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
              <span>Current: {activeUpload.currentFile}</span>
              <span>
                {activeUpload.completedFiles} / {activeUpload.totalFiles} images
              </span>
            </div>
          </div>
        )}

        {/* Upload Success & Direct Reader Link */}
        {activeUpload && activeUpload.status === 'completed' && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-200">
                  Chapter upload complete! {activeUpload.completedFiles || activeUpload.totalFiles} pages stored.
                </p>
                <p className="text-[11px] text-emerald-400/80">
                  Images are permanently stored on server and ready for reading and scene extraction.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (lastUploadedChapterId) {
                  dispatch(setActiveChapterId(lastUploadedChapterId));
                }
                navigate('/reader');
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 shrink-0"
            >
              <BookOpen className="w-4 h-4" /> Open in Reader
            </button>
          </div>
        )}

        {/* Extracted Image Preview Grid */}
        {extractedFiles.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-100">
                  Detected Pages ({extractedFiles.length} pages sorted)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Target Chapter: <span className="text-indigo-400 font-semibold">{currentChapter?.title || 'Chapter 1'}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => dispatch(clearUploadState())}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                >
                  Cancel Import
                </button>
                <button
                  onClick={handleConfirmUpload}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                >
                  <Upload className="w-3.5 h-3.5" /> Confirm &amp; Upload Chapter Pages
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-80 overflow-y-auto p-1 bg-zinc-950 rounded-xl border border-zinc-800">
              {extractedFiles.map((file, index) => (
                <div key={index} className="relative group bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                  <img src={file.url} alt={file.name} className="w-full h-28 object-cover" />
                  <div className="p-1.5 bg-zinc-950/90 text-[10px] text-zinc-300 font-mono truncate flex items-center justify-between">
                    <span>Pg {file.pageNumber}</span>
                    <button
                      onClick={() => handleRemovePageFromPreview(index)}
                      className="text-zinc-500 hover:text-rose-400"
                      title="Remove Page"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
