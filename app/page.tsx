'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { BookOpen, Play, Search, Star, Clock, Layers, Server, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [loading, setLoading] = useState(true);
  const [suwayomiConnected, setSuwayomiConnected] = useState<boolean | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [seriesRes, libRes] = await Promise.all([
        fetch('/api/series'),
        fetch('/api/library'),
      ]);
      const seriesData = await seriesRes.json();
      const libData = await libRes.json();

      if (seriesData.success) {
        setSeriesList(seriesData.data);
        setSuwayomiConnected(true);
      } else {
        setSuwayomiConnected(false);
      }
      if (libData.success) setLibraryItems(libData.data);
    } catch (e) {
      console.error(e);
      setSuwayomiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const genres = ['All', 'Action', 'Fantasy', 'Adventure', 'Sports', 'Drama', 'Psychological', 'Romance'];

  const filteredSeries = seriesList.filter((s) => {
    const matchesSearch =
      s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.author?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'All' || s.genres?.includes(selectedGenre);
    return matchesSearch && matchesGenre;
  });

  const featuredSeries = seriesList[0] || null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar />

      {/* Hero / Featured Section */}
      {featuredSeries && (
        <section className="relative w-full h-[450px] sm:h-[500px] overflow-hidden flex items-end">
          <div className="absolute inset-0 z-0">
            <img
              src={featuredSeries.bannerImage || featuredSeries.coverImage}
              alt={featuredSeries.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-40 blur-[2px] scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center space-x-2 mb-3">
                <span className="inline-block bg-indigo-600/90 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Featured Masterpiece
                </span>
                <span className="inline-flex items-center space-x-1 bg-emerald-600/80 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  <Server className="w-3 h-3" />
                  <span>Suwayomi :4567</span>
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
                {featuredSeries.title}
              </h1>
              <p className="text-neutral-300 text-sm sm:text-base line-clamp-3 mb-6">
                {featuredSeries.description}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/series/${featuredSeries._id}`}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center space-x-2"
                >
                  <BookOpen className="w-5 h-5" />
                  <span>Start Reading</span>
                </Link>
                <div className="flex items-center space-x-2 text-sm text-neutral-400 bg-neutral-900/80 px-4 py-3 rounded-xl border border-neutral-800">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>{featuredSeries.author}</span>
                  <span>•</span>
                  <span>{featuredSeries.status?.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-12">
        
        {/* Connection status banner if error */}
        {suwayomiConnected === false && (
          <div className="bg-red-950/50 border border-red-800 text-red-200 px-6 py-4 rounded-2xl flex items-center justify-between shadow">
            <div className="flex items-center space-x-3">
              <Server className="w-5 h-5 text-red-400" />
              <div>
                <p className="font-bold text-sm">Cannot reach Suwayomi Server at port 4567</p>
                <p className="text-xs text-red-300">Ensure Suwayomi is running at http://localhost:4567</p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Search & Genre Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search webtoons, authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  selectedGenre === genre
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Continue Reading Section */}
        {libraryItems.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <span>Continue Reading</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryItems.map((item) => {
                const series = item.seriesId;
                if (!series) return null;
                return (
                  <div key={item._id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center space-x-4 shadow-lg hover:border-neutral-700 transition-all">
                    <div className="relative w-20 h-28 flex-shrink-0 rounded-xl overflow-hidden shadow bg-neutral-950">
                      <img
                        src={series.coverImage}
                        alt={series.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-base truncate mb-1">{series.title}</h3>
                      <p className="text-xs text-neutral-400 mb-3">Progress: {item.readingProgressPercent}%</p>
                      <div className="w-full bg-neutral-800 h-2 rounded-full mb-4 overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${item.readingProgressPercent}%` }} />
                      </div>
                      <Link
                        href={`/series/${series._id}`}
                        className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* All Series / Catalog from Suwayomi */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-purple-400" />
              <span>Suwayomi Library Catalog ({filteredSeries.length})</span>
            </h2>
            <button
              onClick={loadData}
              className="text-xs text-neutral-400 hover:text-white flex items-center space-x-1.5 bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Library</span>
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-pulse">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="bg-neutral-900 h-80 rounded-2xl" />
              ))}
            </div>
          ) : filteredSeries.length === 0 ? (
            <div className="text-center py-16 bg-neutral-900/50 rounded-2xl border border-neutral-800">
              <p className="text-neutral-400 text-sm mb-2">No webtoons found matching your criteria in Suwayomi library.</p>
              <p className="text-neutral-500 text-xs">Add webtoons to your Suwayomi server (http://localhost:4567) to see them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredSeries.map((series) => (
                <Link
                  key={series._id}
                  href={`/series/${series._id}`}
                  className="group flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-800">
                    <img
                      src={series.coverImage}
                      alt={series.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 bg-neutral-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-indigo-400 uppercase">
                      {series.status}
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">
                        {series.title}
                      </h3>
                      <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">{series.author}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {series.genres?.slice(0, 2).map((g: string) => (
                        <span key={g} className="bg-neutral-800 text-neutral-300 text-[10px] font-medium px-2 py-0.5 rounded-md">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </main>

      <footer className="border-t border-neutral-900 bg-neutral-950 py-8 text-center text-xs text-neutral-500">
        <p>Webtoon Studio & Reader • Live Suwayomi Server Integration (:4567)</p>
      </footer>
    </div>
  );
}
