'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import { Server, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { SUWAYOMI_URL } from '@/lib/suwayomi';

export default function NewSeriesPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-lg">
          <Server className="w-8 h-8 text-indigo-400" />
        </div>

        <div className="space-y-2 max-w-lg">
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Library Managed via Suwayomi
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            All webtoon series and chapters are directly fetched and synchronized from your local Suwayomi Server on port <strong>{SUWAYOMI_URL}</strong>. Manual creation and CBZ archive uploads have been disabled.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-left max-w-md w-full space-y-3">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">How to add webtoons:</h3>
          <ol className="text-xs text-neutral-400 space-y-2 list-decimal list-inside">
            <li>Open your Suwayomi WebUI at <code className="bg-neutral-950 px-2 py-0.5 rounded text-indigo-400">{SUWAYOMI_URL}</code></li>
            <li>Browse sources or install extensions to find your favorite webtoon</li>
            <li>Click <strong>Add to Library</strong> in Suwayomi</li>
            <li>Return here to read, edit panels, and produce video scenes!</li>
          </ol>
        </div>

        <div className="flex items-center space-x-4 pt-2">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Explore</span>
          </Link>
          <a
            href={SUWAYOMI_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold px-6 py-2.5 rounded-xl text-sm transition-all border border-neutral-800"
          >
            <span>Open Suwayomi</span>
            <ExternalLink className="w-4 h-4 text-neutral-400" />
          </a>
        </div>
      </main>
    </div>
  );
}
