'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Edit3, Film, Library, ArrowLeft, RefreshCw, Loader2, CheckCircle2, Server } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const seriesId = resolvedParams.id;

  const [series, setSeries] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);

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
          <h1 className="text-xl font-bold mb-2">Series Not Found in Suwayomi Library</h1>
          <p className="text-neutral-400 text-sm mb-4">Ensure this webtoon is added to your Suwayomi library on port 4567.</p>
          <Link href="/" className="text-indigo-400 hover:underline">Return to Explore</Link>
        </div>
      </div>
    );
  }

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
              <span className="bg-emerald-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
                <Server className="w-3 h-3" />
                <span>Suwayomi Sync</span>
              </span>
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
                <span>{refreshing ? 'Syncing...' : 'Sync from Suwayomi'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Chapters ({chapters.length})</span>
          </h2>
          <span className="text-xs text-neutral-400">Fetched directly from Suwayomi :4567</span>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/50 rounded-2xl border border-neutral-800">
            <p className="text-sm text-neutral-400 mb-4">No chapters found in Suwayomi for this series.</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Sync</span>
            </button>
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
                      Chapter #{chap.chapterNumber} {chap.isDownloaded && '• Downloaded'} {chap.isRead && '• Read ✓'}
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
                    href={`/chapters/${chap._id}/editor`}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Panel Editor</span>
                  </Link>
                  <Link
                    href={`/chapters/${chap._id}/studio`}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video Studio</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
