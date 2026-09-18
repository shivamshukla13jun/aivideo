import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { seriesService } from '../services/seriesService';
import { setSeriesList } from '../redux/slices/seriesSlice';
import {
  BookOpen,
  Layers,
  FileText,
  Mic,
  Video,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Play,
  Upload
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: seriesList } = useAppSelector((state) => state.series);
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    seriesService.getSeriesList().then((data) => {
      dispatch(setSeriesList(data));
    }).catch(console.error);
  }, [dispatch]);

  const workflowSteps = [
    { num: 1, title: 'Import CBZ / Images', desc: 'Client-side JSZip extraction & natural sorting', icon: Upload, tab: 'chapters' },
    { num: 2, title: 'Webtoon Reader', desc: 'Read chapter & create scene narration scripts', icon: BookOpen, tab: 'reader' },
    { num: 3, title: 'Story Studio', desc: 'Build complete story & script versions', icon: FileText, tab: 'story-studio' },
    { num: 4, title: 'Reference Voice', desc: 'Enforce ONE reference storytelling voice', icon: Mic, tab: 'voice' },
    { num: 5, title: 'Video Studio (NLE)', desc: 'Multi-track video timeline & FFmpeg render', icon: Video, tab: 'video-studio' }
  ] as const;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-zinc-900 border border-indigo-500/20 p-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Webtoon Studio Engine
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, {user?.name || 'Creator'}
          </h1>
          <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed">
            Full-stack Webtoon Reader, Storytelling Studio, AI Voice Narration, and Professional Multi-Track Video Editor. Import comic chapters, generate narration, and export cinematic videos.
          </p>
          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/chapters')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              <Upload className="w-4 h-4" /> Upload New CBZ Chapter
            </button>
            <button
              onClick={() => navigate('/video-studio')}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all border border-zinc-700"
            >
              <Video className="w-4 h-4 text-indigo-400" /> Open Video Studio (NLE)
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-400">Total Series</p>
            <h3 className="text-xl font-bold text-zinc-100">{seriesList.length}</h3>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-400">Sample Chapters</p>
            <h3 className="text-xl font-bold text-zinc-100">3 Chapters</h3>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-400">Reference Voice</p>
            <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-4 h-4" /> 1 Voice Configured
            </h3>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-400">Video Studio Engine</p>
            <h3 className="text-xs font-semibold text-zinc-200 mt-1">Multi-Track NLE Ready</h3>
          </div>
        </div>
      </div>

      {/* Production Workflow Sequence */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
          Production Workflow Steps
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.num}
                onClick={() => navigate(`/${step.tab}`)}
                className="bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-indigo-500/40 rounded-xl p-4 text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center">
                      {step.num}
                    </span>
                    <Icon className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                    {step.desc}
                  </p>
                </div>
                <div className="pt-3 text-[10px] font-medium text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open Stage <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Series Cards Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Active Series
          </h2>
          <button
            onClick={() => navigate('/series')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            Manage Library <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {seriesList.map((s) => (
            <div
              key={s.id}
              className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all flex flex-col"
            >
              <div className="h-40 bg-zinc-950 relative overflow-hidden">
                <img
                  src={s.coverImage}
                  alt={s.title}
                  className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                />
                <div className="absolute top-2 right-2 bg-zinc-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-semibold text-indigo-300 border border-zinc-700">
                  {s.status.toUpperCase()}
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 line-clamp-1">{s.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{s.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.genres.map((g) => (
                      <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">{s.chapterCount || 3} Chapters</span>
                  <button
                    onClick={() => navigate('/reader')}
                    className="px-3 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3" /> Open Reader
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
