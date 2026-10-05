'use client';

import React, { useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { BookOpen, ArrowLeft, Loader2, Upload, ImagePlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NewSeriesPage() {
  const router = useRouter();
  const coverRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: '', author: '', artist: '', description: '', genres: '' });
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setCover(f);
    setCoverPreview(f ? URL.createObjectURL(f) : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Title is required');
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (cover) fd.append('cover', cover);
      const res = await fetch('/api/series', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create series');
      router.push(`/series/${data.data._id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create series');
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-all';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">New Series</h1>
            <p className="text-sm text-neutral-400">Create a manga/webtoon series, then upload chapters as .cbz files.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-start gap-5">
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="w-28 aspect-[3/4] rounded-xl border-2 border-dashed border-neutral-700 hover:border-indigo-500 bg-neutral-950 flex flex-col items-center justify-center gap-1.5 text-neutral-500 hover:text-indigo-400 transition-colors overflow-hidden flex-shrink-0"
            >
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-[10px] font-semibold">Cover</span>
                </>
              )}
            </button>
            <input ref={coverRef} type="file" accept="image/*" onChange={pickCover} className="hidden" />
            <div className="flex-1 space-y-4">
              <input className={inputCls} placeholder="Series title *" value={form.title} onChange={(e) => set('title', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Author" value={form.author} onChange={(e) => set('author', e.target.value)} />
                <input className={inputCls} placeholder="Artist" value={form.artist} onChange={(e) => set('artist', e.target.value)} />
              </div>
            </div>
          </div>

          <textarea
            className={`${inputCls} h-24 resize-none`}
            placeholder="Description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Genres (comma separated, e.g. Action, Fantasy)"
            value={form.genres}
            onChange={(e) => set('genres', e.target.value)}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <Link href="/" className="inline-flex items-center space-x-2 text-neutral-400 hover:text-white text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{saving ? 'Creating…' : 'Create Series'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
