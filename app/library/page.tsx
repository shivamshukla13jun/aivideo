'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { Library as LibraryIcon, Trash2, Play, BookOpen, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';


export default function LibraryPage() {
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLibrary() {
      try {
        const res = await fetch('/api/library');
        const data = await res.json();
        if (data.success) setLibraryItems(data.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadLibrary();
  }, []);

  const handleRemove = async (seriesId: string) => {
    try {
      await fetch(`/api/library?seriesId=${seriesId}`, { method: 'DELETE' });
      setLibraryItems(prev => prev.filter(item => item.seriesId?._id !== seriesId));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center space-x-3">
              <LibraryIcon className="w-8 h-8 text-indigo-500" />
              <span>My Persistent Library</span>
            </h1>
            <p className="text-sm text-neutral-400 mt-1">Manage your saved webtoons, continue reading, and track progress.</p>
          </div>
          <Link
            href="/"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow"
          >
            Explore Catalog
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-neutral-900 h-48 rounded-2xl" />
            ))}
          </div>
        ) : libraryItems.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900/50 rounded-2xl border border-neutral-800">
            <BookOpen className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Your library is empty</h2>
            <p className="text-sm text-neutral-400 max-w-md mx-auto mb-6">
              Add series to your library from the explore catalog to easily track your reading progress and chapters.
            </p>
            <Link
              href="/"
              className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Browse Webtoons</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {libraryItems.map(item => {
              const series = item.seriesId;
              if (!series) return null;
              return (
                <div key={item._id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative group">
                  <div className="flex space-x-4">
                    <div className="relative w-24 h-36 flex-shrink-0 rounded-xl overflow-hidden shadow bg-neutral-950">
                      <img
                        src={series.coverImage}
                        alt={series.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-base truncate mb-1">{series.title}</h3>
                      <p className="text-xs text-neutral-400 mb-2">{series.author}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {series.genres?.slice(0, 2).map((g: string) => (
                          <span key={g} className="bg-neutral-800 text-neutral-300 text-[10px] px-2 py-0.5 rounded-md">
                            {g}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-neutral-400">Total Chapters: {series.chapters?.length || 0}</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between">
                    <Link
                      href={`/series/${series._id}`}
                      className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Open Series</span>
                    </Link>
                    <button
                      onClick={() => handleRemove(series._id)}
                      className="text-neutral-500 hover:text-red-400 p-2 rounded-lg transition-colors"
                      title="Remove from library"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
