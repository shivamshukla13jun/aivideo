'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Home, Library, Server } from 'lucide-react';

export default function Navbar() {
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
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs font-semibold bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full text-emerald-400 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <Server className="w-3.5 h-3.5" />
            <span>Suwayomi :4567</span>
          </div>
        </div>
      </div>
    </header>
  );
}
