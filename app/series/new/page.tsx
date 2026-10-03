'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Upload, Loader2, Sparkles, Image as ImageIcon, BookPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

const AVAILABLE_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Historical',
  'Horror',
  'Martial Arts',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Supernatural',
  'Thriller',
  'Webtoon',
];

export default function NewSeriesPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [alternativeTitle, setAlternativeTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [artist, setArtist] = useState('');
  const [genres, setGenres] = useState<string[]>(['Webtoon', 'Action']);
  const [status, setStatus] = useState<'ongoing' | 'completed' | 'hiatus'>('ongoing');
  const [language, setLanguage] = useState('English');
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear());

  const [coverUrl, setCoverUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [uploadingCover, setUploadingCover] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleGenre = (genre: string) => {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreview(objectUrl);

    // Upload to MongoDB GridFS Bucket Engine
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/bucket/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setCoverUrl(data.data.url);
      } else {
        throw new Error(data.error || 'Failed to upload cover image');
      }
    } catch (err: any) {
      console.error(err);
      setError('Cover upload failed: ' + (err.message || 'unknown error'));
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !author.trim() || !artist.trim()) {
      setError('Please fill in Title, Description, Author, and Artist');
      return;
    }

    if (!coverUrl.trim()) {
      setError('Please upload a cover image or enter a cover URL');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          alternativeTitle,
          description,
          author,
          artist,
          genres,
          status,
          language,
          releaseYear,
          coverImage: coverUrl,
          bannerImage: coverUrl,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create series');
      }

      // Redirect to the newly created series page where user can upload CBZ chapters
      router.push(`/series/${data.data._id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create series');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors border border-neutral-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center space-x-2">
              <BookPlus className="w-7 h-7 text-indigo-400" />
              <span>Upload Local Manga / Webtoon</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Create a local series in your database, then upload chapters with CBZ archives stored in the MongoDB Bucket Engine.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-950/60 border border-red-800/80 rounded-2xl text-xs sm:text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
          {/* Cover Image Upload Section */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Cover Image (Stored in MongoDB Bucket Engine) *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Cover Preview Box */}
              <div className="aspect-[3/4] bg-neutral-950 rounded-2xl border-2 border-dashed border-neutral-800 flex flex-col items-center justify-center overflow-hidden relative group">
                {coverPreview || coverUrl ? (
                  <>
                    <img
                      src={coverPreview || coverUrl}
                      alt="Cover preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <label className="cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl border border-neutral-700">
                        Change Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 text-neutral-500">
                    <ImageIcon className="w-8 h-8 text-neutral-600" />
                    <span className="text-xs">No cover selected</span>
                  </div>
                )}
                {uploadingCover && (
                  <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-xs text-indigo-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    <span>Uploading to MongoDB Bucket…</span>
                  </div>
                )}
              </div>

              {/* Upload & URL Input */}
              <div className="md:col-span-2 space-y-4">
                <div className="border border-neutral-800 rounded-2xl p-4 bg-neutral-950/60 space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-neutral-300">
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>Option A: Upload File Directly</span>
                  </div>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 hover:border-indigo-500/50 rounded-xl p-4 cursor-pointer transition-all bg-neutral-900/40">
                    <span className="text-xs font-semibold text-neutral-300 mb-1">
                      Choose an image file (PNG, JPG, WebP)
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Will be uploaded to MongoDB GridFS Bucket
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="border border-neutral-800 rounded-2xl p-4 bg-neutral-950/60 space-y-2">
                  <span className="text-xs font-bold text-neutral-300 block">
                    Option B: Or Enter Image URL
                  </span>
                  <input
                    type="url"
                    value={coverUrl}
                    onChange={(e) => {
                      setCoverUrl(e.target.value);
                      if (!coverPreview) setCoverPreview(e.target.value);
                    }}
                    placeholder="https://example.com/cover.jpg or /api/bucket/..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Title & Alternative Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Manga Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Solo Leveling, Omniscient Reader"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Alternative Title (Optional)
              </label>
              <input
                type="text"
                value={alternativeTitle}
                onChange={(e) => setAlternativeTitle(e.target.value)}
                placeholder="e.g. Only I Level Up"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Author & Artist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Author *
              </label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Chugong"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Artist *
              </label>
              <input
                type="text"
                required
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. DUBU (REDICE STUDIO)"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
              Synopsis / Description *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter synopsis of the webtoon..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Status, Language, Release Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="hiatus">Hiatus</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Language
              </label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Release Year
              </label>
              <input
                type="number"
                value={releaseYear}
                onChange={(e) => setReleaseYear(parseInt(e.target.value, 10))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Genres Tag Selector */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Genres ({genres.length} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_GENRES.map((g) => {
                const active = genres.includes(g);
                return (
                  <button
                    type="button"
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex items-center justify-end space-x-4">
            <Link
              href="/"
              className="px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || uploadingCover}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-8 py-3 rounded-xl text-xs sm:text-sm transition-all shadow-lg flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Series in DB…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Manga Series</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
