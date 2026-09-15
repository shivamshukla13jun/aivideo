/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { LibraryView } from './components/LibraryView.js';
import { UpdatesView } from './components/UpdatesView.js';
import { HistoryView } from './components/HistoryView.js';
import { SettingsView } from './components/SettingsView.js';
import { DownloadsView } from './components/DownloadsView.js';
import { AiProjectsView } from './components/AiProjectsView.js';
import { AiGeneratorView } from './components/AiGeneratorView.js';
import { MangaDetailPage } from './components/MangaDetailPage.js';
import { PanelCropperModal } from './components/PanelCropperModal.js';
import { MangaReader } from './components/MangaReader.js';
import { MongoStatusModal } from './components/MongoStatusModal.js';
import { AndroidApkModal } from './components/AndroidApkModal.js';
import { UploadCbzModal } from './components/UploadCbzModal.js';
import { NavigationTab, Manga, Chapter, Category, MongoStatus } from './types.js';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('library');
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [downloadCount, setDownloadCount] = useState<number>(0);

  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [readingSession, setReadingSession] = useState<{
    manga: Manga;
    chapter: Chapter;
    chapters: Chapter[];
  } | null>(null);
  const [cropperSession, setCropperSession] = useState<{
    manga: Manga;
    chapter: Chapter;
  } | null>(null);

  const [mongoStatus, setMongoStatus] = useState<MongoStatus>({
    connected: false,
    status: 'connecting',
  });
  const [isMongoModalOpen, setIsMongoModalOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [isUploadCbzModalOpen, setIsUploadCbzModalOpen] = useState(false);
  const [uploadModalMangaId, setUploadModalMangaId] = useState<number | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Initial load
  const loadData = useCallback(async () => {
    try {
      const [mangaRes, catRes, srcRes, dbRes, dlRes] = await Promise.all([
        fetch('/api/v1/manga?inLibrary=true'),
        fetch('/api/v1/category'),
        fetch('/api/v1/source/list'),
        fetch('/api/v1/database/status'),
        fetch('/api/v1/download/status'),
      ]);

      if (mangaRes.ok) setMangas(await mangaRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (dbRes.ok) setMongoStatus(await dbRes.json());
      if (dlRes.ok) {
        const dlStatus = await dlRes.json();
        setDownloadCount(dlStatus.activeCount || dlStatus.queueLength || 0);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle in library
  const handleToggleLibrary = async (manga: Manga) => {
    const shouldAdd = !manga.inLibrary;
    try {
      const url = `/api/v1/manga/${manga.id}/library`;
      const method = shouldAdd ? 'POST' : 'DELETE';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...manga, inLibrary: shouldAdd }),
      });
      const updated = res.ok ? await res.json() : null;
      const finalItem = { ...(updated || manga), inLibrary: shouldAdd };

      setMangas((prev) => {
        const exists = prev.some((m) => m.id === manga.id);
        if (shouldAdd) {
          return exists
            ? prev.map((m) => (m.id === manga.id ? finalItem : m))
            : [...prev, finalItem];
        } else {
          return prev.map((m) => (m.id === manga.id ? { ...m, inLibrary: false } : m));
        }
      });

      if (selectedManga && selectedManga.id === manga.id) {
        setSelectedManga((prev) => (prev ? { ...prev, inLibrary: shouldAdd } : null));
      }
    } catch (err) {
      console.error('Failed to update library state:', err);
    }
  };

  // Update categories for manga
  const handleUpdateCategories = async (mangaId: number, categoryIds: number[]) => {
    try {
      await fetch(`/api/v1/manga/${mangaId}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: categoryIds }),
      });

      setMangas((prev) =>
        prev.map((m) => (m.id === mangaId ? { ...m, categories: categoryIds } : m))
      );

      if (selectedManga && selectedManga.id === mangaId) {
        setSelectedManga((prev) => (prev ? { ...prev, categories: categoryIds } : null));
      }
    } catch (err) {
      console.error('Failed to update categories:', err);
    }
  };

  // Create new category
  const handleCreateCategory = async (name: string) => {
    try {
      const res = await fetch('/api/v1/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const newCat = await res.json();
        setCategories((prev) => [...prev, newCat]);
      }
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  // Start reading
  const handleStartReading = async (manga: Manga, chapter: Chapter) => {
    try {
      const res = await fetch(`/api/v1/manga/${manga.id}/chapters`);
      const chapters = await res.json();
      setReadingSession({
        manga,
        chapter,
        chapters: chapters || [chapter],
      });
    } catch (e) {
      setReadingSession({
        manga,
        chapter,
        chapters: [chapter],
      });
    }
  };

  // Quick read from library
  const handleQuickRead = async (manga: Manga) => {
    try {
      const res = await fetch(`/api/v1/manga/${manga.id}/chapters`);
      const chapters: Chapter[] = await res.json();
      if (!chapters || chapters.length === 0) return;

      const firstUnread = chapters.slice().reverse().find((c) => !c.read) || chapters[0];
      setReadingSession({
        manga,
        chapter: firstUnread,
        chapters,
      });
    } catch (e) {
      console.error('Error starting quick read:', e);
    }
  };

  // Resume from History
  const handleReadMangaChapterId = async (mangaId: number, chapterId: number) => {
    const manga = mangas.find((m) => m.id === mangaId);
    if (!manga) return;

    try {
      const res = await fetch(`/api/v1/manga/${mangaId}/chapters`);
      const chapters: Chapter[] = await res.json();
      const chapter = chapters.find((c) => c.id === chapterId);
      if (chapter) {
        setReadingSession({
          manga,
          chapter,
          chapters,
        });
      }
    } catch (e) {
      console.error('Failed to resume chapter:', e);
    }
  };

  // Toggle chapter read
  const handleToggleChapterRead = async (chapter: Chapter) => {
    try {
      await fetch(`/api/v1/chapter/${chapter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: !chapter.read }),
      });
      loadData();
    } catch (e) {
      console.error('Failed to toggle chapter read:', e);
    }
  };

  // Toggle chapter bookmark
  const handleToggleChapterBookmark = async (chapter: Chapter) => {
    try {
      await fetch(`/api/v1/chapter/${chapter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmark: !chapter.bookmark }),
      });
    } catch (e) {
      console.error('Failed to toggle bookmark:', e);
    }
  };

  // Mark all read / unread
  const handleMarkAllRead = async (mangaId: number, read: boolean) => {
    try {
      const res = await fetch(`/api/v1/manga/${mangaId}/chapters`);
      const chapters: Chapter[] = await res.json();
      const chapterIds = chapters.map((c) => c.id);

      await fetch('/api/v1/chapter/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIds, read }),
      });

      loadData();
    } catch (e) {
      console.error('Failed to mark chapters read:', e);
    }
  };

  // Update reading progress callback
  const handleProgressUpdate = (chapterId: number, lastPageRead: number, isFinished: boolean) => {
    setReadingSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        chapter: {
          ...prev.chapter,
          lastPageRead,
          read: isFinished,
        },
      };
    });
  };

  // Delete manga
  const handleDeleteManga = async (mangaId: number) => {
    try {
      const res = await fetch(`/api/v1/manga/${mangaId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMangas((prev) => prev.filter((m) => m.id !== mangaId));
        if (selectedManga?.id === mangaId) {
          setSelectedManga(null);
        }
      } else {
        const err = await res.json();
        alert(`Failed to delete manga: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Failed to delete manga: ${e.message}`);
    }
  };

  // Download project ZIP
  const handleDownloadZip = () => {
    setIsDownloadingZip(true);
    // Direct link trigger
    const link = document.createElement('a');
    link.href = '/api/v1/download/project-zip';
    link.download = 'suwayomi-server-typescript.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      setIsDownloadingZip(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Navigation Header */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setSelectedManga(null);
        }}
        mongoStatus={mongoStatus}
        onOpenMongoModal={() => setIsMongoModalOpen(true)}
        onOpenApkModal={() => setIsApkModalOpen(true)}
        onOpenUploadCbzModal={() => setIsUploadCbzModalOpen(true)}
        onDownloadZip={handleDownloadZip}
        isDownloadingZip={isDownloadingZip}
        downloadCount={downloadCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {selectedManga ? (
          <MangaDetailPage
            manga={selectedManga}
            categories={categories}
            onBack={() => setSelectedManga(null)}
            onToggleLibrary={handleToggleLibrary}
            onUpdateCategories={handleUpdateCategories}
            onReadChapter={(manga, ch) => {
              handleStartReading(manga, ch);
            }}
            onToggleChapterRead={handleToggleChapterRead}
            onToggleChapterBookmark={handleToggleChapterBookmark}
            onMarkAllRead={handleMarkAllRead}
            onMangaUpdated={(updatedManga) => {
              setMangas((prev) => prev.map((m) => (m.id === updatedManga.id ? updatedManga : m)));
              setSelectedManga(updatedManga);
            }}
            onDeleteManga={(deletedMangaId) => {
              setMangas((prev) => prev.filter((m) => m.id !== deletedMangaId));
              setSelectedManga(null);
            }}
            onOpenPanelCropper={(manga, ch) => {
              setCropperSession({ manga, chapter: ch });
            }}
            onOpenVideoStudio={(manga, ch) => {
              handleStartReading(manga, ch);
            }}
          />
        ) : (
          <>
            {currentTab === 'library' && (
              <LibraryView
                mangas={mangas}
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onSelectManga={setSelectedManga}
                onQuickRead={handleQuickRead}
                onCreateCategory={handleCreateCategory}
                onNavigateToBrowse={() => setIsUploadCbzModalOpen(true)}
                onNavigateToExtensions={() => setCurrentTab('ai_generator')}
                onOpenUploadCbzModal={() => {
                  setUploadModalMangaId(null);
                  setIsUploadCbzModalOpen(true);
                }}
                onUploadChapter={(manga) => {
                  setUploadModalMangaId(manga.id);
                  setIsUploadCbzModalOpen(true);
                }}
                onDeleteManga={handleDeleteManga}
              />
            )}

            {currentTab === 'downloads' && (
              <DownloadsView onNavigateToLibrary={() => setCurrentTab('library')} />
            )}

            {currentTab === 'ai_generator' && (
              <AiGeneratorView
                mangas={mangas}
                onNavigateToLibrary={() => setCurrentTab('library')}
                initialManga={selectedManga}
              />
            )}

            {currentTab === 'ai_projects' && (
              <AiProjectsView
                onOpenReader={async (mangaId, chapterId) => {
                  let manga = mangas.find((m) => m.id === mangaId);
                  if (!manga) {
                    try {
                      const res = await fetch(`/api/v1/manga/${mangaId}`);
                      if (res.ok) manga = await res.json();
                    } catch (e) {}
                  }
                  if (manga) {
                    handleReadMangaChapterId(mangaId, chapterId);
                  }
                }}
                onOpenVideoStudio={(mangaId, chapterId) => {
                  let manga = mangas.find((m) => m.id === mangaId);
                  if (manga) {
                    handleReadMangaChapterId(mangaId, chapterId);
                  }
                }}
                onNavigateToLibrary={() => setCurrentTab('library')}
              />
            )}

            {currentTab === 'updates' && (
              <UpdatesView
                onReadChapter={handleStartReading}
                onSelectManga={setSelectedManga}
                onNavigateToLibrary={() => setCurrentTab('library')}
              />
            )}

            {currentTab === 'history' && (
              <HistoryView
                onReadMangaChapterId={handleReadMangaChapterId}
                onSelectMangaId={(id) => {
                  const manga = mangas.find((m) => m.id === id);
                  if (manga) setSelectedManga(manga);
                }}
                onNavigateToLibrary={() => setCurrentTab('library')}
              />
            )}

          </>
        )}
      </main>

      {/* Overall Image Panel Cropper & CBZ Replacer */}
      {cropperSession && (
        <PanelCropperModal
          isOpen={!!cropperSession}
          onClose={() => setCropperSession(null)}
          manga={cropperSession.manga}
          chapter={cropperSession.chapter}
          onSuccessReplace={(updatedChapter) => {
            loadData();
            if (selectedManga) {
              setSelectedManga({ ...selectedManga });
            }
          }}
          onOpenVideoStudio={(m, ch) => {
            setCropperSession(null);
            handleStartReading(m, ch);
          }}
          onOpenReader={(m, ch) => {
            setCropperSession(null);
            handleStartReading(m, ch);
          }}
        />
      )}

      {/* Manga Reader Overlay */}
      {readingSession && (
        <MangaReader
          manga={readingSession.manga}
          chapter={readingSession.chapter}
          chapters={readingSession.chapters}
          onClose={() => {
            setReadingSession(null);
            loadData();
          }}
          onSelectChapter={(nextCh) => {
            setReadingSession((prev) => (prev ? { ...prev, chapter: nextCh } : null));
          }}
          onProgressUpdate={handleProgressUpdate}
        />
      )}

      {/* MongoDB Status Modal */}
      <MongoStatusModal
        isOpen={isMongoModalOpen}
        onClose={() => setIsMongoModalOpen(false)}
        mongoStatus={mongoStatus}
        onRefreshMongoStatus={loadData}
      />

      {/* Android APK Download Modal */}
      <AndroidApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />

      {/* Upload Local CBZ / Manga Modal */}
      <UploadCbzModal
        isOpen={isUploadCbzModalOpen}
        onClose={() => {
          setIsUploadCbzModalOpen(false);
          setUploadModalMangaId(null);
        }}
        existingMangas={mangas}
        initialMangaId={uploadModalMangaId}
        initialMode={uploadModalMangaId ? 'existing' : 'new'}
        onUploadSuccess={(newManga) => {
          setMangas((prev) => {
            const idx = prev.findIndex((m) => m.id === newManga.id);
            if (idx !== -1) {
              return prev.map((m) => (m.id === newManga.id ? newManga : m));
            }
            return [newManga, ...prev];
          });
          loadData();
        }}
        onOpenReader={(manga, ch) => {
          handleStartReading(manga, ch);
        }}
        onOpenStudio={(manga, ch) => {
          handleStartReading(manga, ch);
        }}
      />
    </div>
  );
}
