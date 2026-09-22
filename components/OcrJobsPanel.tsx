'use client';

import React, { useEffect, useState } from 'react';
import { ScanText, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface OcrJobItem {
  jobId: string;
  chapterId: string;
  seriesTitle: string;
  chapterName: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  totalPages: number;
  donePages: number;
  failedOrders: number[];
  error?: string;
}

export default function OcrJobsPanel() {
  const [jobs, setJobs] = useState<OcrJobItem[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadJobs = async () => {
    try {
      const res = await fetch('/api/ocr-jobs');
      const data = await res.json();
      if (data.success) setJobs(data.data);
    } catch {
      // silent — panel just won't update this tick
    }
  };

  useEffect(() => {
    loadJobs();
    const timer = setInterval(loadJobs, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleRetry = async (jobId: string) => {
    setRetrying(jobId);
    try {
      await fetch(`/api/ocr-jobs/${jobId}/retry`, { method: 'POST' });
      await loadJobs();
    } finally {
      setRetrying(null);
    }
  };

  if (jobs.length === 0) return null;

  const statusStyle = (status: OcrJobItem['status']) => {
    switch (status) {
      case 'running':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'done':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'failed':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      default:
        return 'bg-neutral-800 text-neutral-300 border-neutral-700';
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
        <ScanText className="w-5 h-5 text-emerald-400" />
        <span>OCR Extraction Jobs</span>
      </h2>

      <div className="space-y-3">
        {jobs.map((job) => {
          const pct = job.totalPages > 0 ? Math.round((job.donePages / job.totalPages) * 100) : 0;
          return (
            <div
              key={job.jobId}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">
                    {job.seriesTitle || 'Unknown Series'}
                    <span className="text-neutral-400 font-medium"> — {job.chapterName || `Chapter ${job.chapterId}`}</span>
                  </p>
                  <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                    {job.donePages}/{job.totalPages || '?'} pages
                    {job.failedOrders.length > 0 && (
                      <span className="text-red-400"> • {job.failedOrders.length} failed (pages {job.failedOrders.join(', ')})</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${statusStyle(job.status)}`}>
                    {job.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {job.status === 'done' && <CheckCircle2 className="w-3 h-3" />}
                    {job.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                    {job.status}
                  </span>
                  {job.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(job.jobId)}
                      disabled={retrying === job.jobId}
                      className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${retrying === job.jobId ? 'animate-spin' : ''}`} />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    job.status === 'failed' ? 'bg-red-500' : job.status === 'done' ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${job.totalPages > 0 ? Math.min(100, pct) : job.status === 'done' ? 100 : 5}%` }}
                />
              </div>

              {job.error && <p className="text-[11px] text-red-400">{job.error}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
