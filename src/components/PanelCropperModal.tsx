import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  RotateCw,
  FlipHorizontal,
  Crop,
  Layers,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Save,
  Film,
  BookOpen,
  UploadCloud,
  SplitSquareVertical,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreVertical,
  Maximize2,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { Manga, Chapter } from '../types.js';

interface PanelCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  manga: Manga;
  chapter: Chapter;
  onSuccessReplace?: (updatedChapter: Chapter) => void;
  onOpenVideoStudio?: (manga: Manga, chapter: Chapter) => void;
  onOpenReader?: (manga: Manga, chapter: Chapter) => void;
}

export interface CroppedPanelItem {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  sourcePageIndex: number;
  note: string;
}

export type AspectRatioPreset = 'free' | '9:16' | '1:1' | '3:4' | '4:5' | '16:9' | 'full-width';

type DragHandleType =
  | 'move'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'
  | 'n'
  | 's'
  | 'w'
  | 'e'
  | 'create';

interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PanelCropperModal: React.FC<PanelCropperModalProps> = ({
  isOpen,
  onClose,
  manga,
  chapter,
  onSuccessReplace,
  onOpenVideoStudio,
  onOpenReader,
}) => {
  // Available overall pages from chapter
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(true);

  // Custom uploaded image
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);

  // Overall Image references & dimensions
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [naturalWidth, setNaturalWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);

  // Transformations
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [isFlippedH, setIsFlippedH] = useState<boolean>(false);

  // Crop selection coordinates (in natural image pixel coordinates)
  const [cropBox, setCropBox] = useState<RectBox | null>(null);
  const [cropPreset, setCropPreset] = useState<AspectRatioPreset>('9:16');
  const [panelNote, setPanelNote] = useState<string>('');

  // Undo / Redo history for crop box
  const [historyStack, setHistoryStack] = useState<RectBox[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Drag interaction state
  const dragRef = useRef<{
    active: boolean;
    handle: DragHandleType;
    startX: number;
    startY: number;
    startBox: RectBox;
    currentPoint: { x: number; y: number };
  } | null>(null);

  const [activeDragHandle, setActiveDragHandle] = useState<DragHandleType | null>(null);

  // Sliced / Cropped panels list
  const [croppedPanels, setCroppedPanels] = useState<CroppedPanelItem[]>([]);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Saving & Export status
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveComplete, setSaveComplete] = useState<boolean>(false);
  const [savedChapter, setSavedChapter] = useState<Chapter | null>(null);

  // Partial crop & retention settings
  const [includeUncroppedPages, setIncludeUncroppedPages] = useState<boolean>(true);
  const [useOriginalStrips, setUseOriginalStrips] = useState<boolean>(false);

  // 1-based page numbers that have at least one cropped panel
  const croppedPageSet = new Set(croppedPanels.map((p) => p.sourcePageIndex));
  const uncroppedPagesCount = pages.filter((_, idx) => !croppedPageSet.has(idx + 1)).length;

  const jumpToNextUncroppedPage = () => {
    const nextIdx = pages.findIndex((_, idx) => !croppedPageSet.has(idx + 1));
    if (nextIdx !== -1) {
      setSelectedPageIndex(nextIdx);
      setCustomImageUrl(null);
      triggerToast(`Switched to uncropped Page ${nextIdx + 1}`);
    } else {
      triggerToast('All pages in this chapter have been cropped into panels!');
    }
  };

  // Load chapter pages on mount
  useEffect(() => {
    if (!isOpen || !chapter) return;

    setIsLoadingPages(true);
    setErrorMsg(null);
    setSaveComplete(false);

    if (useOriginalStrips && chapter.originalPages && chapter.originalPages.length > 0) {
      setPages(chapter.originalPages);
      setSelectedPageIndex(0);
      setIsLoadingPages(false);
    } else if (chapter.pages && chapter.pages.length > 0) {
      setPages(chapter.pages);
      setSelectedPageIndex(0);
      setIsLoadingPages(false);
    } else {
      fetch(`/api/v1/chapter/${chapter.id}/pages`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setPages(data);
            setSelectedPageIndex(0);
          } else {
            setPages([]);
          }
        })
        .catch((err) => {
          console.error('Failed to load chapter pages:', err);
          setErrorMsg('Could not load chapter pages. You can upload an image strip.');
        })
        .finally(() => setIsLoadingPages(false));
    }
  }, [isOpen, chapter, useOriginalStrips]);

  const activeImageUrl = customImageUrl || pages[selectedPageIndex] || '';

  // Show temporary toast message
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2200);
  };

  // Push crop box to history
  const pushHistory = useCallback((box: RectBox) => {
    setHistoryStack((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, box];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      const targetBox = historyStack[nextIdx];
      setCropBox(targetBox);
      setHistoryIndex(nextIdx);
      triggerToast('Undo crop change');
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      const targetBox = historyStack[nextIdx];
      setCropBox(targetBox);
      setHistoryIndex(nextIdx);
      triggerToast('Redo crop change');
    }
  };

  // Calculate default crop box based on preset
  const calculatePresetBox = useCallback(
    (preset: AspectRatioPreset, nw: number, nh: number): RectBox => {
      if (preset === 'full-width') {
        const h = Math.min(nh, Math.round(nw * (4 / 3)));
        return { x: 0, y: 0, width: nw, height: h };
      }

      let ratio: number | null = null;
      if (preset === '9:16') ratio = 9 / 16;
      else if (preset === '1:1') ratio = 1;
      else if (preset === '3:4') ratio = 3 / 4;
      else if (preset === '4:5') ratio = 4 / 5;
      else if (preset === '16:9') ratio = 16 / 9;

      if (!ratio) {
        // Freeform default: centered 80%
        const w = Math.round(nw * 0.85);
        const h = Math.round(nh * 0.85);
        return {
          x: Math.round((nw - w) / 2),
          y: Math.round((nh - h) / 2),
          width: w,
          height: h,
        };
      }

      // Constrain inside image boundaries
      let targetW = nw * 0.88;
      let targetH = targetW / ratio;

      if (targetH > nh * 0.88) {
        targetH = nh * 0.88;
        targetW = targetH * ratio;
      }

      targetW = Math.round(targetW);
      targetH = Math.round(targetH);

      return {
        x: Math.round((nw - targetW) / 2),
        y: Math.round((nh - targetH) / 2),
        width: targetW,
        height: targetH,
      };
    },
    []
  );

  // Revert / Reset crop box to full image or default preset
  const handleRevert = () => {
    if (naturalWidth === 0 || naturalHeight === 0) return;
    const fullBox: RectBox = {
      x: 0,
      y: 0,
      width: naturalWidth,
      height: naturalHeight,
    };
    setCropBox(fullBox);
    pushHistory(fullBox);
    triggerToast('Reverted to full image');
  };

  // Change Aspect Ratio preset
  const handleSelectPreset = (preset: AspectRatioPreset) => {
    setCropPreset(preset);
    if (naturalWidth === 0 || naturalHeight === 0) return;

    let nextBox = calculatePresetBox(preset, naturalWidth, naturalHeight);
    setCropBox(nextBox);
    pushHistory(nextBox);
  };

  // Handle image load to initialize crop dimensions
  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth || 800;
    const nh = img.naturalHeight || 1200;
    setNaturalWidth(nw);
    setNaturalHeight(nh);

    const initialBox = calculatePresetBox(cropPreset, nw, nh);
    setCropBox(initialBox);
    setHistoryStack([initialBox]);
    setHistoryIndex(0);
  };

  // Generate real-time preview of current crop box
  useEffect(() => {
    if (!cropBox || !imageRef.current || naturalWidth === 0 || naturalHeight === 0) {
      setPreviewDataUrl(null);
      return;
    }

    const { x, y, width, height } = cropBox;
    if (width <= 5 || height <= 5) {
      setPreviewDataUrl(null);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(width, 1600);
    canvas.height = Math.round((height / width) * canvas.width);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Support rotation and flip in preview
      if (rotation !== 0 || isFlippedH) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
        if (isFlippedH) ctx.scale(-1, 1);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      ctx.drawImage(
        imageRef.current,
        x,
        y,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      if (rotation !== 0 || isFlippedH) {
        ctx.restore();
      }

      setPreviewDataUrl(canvas.toDataURL('image/jpeg', 0.9));
    } catch (e) {
      console.warn('Canvas preview draw notice:', e);
    }
  }, [cropBox, naturalWidth, naturalHeight, activeImageUrl, rotation, isFlippedH]);

  // Convert client coordinates into natural image pixel coordinates
  const clientToNatural = useCallback(
    (clientX: number, clientY: number) => {
      if (!imageRef.current) return null;
      const rect = imageRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      const scaleX = naturalWidth / rect.width;
      const scaleY = naturalHeight / rect.height;

      const x = Math.max(0, Math.min(naturalWidth, clickX * scaleX));
      const y = Math.max(0, Math.min(naturalHeight, clickY * scaleY));

      return { x, y };
    },
    [naturalWidth, naturalHeight]
  );

  // Start drag interaction
  const startDragging = (
    handle: DragHandleType,
    clientX: number,
    clientY: number
  ) => {
    if (!cropBox || naturalWidth === 0 || naturalHeight === 0) return;

    const naturalPt = clientToNatural(clientX, clientY);
    if (!naturalPt) return;

    dragRef.current = {
      active: true,
      handle,
      startX: clientX,
      startY: clientY,
      startBox: { ...cropBox },
      currentPoint: naturalPt,
    };
    setActiveDragHandle(handle);
  };

  // Move drag interaction (window level)
  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current || !dragRef.current.active || !imageRef.current) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const rect = imageRef.current.getBoundingClientRect();
      const scaleX = naturalWidth / rect.width;
      const scaleY = naturalHeight / rect.height;

      const deltaX = (clientX - dragRef.current.startX) * scaleX;
      const deltaY = (clientY - dragRef.current.startY) * scaleY;

      const { handle, startBox } = dragRef.current;
      const minDimension = 30;

      let newX = startBox.x;
      let newY = startBox.y;
      let newW = startBox.width;
      let newH = startBox.height;

      // Ratio multiplier if aspect ratio is locked
      let targetRatio: number | null = null;
      if (cropPreset === '9:16') targetRatio = 9 / 16;
      else if (cropPreset === '1:1') targetRatio = 1;
      else if (cropPreset === '3:4') targetRatio = 3 / 4;
      else if (cropPreset === '4:5') targetRatio = 4 / 5;
      else if (cropPreset === '16:9') targetRatio = 16 / 9;

      if (handle === 'move') {
        // Move the entire crop box
        newX = Math.max(0, Math.min(naturalWidth - startBox.width, startBox.x + deltaX));
        newY = Math.max(0, Math.min(naturalHeight - startBox.height, startBox.y + deltaY));
      } else if (handle === 'se') {
        // Bottom-Right corner
        newW = Math.max(minDimension, startBox.width + deltaX);
        newH = Math.max(minDimension, startBox.height + deltaY);

        if (targetRatio) {
          newH = Math.round(newW / targetRatio);
        }

        // Clamp to image boundaries
        if (newX + newW > naturalWidth) {
          newW = naturalWidth - newX;
          if (targetRatio) newH = Math.round(newW / targetRatio);
        }
        if (newY + newH > naturalHeight) {
          newH = naturalHeight - newY;
          if (targetRatio) newW = Math.round(newH * targetRatio);
        }
      } else if (handle === 'sw') {
        // Bottom-Left corner
        const maxDeltaX = startBox.width - minDimension;
        const clampedDeltaX = Math.min(maxDeltaX, Math.max(-startBox.x, deltaX));

        newX = startBox.x + clampedDeltaX;
        newW = startBox.width - clampedDeltaX;
        newH = Math.max(minDimension, startBox.height + deltaY);

        if (targetRatio) {
          newH = Math.round(newW / targetRatio);
        }

        if (newY + newH > naturalHeight) {
          newH = naturalHeight - newY;
          if (targetRatio) {
            newW = Math.round(newH * targetRatio);
            newX = startBox.x + (startBox.width - newW);
          }
        }
      } else if (handle === 'ne') {
        // Top-Right corner
        newW = Math.max(minDimension, startBox.width + deltaX);
        const maxDeltaY = startBox.height - minDimension;
        const clampedDeltaY = Math.min(maxDeltaY, Math.max(-startBox.y, deltaY));

        newY = startBox.y + clampedDeltaY;
        newH = startBox.height - clampedDeltaY;

        if (targetRatio) {
          newH = Math.round(newW / targetRatio);
          newY = startBox.y + (startBox.height - newH);
        }

        if (newX + newW > naturalWidth) {
          newW = naturalWidth - newX;
          if (targetRatio) {
            newH = Math.round(newW / targetRatio);
            newY = startBox.y + (startBox.height - newH);
          }
        }
        if (newY < 0) {
          newY = 0;
          newH = startBox.y + startBox.height;
          if (targetRatio) newW = Math.round(newH * targetRatio);
        }
      } else if (handle === 'nw') {
        // Top-Left corner
        const maxDeltaX = startBox.width - minDimension;
        const clampedDeltaX = Math.min(maxDeltaX, Math.max(-startBox.x, deltaX));
        const maxDeltaY = startBox.height - minDimension;
        const clampedDeltaY = Math.min(maxDeltaY, Math.max(-startBox.y, deltaY));

        newX = startBox.x + clampedDeltaX;
        newW = startBox.width - clampedDeltaX;
        newY = startBox.y + clampedDeltaY;
        newH = startBox.height - clampedDeltaY;

        if (targetRatio) {
          newH = Math.round(newW / targetRatio);
          newY = startBox.y + (startBox.height - newH);
        }

        if (newY < 0) {
          newY = 0;
          newH = startBox.y + startBox.height;
          if (targetRatio) {
            newW = Math.round(newH * targetRatio);
            newX = startBox.x + (startBox.width - newW);
          }
        }
      } else if (handle === 'n') {
        // Top edge
        const maxDeltaY = startBox.height - minDimension;
        const clampedDeltaY = Math.min(maxDeltaY, Math.max(-startBox.y, deltaY));
        newY = startBox.y + clampedDeltaY;
        newH = startBox.height - clampedDeltaY;
      } else if (handle === 's') {
        // Bottom edge
        newH = Math.max(minDimension, Math.min(naturalHeight - startBox.y, startBox.height + deltaY));
      } else if (handle === 'w') {
        // Left edge
        const maxDeltaX = startBox.width - minDimension;
        const clampedDeltaX = Math.min(maxDeltaX, Math.max(-startBox.x, deltaX));
        newX = startBox.x + clampedDeltaX;
        newW = startBox.width - clampedDeltaX;
      } else if (handle === 'e') {
        // Right edge
        newW = Math.max(minDimension, Math.min(naturalWidth - startBox.x, startBox.width + deltaX));
      } else if (handle === 'create') {
        // User drawing new crop box
        const currentPt = clientToNatural(clientX, clientY);
        if (currentPt) {
          const x1 = Math.min(dragRef.current.currentPoint.x, currentPt.x);
          const y1 = Math.min(dragRef.current.currentPoint.y, currentPt.y);
          const x2 = Math.max(dragRef.current.currentPoint.x, currentPt.x);
          const y2 = Math.max(dragRef.current.currentPoint.y, currentPt.y);

          newX = x1;
          newY = y1;
          newW = Math.max(minDimension, x2 - x1);
          newH = Math.max(minDimension, y2 - y1);

          if (targetRatio) {
            newH = Math.round(newW / targetRatio);
            if (newY + newH > naturalHeight) {
              newH = naturalHeight - newY;
              newW = Math.round(newH * targetRatio);
            }
          }
        }
      }

      setCropBox({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    };

    const handlePointerUp = () => {
      if (dragRef.current?.active) {
        dragRef.current = null;
        setActiveDragHandle(null);
        if (cropBox) {
          pushHistory(cropBox);
        }
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [cropBox, cropPreset, naturalWidth, naturalHeight, clientToNatural, pushHistory]);

  // Add currently selected crop as a new panel
  const handleSavePanel = () => {
    if (!previewDataUrl || !cropBox) return;

    const newPanel: CroppedPanelItem = {
      id: `panel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      dataUrl: previewDataUrl,
      width: cropBox.width,
      height: cropBox.height,
      sourcePageIndex: selectedPageIndex + 1,
      note: panelNote.trim() || `Panel ${croppedPanels.length + 1}`,
    };

    setCroppedPanels((prev) => [...prev, newPanel]);
    setPanelNote('');
    triggerToast(`Panel ${croppedPanels.length + 1} added!`);

    // Advance crop box downward for seamless consecutive slicing!
    const nextY = cropBox.y + cropBox.height;
    if (nextY < naturalHeight) {
      const remainingH = naturalHeight - nextY;
      const nextH = Math.min(cropBox.height, remainingH);
      const nextBox: RectBox = {
        x: cropBox.x,
        y: nextY,
        width: cropBox.width,
        height: nextH,
      };
      setCropBox(nextBox);
      pushHistory(nextBox);
    }
  };

  // Quick auto-split feature: slices entire image into N equal vertical strips with 1 click
  const handleAutoSplit = (parts: number) => {
    if (!imageRef.current || naturalHeight === 0 || naturalWidth === 0) return;

    const partHeight = Math.floor(naturalHeight / parts);
    const newItems: CroppedPanelItem[] = [];

    for (let i = 0; i < parts; i++) {
      const sy = i * partHeight;
      const sh = i === parts - 1 ? naturalHeight - sy : partHeight;

      const canvas = document.createElement('canvas');
      canvas.width = Math.min(naturalWidth, 1600);
      canvas.height = Math.round((sh / naturalWidth) * canvas.width);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(imageRef.current, 0, sy, naturalWidth, sh, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        newItems.push({
          id: `panel-auto-${Date.now()}-${i}`,
          dataUrl,
          width: naturalWidth,
          height: sh,
          sourcePageIndex: selectedPageIndex + 1,
          note: `Panel ${croppedPanels.length + i + 1} (Slice ${i + 1}/${parts})`,
        });
      }
    }

    setCroppedPanels((prev) => [...prev, ...newItems]);
    setIsQueueDrawerOpen(true);
    triggerToast(`Auto-split into ${parts} panels!`);
  };

  // Rotate 90 degrees
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    triggerToast(`Rotated to ${(rotation + 90) % 360}°`);
  };

  // Flip Horizontal
  const handleFlipHorizontal = () => {
    setIsFlippedH((prev) => !prev);
    triggerToast(!isFlippedH ? 'Flipped Horizontally' : 'Original Orientation');
  };

  // Reorder panels
  const movePanel = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= croppedPanels.length) return;

    const updated = [...croppedPanels];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setCroppedPanels(updated);
  };

  const removePanel = (index: number) => {
    setCroppedPanels((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle uploading custom strip image
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setCustomImageUrl(url);
      triggerToast('Custom image strip loaded');
    };
    reader.readAsDataURL(file);
  };

  // Helper to convert an image URL (HTTP or relative) to base64 via Image & Canvas
  const urlToBase64 = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 1200;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
            return;
          }
        } catch (e) {
          console.warn('Canvas export error for URL:', url, e);
        }
        resolve('');
      };
      img.onerror = () => {
        console.warn('Failed to load image for base64 conversion:', url);
        resolve('');
      };
      img.src = url;
    });
  };

  // Assembled sequence of items for replacing chapter & generating CBZ
  const getAssembledPages = (): { url: string; isCropped: boolean; sourcePageIndex?: number; note?: string }[] => {
    if (!includeUncroppedPages) {
      return croppedPanels.map((p) => ({
        url: p.dataUrl,
        isCropped: true,
        sourcePageIndex: p.sourcePageIndex,
        note: p.note,
      }));
    }

    const items: { url: string; isCropped: boolean; sourcePageIndex?: number; note?: string }[] = [];
    for (let i = 0; i < pages.length; i++) {
      const pageNum = i + 1;
      const panelsForPage = croppedPanels.filter((p) => p.sourcePageIndex === pageNum);
      if (panelsForPage.length > 0) {
        panelsForPage.forEach((p) => {
          items.push({
            url: p.dataUrl,
            isCropped: true,
            sourcePageIndex: pageNum,
            note: p.note,
          });
        });
      } else {
        items.push({
          url: pages[i],
          isCropped: false,
          sourcePageIndex: pageNum,
          note: `Page ${pageNum} (Uncropped)`,
        });
      }
    }

    // Extra cropped panels not mapped to a valid original page index
    const extraPanels = croppedPanels.filter(
      (p) => !p.sourcePageIndex || p.sourcePageIndex < 1 || p.sourcePageIndex > pages.length
    );
    extraPanels.forEach((p) => {
      items.push({
        url: p.dataUrl,
        isCropped: true,
        sourcePageIndex: p.sourcePageIndex,
        note: p.note,
      });
    });

    return items;
  };

  // Generate CBZ blob from assembled items (panels + uncropped pages)
  const generateCbzBlob = async (
    itemsList: { url: string; isCropped: boolean; note?: string }[]
  ): Promise<Blob> => {
    const zip = new JSZip();

    for (let i = 0; i < itemsList.length; i++) {
      const item = itemsList[i];
      const fileName = `${String(i + 1).padStart(3, '0')}.jpg`;

      if (item.url.startsWith('data:image')) {
        const base64Data = item.url.split(',')[1];
        zip.file(fileName, base64Data, { base64: true });
      } else {
        // HTTP or relative URL
        let packed = false;
        try {
          const fetchUrl = item.url.startsWith('/') ? `${window.location.origin}${item.url}` : item.url;
          const res = await fetch(fetchUrl);
          if (res.ok) {
            const blob = await res.blob();
            const buffer = await blob.arrayBuffer();
            zip.file(fileName, buffer);
            packed = true;
          }
        } catch (fetchErr) {
          console.warn(`Fetch failed for page ${i + 1}, falling back to canvas:`, fetchErr);
        }

        if (!packed) {
          // Fallback to canvas conversion
          const b64 = await urlToBase64(item.url);
          if (b64 && b64.includes(',')) {
            zip.file(fileName, b64.split(',')[1], { base64: true });
          }
        }
      }
    }

    const comicInfo = `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Title>${chapter.name || `Chapter ${chapter.chapterNumber}`}</Title>
  <Series>${manga.title}</Series>
  <Number>${chapter.chapterNumber}</Number>
  <PageCount>${itemsList.length}</PageCount>
  <Writer>${manga.author || 'Creator'}</Writer>
  <Penciller>${manga.artist || manga.author || 'Artist'}</Penciller>
  <Genre>${(manga.genre || []).join(', ')}</Genre>
  <Notes>Panel sequence generated with Suwayomi Webtoon Studio</Notes>
</ComicInfo>`;
    zip.file('ComicInfo.xml', comicInfo);

    return await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  };

  // Save & Replace Chapter Pages on Server AND Download CBZ
  const handleSaveAndReplace = async (downloadCbzOnly = false) => {
    if (croppedPanels.length === 0) {
      setErrorMsg('Please crop and save at least 1 panel before replacing chapter.');
      return;
    }

    const assembledItems = getAssembledPages();
    if (assembledItems.length === 0) {
      setErrorMsg('No panels or pages to save.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSaveStatus(
      includeUncroppedPages && uncroppedPagesCount > 0
        ? `Packaging ${croppedPanels.length} cropped panels + ${uncroppedPagesCount} uncropped pages into CBZ...`
        : `Generating CBZ package with ${croppedPanels.length} cropped panels...`
    );

    try {
      const cbzBlob = await generateCbzBlob(assembledItems);
      const safeTitle = (manga.title || 'Manga').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeCh = `Ch_${chapter.chapterNumber || 1}_panels`;
      const fileName = `${safeTitle}_${safeCh}.cbz`;

      const downloadUrl = URL.createObjectURL(cbzBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

      if (downloadCbzOnly) {
        setSaveStatus(`CBZ package "${fileName}" downloaded successfully!`);
        setIsSaving(false);
        return;
      }

      setSaveStatus('Saving pages to chapter database...');
      const panelPages = assembledItems.map((p) => p.url);

      const res = await fetch(`/api/v1/chapter/${chapter.id}/replace-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: panelPages,
          chapterName: chapter.name,
          regenerateScript: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to replace chapter pages on server.');
      }

      const result = await res.json();
      setSavedChapter(result.chapter || { ...chapter, pages: panelPages, pageCount: panelPages.length });
      setSaveComplete(true);
      setSaveStatus(
        includeUncroppedPages && uncroppedPagesCount > 0
          ? `Success! Replaced with ${croppedPanels.length} cropped panels & preserved ${uncroppedPagesCount} uncropped pages (${panelPages.length} total). CBZ downloaded.`
          : `Success! Chapter replaced with ${croppedPanels.length} panels and CBZ downloaded.`
      );

      if (onSuccessReplace && result.chapter) {
        onSuccessReplace(result.chapter);
      }
    } catch (err: any) {
      console.error('Error saving cropped panels:', err);
      setErrorMsg(err.message || 'Failed to save cropped panels.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none overflow-hidden touch-none font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP BAR (Matching phone photo editor: Back, Undo, Redo, Revert, Save)  */}
      {/* ========================================================================= */}
      <header className="h-14 sm:h-16 px-3 sm:px-5 flex items-center justify-between bg-black/90 backdrop-blur-md border-b border-zinc-900 z-30 shrink-0">
        {/* Left: Back Arrow */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            id="btn-crop-back"
            onClick={onClose}
            className="p-2 -ml-1 text-zinc-300 hover:text-white rounded-full hover:bg-zinc-800 transition-colors cursor-pointer active:scale-95"
            title="Close editor"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="hidden md:block">
            <h1 className="text-xs font-semibold text-zinc-300 truncate max-w-[200px]">
              {manga.title}
            </h1>
            <p className="text-[10px] text-zinc-500 truncate">
              {chapter.name || `Ch. ${chapter.chapterNumber}`}
            </p>
          </div>
        </div>

        {/* Center: Undo / Redo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            id="btn-crop-undo"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 text-zinc-300 hover:text-white disabled:text-zinc-600 disabled:opacity-40 transition-colors cursor-pointer active:scale-90"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            id="btn-crop-redo"
            onClick={handleRedo}
            disabled={historyIndex >= historyStack.length - 1}
            className="p-2 text-zinc-300 hover:text-white disabled:text-zinc-600 disabled:opacity-40 transition-colors cursor-pointer active:scale-90"
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Revert, Save & Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="btn-crop-revert"
            onClick={handleRevert}
            className="px-2.5 py-1 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer active:scale-95"
            title="Revert crop to full image"
          >
            Revert
          </button>

          {/* Primary Phone Save Button */}
          <button
            id="btn-crop-save-panel"
            onClick={handleSavePanel}
            disabled={!previewDataUrl}
            className="px-4 py-1.5 rounded-full bg-white text-black font-bold text-xs sm:text-sm hover:bg-zinc-200 shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            title="Save this cropped panel into sequence"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          {/* More options dropdown toggle */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="p-2 text-zinc-300 hover:text-white rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl py-2 z-50 text-xs">
                <div className="px-3 py-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Chapter Pages ({pages.length})
                </div>
                <div className="max-h-40 overflow-y-auto px-1 space-y-0.5">
                  {pages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedPageIndex(idx);
                        setCustomImageUrl(null);
                        setShowMoreMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between ${
                        selectedPageIndex === idx && !customImageUrl
                          ? 'bg-amber-500/20 text-amber-400 font-bold'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span>Page {idx + 1}</span>
                      {selectedPageIndex === idx && !customImageUrl && (
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-zinc-800 my-1.5" />

                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                >
                  <UploadCloud className="w-4 h-4 text-zinc-400" />
                  <span>Upload Custom Strip</span>
                </button>

                <div className="px-3 py-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Auto-Slice Strip
                </div>
                <div className="grid grid-cols-3 gap-1 px-3 pb-1">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        handleAutoSplit(n);
                        setShowMoreMenu(false);
                      }}
                      className="py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-center font-bold text-zinc-300"
                    >
                      /{n} Cuts
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Visual Page Navigation Strip with Cropped vs Uncropped Indicators */}
      {pages.length > 0 && !customImageUrl && (
        <div className="h-11 px-3 bg-zinc-950/90 border-b border-zinc-900 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0 no-scrollbar z-20 backdrop-blur-sm">
          {/* Prev / Next Page Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSelectedPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={selectedPageIndex <= 0}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 font-semibold text-[11px] flex items-center gap-0.5 cursor-pointer border border-zinc-800 active:scale-95 transition-all"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="text-[11px] text-zinc-400 font-medium px-1 whitespace-nowrap">
              Page {selectedPageIndex + 1} / {pages.length}
            </span>
            <button
              onClick={() => setSelectedPageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
              disabled={selectedPageIndex >= pages.length - 1}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 font-semibold text-[11px] flex items-center gap-0.5 cursor-pointer border border-zinc-800 active:scale-95 transition-all"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Page Pills with Status Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[55%] sm:max-w-[70%]">
            {pages.map((_, idx) => {
              const count = croppedPanels.filter((p) => p.sourcePageIndex === idx + 1).length;
              const isCurrent = selectedPageIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap font-semibold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    isCurrent
                      ? 'bg-amber-500 text-black font-bold shadow ring-1 ring-amber-300'
                      : count > 0
                      ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-600/50 hover:bg-emerald-900/60'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:bg-zinc-800'
                  }`}
                  title={`Page ${idx + 1}: ${count > 0 ? `${count} panels cropped` : 'Not cropped yet'}`}
                >
                  <span>P{idx + 1}</span>
                  {count > 0 && <span className="text-[9px] opacity-90">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Jump to Next Uncropped Page Button */}
          {uncroppedPagesCount > 0 ? (
            <button
              onClick={jumpToNextUncroppedPage}
              className="px-2.5 py-1 rounded-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 shadow transition-all active:scale-95"
              title="Jump to the next uncropped page in sequence"
            >
              <span>Next Uncropped ({uncroppedPagesCount})</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <div className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold shrink-0 flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>All Cropped</span>
            </div>
          )}
        </div>
      )}

      {/* Hidden file upload input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadFile}
        accept="image/*"
        className="hidden"
      />

      {/* Toast feedback banner */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/90 text-white text-xs px-4 py-2 rounded-full border border-zinc-700 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN VIEWPORT (Phone style crop canvas with touch handles & 3x3 grid) */}
      {/* ========================================================================= */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative flex items-center justify-center p-2 sm:p-4 bg-[#0a0a0a] overflow-hidden select-none"
      >
        {isLoadingPages ? (
          <div className="flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-xs">Loading chapter image strip...</p>
          </div>
        ) : activeImageUrl ? (
          <div
            className="relative inline-block max-w-full max-h-full"
            style={{ touchAction: 'none' }}
          >
            {/* The Image being cropped */}
            <img
              ref={imageRef}
              src={activeImageUrl}
              alt="Manga strip to crop"
              onLoad={handleImageLoaded}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="block max-w-full max-h-[72vh] sm:max-h-[78vh] w-auto h-auto object-contain pointer-events-none transition-transform duration-200"
              style={{
                transform: `rotate(${rotation}deg) scaleX(${isFlippedH ? -1 : 1})`,
              }}
            />

            {/* Tap/Drag outside to create new crop box */}
            <div
              className="absolute inset-0 cursor-crosshair"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('.crop-active-box')) return;
                startDragging('create', e.clientX, e.clientY);
              }}
            />

            {/* ======================================================= */}
            {/* INTERACTIVE CROP BOX WITH PHONE L-CORNERS & 3x3 GRID   */}
            {/* ======================================================= */}
            {cropBox && imageRef.current && naturalWidth > 0 && (
              <div
                className="crop-active-box absolute pointer-events-auto transition-shadow"
                style={{
                  left: `${(cropBox.x / naturalWidth) * 100}%`,
                  top: `${(cropBox.y / naturalHeight) * 100}%`,
                  width: `${(cropBox.width / naturalWidth) * 100}%`,
                  height: `${(cropBox.height / naturalHeight) * 100}%`,
                  // Dimmed overlay outside crop area (exact phone photo editor style)
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
                  border: '1px solid rgba(255, 255, 255, 0.85)',
                  cursor: activeDragHandle ? 'grabbing' : 'grab',
                }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('.crop-handle')) return;
                  startDragging('move', e.clientX, e.clientY);
                }}
              >
                {/* ---------------------------------------------------- */}
                {/* 3x3 RULE-OF-THIRDS GRID (Phone Photo Editor)         */}
                {/* ---------------------------------------------------- */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Vertical grid lines */}
                  <div
                    className="absolute top-0 bottom-0 border-l border-white/35"
                    style={{ left: '33.333%' }}
                  />
                  <div
                    className="absolute top-0 bottom-0 border-l border-white/35"
                    style={{ left: '66.666%' }}
                  />
                  {/* Horizontal grid lines */}
                  <div
                    className="absolute left-0 right-0 border-t border-white/35"
                    style={{ top: '33.333%' }}
                  />
                  <div
                    className="absolute left-0 right-0 border-t border-white/35"
                    style={{ top: '66.666%' }}
                  />
                </div>

                {/* ---------------------------------------------------- */}
                {/* 4 L-SHAPED CORNER HANDLES (Exact Phone Look)          */}
                {/* ---------------------------------------------------- */}
                {/* Top-Left Corner */}
                <div
                  className="crop-handle absolute -top-3 -left-3 w-10 h-10 cursor-nwse-resize flex items-start justify-start z-20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDragging('nw', e.clientX, e.clientY);
                  }}
                >
                  <div className="relative w-5 h-5 m-2 pointer-events-none">
                    <div className="absolute top-0 left-0 w-5 h-1 bg-white rounded-l" />
                    <div className="absolute top-0 left-0 w-1 h-5 bg-white rounded-t" />
                  </div>
                </div>

                {/* Top-Right Corner */}
                <div
                  className="crop-handle absolute -top-3 -right-3 w-10 h-10 cursor-nesw-resize flex items-start justify-end z-20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDragging('ne', e.clientX, e.clientY);
                  }}
                >
                  <div className="relative w-5 h-5 m-2 pointer-events-none">
                    <div className="absolute top-0 right-0 w-5 h-1 bg-white rounded-r" />
                    <div className="absolute top-0 right-0 w-1 h-5 bg-white rounded-t" />
                  </div>
                </div>

                {/* Bottom-Left Corner */}
                <div
                  className="crop-handle absolute -bottom-3 -left-3 w-10 h-10 cursor-nesw-resize flex items-end justify-start z-20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDragging('sw', e.clientX, e.clientY);
                  }}
                >
                  <div className="relative w-5 h-5 m-2 pointer-events-none">
                    <div className="absolute bottom-0 left-0 w-5 h-1 bg-white rounded-l" />
                    <div className="absolute bottom-0 left-0 w-1 h-5 bg-white rounded-b" />
                  </div>
                </div>

                {/* Bottom-Right Corner */}
                <div
                  className="crop-handle absolute -bottom-3 -right-3 w-10 h-10 cursor-nwse-resize flex items-end justify-end z-20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDragging('se', e.clientX, e.clientY);
                  }}
                >
                  <div className="relative w-5 h-5 m-2 pointer-events-none">
                    <div className="absolute bottom-0 right-0 w-5 h-1 bg-white rounded-r" />
                    <div className="absolute bottom-0 right-0 w-1 h-5 bg-white rounded-b" />
                  </div>
                </div>

                {/* ---------------------------------------------------- */}
                {/* 4 CENTER EDGE BARS (Top, Bottom, Left, Right)        */}
                {/* ---------------------------------------------------- */}
                {/* Top Edge Handle */}
                <div
                  className="crop-handle absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-8 cursor-ns-resize flex items-center justify-center z-20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDragging('n', e.clientX, e.clientY);
                  }}
                >
                  <div className="w-8 h-1 bg-white rounded-full pointer-events-none shadow" />
                </div>

                {/* Bottom Edge Handle */}
                <div
                  className="crop-handle absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-8 cursor-ns-resize flex items-center justify-center z-20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDragging('s', e.clientX, e.clientY);
                  }}
                >
                  <div className="w-8 h-1 bg-white rounded-full pointer-events-none shadow" />
                </div>

                {/* Left Edge Handle */}
                <div
                  className="crop-handle absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-16 cursor-ew-resize flex items-center justify-center z-20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDragging('w', e.clientX, e.clientY);
                  }}
                >
                  <div className="w-1 h-8 bg-white rounded-full pointer-events-none shadow" />
                </div>

                {/* Right Edge Handle */}
                <div
                  className="crop-handle absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-16 cursor-ew-resize flex items-center justify-center z-20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDragging('e', e.clientX, e.clientY);
                  }}
                >
                  <div className="w-1 h-8 bg-white rounded-full pointer-events-none shadow" />
                </div>

                {/* Live Dimensions Pill */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-200 border border-zinc-700 pointer-events-none whitespace-nowrap shadow-lg">
                  {cropBox.width} × {cropBox.height}px ({cropPreset})
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-zinc-500">
            <AlertCircle className="w-8 h-8 text-zinc-400" />
            <p className="text-sm">No image available to crop.</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-full bg-white text-black font-bold text-xs"
            >
              Upload Image Strip
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM CONTROL BAR (Aspect Ratios, Rotate, Flip & Panels Queue Drawer) */}
      {/* ========================================================================= */}
      <footer className="bg-black/95 border-t border-zinc-900 z-30 shrink-0 pb-safe">
        {/* Aspect Ratio Selector Pills */}
        <div className="px-3 py-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar border-b border-zinc-900/60">
          {(
            [
              { id: 'free', label: 'Free' },
              { id: '9:16', label: '9:16 Reel' },
              { id: '1:1', label: '1:1 Square' },
              { id: '3:4', label: '3:4 Comic' },
              { id: '4:5', label: '4:5 Portrait' },
              { id: '16:9', label: '16:9' },
              { id: 'full-width', label: 'Full Strip' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                cropPreset === preset.id
                  ? 'bg-amber-500 text-black font-bold shadow'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Phone Action Bar (Crop active icon, Rotate, Flip, Queue drawer toggle) */}
        <div className="h-16 px-4 flex items-center justify-between max-w-2xl mx-auto">
          {/* Crop Tool (highlighted yellow like phone editor screenshot) */}
          <div className="flex flex-col items-center justify-center text-amber-400 cursor-pointer">
            <Crop className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] font-bold mt-0.5">Crop</span>
            <div className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />
          </div>

          {/* Rotate 90 deg */}
          <button
            onClick={handleRotate}
            className="flex flex-col items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Rotate 90°"
          >
            <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] font-medium mt-0.5">Rotate</span>
          </button>

          {/* Flip Horizontal */}
          <button
            onClick={handleFlipHorizontal}
            className="flex flex-col items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Flip horizontally"
          >
            <FlipHorizontal className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] font-medium mt-0.5">Flip</span>
          </button>

          {/* Panels Sequence Queue Drawer Toggle */}
          <button
            onClick={() => setIsQueueDrawerOpen((prev) => !prev)}
            className={`flex flex-col items-center justify-center transition-colors cursor-pointer relative ${
              croppedPanels.length > 0
                ? 'text-rose-400 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="View Cropped Panels Queue & Save to CBZ"
          >
            <div className="relative">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
              {croppedPanels.length > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                  {croppedPanels.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium mt-0.5">
              Panels ({croppedPanels.length})
            </span>
          </button>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 4. SLIDE-UP PANELS QUEUE DRAWER & CBZ REPLACER                           */}
      {/* ========================================================================= */}
      {isQueueDrawerOpen && (
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in">
          <div className="bg-zinc-950 border-t border-zinc-800 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Cropped Panels Sequence ({croppedPanels.length})
                </h3>
              </div>
              <button
                onClick={() => setIsQueueDrawerOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Panels List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {croppedPanels.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 space-y-2">
                  <Crop className="w-10 h-10 mx-auto text-zinc-600" />
                  <p className="text-sm font-medium text-zinc-400">No panels cropped yet.</p>
                  <p className="text-xs max-w-xs mx-auto text-zinc-500">
                    Adjust the white corner handles on the image and tap &quot;Save&quot; at the top
                    to save each panel into the sequence.
                  </p>
                </div>
              ) : (
                croppedPanels.map((panel, idx) => (
                  <div
                    key={panel.id}
                    className="p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {idx + 1}
                    </div>

                    <div className="w-16 h-20 rounded-xl overflow-hidden bg-black border border-zinc-800 shrink-0">
                      <img
                        src={panel.dataUrl}
                        alt={`Panel ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {panel.note || `Panel #${idx + 1}`}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                        {panel.width} × {panel.height}px
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => movePanel(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => movePanel(idx, 'down')}
                        disabled={idx === croppedPanels.length - 1}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removePanel(idx)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Retained Uncropped Pages Section */}
              {includeUncroppedPages && uncroppedPagesCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                    <span className="flex items-center gap-1.5 text-zinc-200 font-bold">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      <span>Retained Uncropped Pages ({uncroppedPagesCount})</span>
                    </span>
                    <span className="text-[10px] text-zinc-400">Kept in chapter order</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    These uncropped original pages will remain in the chapter so you can crop them later:
                  </p>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {pages.map((_, idx) => {
                      const isCropped = croppedPageSet.has(idx + 1);
                      if (isCropped) return null;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedPageIndex(idx);
                            setIsQueueDrawerOpen(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 hover:border-amber-500/50 text-[11px] text-zinc-300 hover:text-white shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                          title={`Click to switch and crop Page ${idx + 1}`}
                        >
                          <span>Page {idx + 1}</span>
                          <Crop className="w-2.5 h-2.5 text-amber-400 ml-0.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Status Feedback */}
            {errorMsg && (
              <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
            )}
            {saveStatus && !errorMsg && (
              <div className="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{saveStatus}</span>
              </div>
            )}

            {/* Drawer Actions */}
            <div className="p-4 border-t border-zinc-800 space-y-2 bg-zinc-900/60">
              {saveComplete ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs text-center font-bold">
                    🎉 Panels Saved &amp; CBZ File Replaced!
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (onOpenVideoStudio && savedChapter) {
                          onOpenVideoStudio(manga, savedChapter);
                          onClose();
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow cursor-pointer"
                    >
                      <Film className="w-4 h-4" />
                      <span>Video Studio</span>
                    </button>
                    <button
                      onClick={() => {
                        if (onOpenReader && savedChapter) {
                          onOpenReader(manga, savedChapter);
                          onClose();
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Open Reader</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {uncroppedPagesCount > 0 && (
                    <label className="flex items-start justify-between p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                      <div className="space-y-1 pr-2">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Keep Uncropped Pages in Chapter</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">Recommended</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-tight">
                          Retains {uncroppedPagesCount} uncropped pages so you can continue cropping them later without losing pages.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeUncroppedPages}
                        onChange={(e) => setIncludeUncroppedPages(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400 accent-rose-500 cursor-pointer shrink-0 mt-0.5"
                      />
                    </label>
                  )}

                  <button
                    id="btn-save-replace-cbz"
                    onClick={() => handleSaveAndReplace(false)}
                    disabled={isSaving || croppedPanels.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-98"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving &amp; Building CBZ...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>
                          Save &amp; Replace CBZ (
                          {includeUncroppedPages && uncroppedPagesCount > 0
                            ? `${croppedPanels.length} Panels + ${uncroppedPagesCount} Uncropped = ${croppedPanels.length + uncroppedPagesCount} Total`
                            : `${croppedPanels.length} Panels`}
                          )
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleSaveAndReplace(true)}
                    disabled={isSaving || croppedPanels.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                    <span>
                      Download CBZ File Only (
                      {includeUncroppedPages && uncroppedPagesCount > 0
                        ? `${croppedPanels.length + uncroppedPagesCount} Pages`
                        : `${croppedPanels.length} Panels`}
                      )
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
