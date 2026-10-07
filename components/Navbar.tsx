'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Home, Library, Youtube, Plus, Globe, Settings } from 'lucide-react';

export default function Navbar() {
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama'>('gemini');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/settings/ai');
        const data = await res.json();
        if (data.success) setAiProvider(data.data.provider);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const switchProvider = async (p: 'gemini' | 'ollama') => {
    setAiProvider(p);
    try {
      await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p }),
      });
    } catch {}
  };

  return (
    <header className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2 text-indigo-500 font-bold text-xl">
            <Sparkles className="w-6 h-6 animate-pulse text-indigo-400" />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Webtoon Studio</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-neutral-400">
            <Link href="/" className="hover:text-white transition-colors flex items-center space-x-1.5">
              <Home className="w-4 h-4" />
              <span>Explore</span>
            </Link>
            <Link href="/library" className="hover:text-white transition-colors flex items-center space-x-1.5">
              <Library className="w-4 h-4" />
              <span>My Library</span>
            </Link>
            <Link href="/youtube" className="hover:text-white transition-colors flex items-center space-x-1.5">
              <Youtube className="w-4 h-4 text-red-500" />
              <span>YouTube</span>
            </Link>
            <Link href="/distribute" className="hover:text-white transition-colors flex items-center space-x-1.5">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>Distribute</span>
            </Link>
            <Link href="/settings" className="hover:text-white transition-colors flex items-center space-x-1.5">
              <Settings className="w-4 h-4 text-neutral-500" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <div
            className="hidden sm:flex items-center bg-neutral-900 border border-neutral-800 rounded-full p-0.5 text-[11px] font-semibold"
            title="AI provider for translation & SEO"
          >
            {(['gemini', 'ollama'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => switchProvider(p)}
                className={`px-2.5 py-1 rounded-full capitalize transition-colors ${
                  aiProvider === p
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Link
            href="/series/new"
            className="flex items-center space-x-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-full text-white shadow transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Series</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
