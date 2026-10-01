'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useSearchParams } from 'next/navigation';
import {
  Youtube,
  Loader2,
  PlusCircle,
  RefreshCw,
  Trash2,
  Users,
  Eye,
  Video,
  Clock,
  TrendingUp,
  Target,
  CheckCircle2,
  ExternalLink,
  UploadCloud,
  Zap,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface AccountData {
  _id: string;
  channelId: string;
  channelTitle: string;
  customUrl?: string;
  thumbnailUrl?: string;
  email?: string;
  connectedAt: string;
  stats?: {
    subscribers: number;
    totalViews: number;
    videoCount: number;
    watchHours365?: number | null;
    shortsViews90?: number | null;
    uploads90d?: number | null;
    lastSyncedAt?: string;
  };
  monetization: {
    fanFunding: { reached: boolean; percent: number; missing: any };
    fullMonetization: { reached: boolean; percent: number; missing: any };
  };
}

interface GoalData {
  _id: string;
  accountId: string;
  targetSubscribers: number;
  targetWatchHours: number;
  targetShortsViews: number;
  targetUploadsPerMonth: number;
  deadline?: string;
  note?: string;
}

interface UploadData {
  _id: string;
  fileName: string;
  seo: { title: string; privacyStatus: string };
  status: string;
  targets: { channelTitle: string; status: string; watchUrl?: string; error?: string }[];
  createdAt: string;
}

function fmt(n?: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function YouTubePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
          <Navbar />
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        </div>
      }
    >
      <YouTubeDashboardPage />
    </Suspense>
  );
}

function YouTubeDashboardPage() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [uploads, setUploads] = useState<UploadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [runtimeBanner, setRuntimeBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState<any>({});
  const [nowTs, setNowTs] = useState(0);

  const connectedParam = searchParams.get('connected');
  const errorParam = searchParams.get('error');
  const banner =
    runtimeBanner ||
    (connectedParam
      ? { type: 'ok' as const, text: `Channel "${connectedParam}" connected!` }
      : errorParam
      ? { type: 'err' as const, text: `Connection failed: ${errorParam}` }
      : null);

  const loadAll = async () => {
    try {
      const [accRes, goalRes, upRes] = await Promise.all([
        fetch('/api/youtube/accounts'),
        fetch('/api/youtube/goals'),
        fetch('/api/youtube/uploads'),
      ]);
      const accData = await accRes.json();
      const goalData = await goalRes.json();
      const upData = await upRes.json();
      if (accData.success) {
        setAccounts(accData.data);
        setConfigured(accData.configured !== false);
      }
      if (goalData.success) setGoals(goalData.data);
      if (upData.success) setUploads(upData.data);
      setNowTs(Date.now());
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadAll, 0);
    return () => clearTimeout(t);
  }, [searchParams]);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/youtube/auth');
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setRuntimeBanner({ type: 'err', text: data.error || 'OAuth not configured' });
      }
    } catch {
      setRuntimeBanner({ type: 'err', text: 'Failed to start connection' });
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      await fetch(`/api/youtube/accounts/${id}/sync`, { method: 'POST' });
      await loadAll();
    } catch {} finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (id: string, title: string) => {
    if (!confirm(`Disconnect channel "${title}"?`)) return;
    await fetch(`/api/youtube/accounts?id=${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const startEditGoal = (accountId: string) => {
    const existing = goals.find((g) => g.accountId === accountId);
    setGoalForm(
      existing || {
        accountId,
        targetSubscribers: 1000,
        targetWatchHours: 4000,
        targetShortsViews: 10000000,
        targetUploadsPerMonth: 4,
        deadline: '',
        note: '',
      }
    );
    setEditingGoal(accountId);
  };

  const saveGoal = async () => {
    try {
      const res = await fetch('/api/youtube/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...goalForm, deadline: goalForm.deadline || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingGoal(null);
        await loadAll();
      }
    } catch {}
  };

  const daysLeft = (deadline?: string) => {
    if (!deadline || !nowTs) return null;
    const d = Math.ceil((new Date(deadline).getTime() - nowTs) / 86400000);
    return Math.max(1, d);
  };

  const renderGoalPlan = (account: AccountData) => {
    const goal = goals.find((g) => g.accountId === account._id);
    if (!goal) return null;
    const stats = account.stats;
    const dl = daysLeft(goal.deadline);
    const subNeed = Math.max(0, goal.targetSubscribers - (stats?.subscribers || 0));
    const watchNeed = Math.max(0, goal.targetWatchHours - (stats?.watchHours365 || 0));
    return (
      <div className="mt-3 p-3 bg-indigo-950/40 border border-indigo-900/50 rounded-xl text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-indigo-300 flex items-center space-x-1">
            <Target className="w-3.5 h-3.5" />
            <span>Active Goal{dl ? ` — ${dl} days left` : ''}</span>
          </span>
          <button onClick={() => startEditGoal(account._id)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-neutral-300">
          <span>Subs needed: <b className="text-white">{fmt(subNeed)}</b>{dl ? ` (${(subNeed / dl).toFixed(1)}/day)` : ''}</span>
          <span>Watch hrs needed: <b className="text-white">{fmt(watchNeed)}</b>{dl ? ` (${(watchNeed / dl).toFixed(1)}/day)` : ''}</span>
          <span>Upload pace: <b className="text-white">{goal.targetUploadsPerMonth}/mo</b></span>
          {goal.deadline && <span>Deadline: <b className="text-white">{new Date(goal.deadline).toLocaleDateString()}</b></span>}
        </div>
        {goal.note && <p className="text-neutral-400 italic">{goal.note}</p>}
      </div>
    );
  };

  const renderGoalEditor = (accountId: string) => {
    if (editingGoal !== accountId) return null;
    const field = (key: string, label: string) => (
      <div>
        <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">{label}</label>
        <input
          type="number"
          value={goalForm[key] ?? ''}
          onChange={(e) => setGoalForm({ ...goalForm, [key]: Number(e.target.value) })}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
        />
      </div>
    );
    return (
      <div className="mt-3 p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          {field('targetSubscribers', 'Target Subscribers')}
          {field('targetWatchHours', 'Target Watch Hours')}
          {field('targetShortsViews', 'Target Shorts Views')}
          {field('targetUploadsPerMonth', 'Uploads / Month')}
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Deadline</label>
          <input
            type="date"
            value={goalForm.deadline ? String(goalForm.deadline).slice(0, 10) : ''}
            onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <input
          value={goalForm.note || ''}
          onChange={(e) => setGoalForm({ ...goalForm, note: e.target.value })}
          placeholder="Note (e.g. focus on Shorts strategy)"
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
        />
        <div className="flex space-x-2">
          <button onClick={saveGoal} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 rounded-lg transition-colors">
            Save Goal
          </button>
          <button onClick={() => setEditingGoal(null)} className="px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center space-x-2.5">
              <Youtube className="w-7 h-7 text-red-500" />
              <span>YouTube Publisher & Monetization Tracker</span>
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Connect channels, publish your videos with SEO, and track Partner Program progress.
            </p>
          </div>
          <button
            onClick={handleConnect}
            className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold py-2.5 px-4 rounded-xl flex items-center space-x-2 shadow-lg transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Connect Channel</span>
          </button>
        </div>

        {banner && (
          <div
            className={`p-3 rounded-xl text-sm border ${
              banner.type === 'ok'
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                : 'bg-red-950/50 border-red-800 text-red-300'
            }`}
          >
            {banner.text}
          </div>
        )}

        {!configured && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-sm space-y-1">
            <p className="font-bold">Google OAuth not configured</p>
            <p className="text-xs">
              Set <code className="bg-neutral-800 px-1 rounded">GOOGLE_CLIENT_ID</code> and{' '}
              <code className="bg-neutral-800 px-1 rounded">GOOGLE_CLIENT_SECRET</code> in your .env, and add the
              redirect URI <code className="bg-neutral-800 px-1 rounded">http://localhost:5000/api/youtube/auth/callback</code>{' '}
              in Google Cloud Console (YouTube Data API v3 + YouTube Analytics API enabled).
            </p>
          </div>
        )}

        {/* Accounts */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : accounts.length === 0 ? (
          <button
            onClick={handleConnect}
            className="w-full p-10 rounded-2xl border-2 border-dashed border-neutral-800 hover:border-red-500/60 text-neutral-400 hover:text-white transition-all flex flex-col items-center space-y-3"
          >
            <Youtube className="w-12 h-12 text-red-500" />
            <span className="font-semibold">Connect your first YouTube channel</span>
            <span className="text-xs">You can connect multiple Google accounts — repeat for each channel.</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {accounts.map((a) => (
              <div key={a._id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                {/* Account header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {a.thumbnailUrl ? (
                      <img src={a.thumbnailUrl} alt="" className="w-11 h-11 rounded-full border border-neutral-700" />
                    ) : (
                      <Youtube className="w-11 h-11 text-red-500" />
                    )}
                    <div>
                      <p className="font-bold text-white">{a.channelTitle}</p>
                      <p className="text-[11px] text-neutral-500">{a.email || a.customUrl || a.channelId}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleSync(a._id)}
                      disabled={syncing === a._id}
                      className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                      title="Sync channel stats"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing === a._id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDisconnect(a._id, a.channelTitle)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                      title="Disconnect"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Users, label: 'Subscribers', value: fmt(a.stats?.subscribers) },
                    { icon: Eye, label: 'Total Views', value: fmt(a.stats?.totalViews) },
                    { icon: Video, label: 'Videos', value: fmt(a.stats?.videoCount) },
                    { icon: Clock, label: 'Watch Hrs (365d)', value: fmt(a.stats?.watchHours365) },
                    { icon: Zap, label: 'Shorts Views (90d)', value: fmt(a.stats?.shortsViews90) },
                    { icon: UploadCloud, label: 'Uploads (90d)', value: fmt(a.stats?.uploads90d) },
                  ].map((s) => (
                    <div key={s.label} className="bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-center">
                      <s.icon className="w-3.5 h-3.5 mx-auto text-indigo-400 mb-1" />
                      <p className="text-sm font-bold text-white">{s.value}</p>
                      <p className="text-[9px] text-neutral-500 uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>
                {a.stats?.lastSyncedAt && (
                  <p className="text-[10px] text-neutral-600 -mt-2">
                    Synced {new Date(a.stats.lastSyncedAt).toLocaleString()}
                  </p>
                )}

                {/* Monetization progress */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-neutral-300 flex items-center space-x-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                        <span>Fan Funding — 500 subs + 3K hrs / 3M Shorts + 3 uploads</span>
                      </span>
                      {a.monetization.fanFunding.reached ? (
                        <span className="text-emerald-400 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Reached!</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold">{a.monetization.fanFunding.percent}%</span>
                      )}
                    </div>
                    <ProgressBar percent={a.monetization.fanFunding.percent} color="bg-gradient-to-r from-amber-500 to-yellow-400" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-neutral-300 flex items-center space-x-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Full Monetization — 1K subs + 4K hrs / 10M Shorts</span>
                      </span>
                      {a.monetization.fullMonetization.reached ? (
                        <span className="text-emerald-400 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Reached!</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">{a.monetization.fullMonetization.percent}%</span>
                      )}
                    </div>
                    <ProgressBar percent={a.monetization.fullMonetization.percent} color="bg-gradient-to-r from-emerald-500 to-teal-400" />
                    {!a.monetization.fullMonetization.reached && (
                      <p className="text-[10px] text-neutral-500 mt-1.5">
                        Missing: {fmt(a.monetization.fullMonetization.missing.subscribers)} subs
                        {a.monetization.fullMonetization.missing.watchHours != null &&
                          ` + ${fmt(a.monetization.fullMonetization.missing.watchHours)} watch hrs`}
                        {a.monetization.fullMonetization.missing.shortsViews != null &&
                          ` (or ${fmt(a.monetization.fullMonetization.missing.shortsViews)} Shorts views)`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Goal */}
                {!goals.some((g) => g.accountId === a._id) && editingGoal !== a._id && (
                  <button
                    onClick={() => startEditGoal(a._id)}
                    className="w-full text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-neutral-700 hover:border-indigo-500 rounded-xl py-2 font-semibold transition-all flex items-center justify-center space-x-1.5"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Set Monetization Goal & Deadline</span>
                  </button>
                )}
                {renderGoalPlan(a)}
                {renderGoalEditor(a._id)}
              </div>
            ))}
          </div>
        )}

        {/* Upload history */}
        <section>
          <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
            <UploadCloud className="w-4 h-4 text-indigo-400" />
            <span>Upload History ({uploads.length})</span>
          </h2>
          {uploads.length === 0 ? (
            <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-500">
              No uploads yet. Open a chapter&apos;s Video Studio and hit &quot;Publish to YouTube&quot;.
            </div>
          ) : (
            <div className="space-y-2.5">
              {uploads.map((u) => (
                <div key={u._id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-white truncate flex-1">{u.seo?.title || u.fileName}</p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        u.status === 'done'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : u.status === 'failed'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mb-2">
                    {new Date(u.createdAt).toLocaleString()} • {u.seo?.privacyStatus} • {u.fileName}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {u.targets.map((t, i) => (
                      <span
                        key={i}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 ${
                          t.status === 'done'
                            ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300'
                            : t.status === 'failed'
                            ? 'bg-red-950/40 border-red-900/50 text-red-300'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        }`}
                      >
                        <span>{t.channelTitle}</span>
                        {t.watchUrl && (
                          <a href={t.watchUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
