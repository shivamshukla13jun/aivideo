'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, ZoomIn, ZoomOut, CheckCircle, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';


export default function WebtoonReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chapterId = resolvedParams.id;

  const [chapter, setChapter] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'vertical' | 'page'>('vertical');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    async function loadReaderData() {
      try {
        const [chapRes, pagesRes] = await Promise.all([
          fetch(`/api/chapters/${chapterId}`),
          fetch(`/api/chapters/${chapterId}/pages`),
        ]);
        const cData = await chapRes.json();
        const pData = await pagesRes.json();

        if (cData.success) setChapter(cData.data);
        if (pData.success) setPages(pData.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadReaderData();
  }, [chapterId]);

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
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

  const activePage = pages[currentPageIndex];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Reader Controls */}
      <header className="sticky top-0 z-50 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={chapter ? `/series/${chapter.seriesId}` : '/'}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white">Chapter {chapter?.chapterNumber}: {chapter?.title}</h1>
            <p className="text-[10px] text-neutral-400">Total Pages: {pages.length}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-neutral-800 rounded-xl p-1 flex items-center space-x-1 border border-neutral-700">
            <button
              onClick={() => setMode('vertical')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                mode === 'vertical' ? 'bg-indigo-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Vertical Scroll
            </button>
            <button
              onClick={() => setMode('page')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                mode === 'page' ? 'bg-indigo-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Single Page
            </button>
          </div>

          <button
            onClick={() => setIsCompleted(true)}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow ${
              isCompleted ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>{isCompleted ? 'Marked Read' : 'Mark Read'}</span>
          </button>
        </div>
      </header>

      {/* Reader Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        {mode === 'vertical' ? (
          <div className="w-full max-w-3xl flex flex-col items-center space-y-2">
            {pages.map((page, idx) => (
              <div key={page._id} className="relative w-full shadow-2xl bg-neutral-900 rounded-xl overflow-hidden" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
                <img
                  src={page.editedUrl || page.originalUrl}
                  alt={`Page ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-contain block"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full max-w-2xl flex flex-col items-center space-y-6">
            {activePage && (
              <div className="relative w-full aspect-[3/4] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-neutral-800">
                <img
                  src={activePage.editedUrl || activePage.originalUrl}
                  alt={`Page ${currentPageIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="flex items-center justify-between w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-6 py-4 shadow-lg">
              <button
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0}
                className="disabled:opacity-30 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <span className="text-xs font-bold text-neutral-300">
                Page {currentPageIndex + 1} of {pages.length}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPageIndex === pages.length - 1}
                className="disabled:opacity-30 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all shadow"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
